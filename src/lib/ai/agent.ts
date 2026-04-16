import { createLLMProvider } from "./provider";
import { buildSystemPrompt } from "./prompts";
import { buildBusinessContext } from "./context-builder";
import { executeTool, AI_TOOL_DEFS } from "./tools";
import { prisma } from "@/lib/prisma";

export interface AgentChatOptions {
  conversationId?: string;
  message: string;
  userId: string;
  locale?: "id" | "en";
}

export interface AgentChatResult {
  messageId: string;
  content: string;
  conversationId: string;
  provider: string;
}

export interface AgentChatCallbacks {
  onChunk: (chunk: string) => void;
  onToolCall: (tool: string, args: Record<string, unknown>) => void;
  onToolResult: (tool: string, result: unknown) => void;
  onComplete: (result: AgentChatResult) => void;
  onError: (error: Error) => void;
}

interface MessageRecord {
  role: string;
  content: string;
}

interface ToolCallRecord {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

const MAX_TOOL_ROUNDS = 5;

async function runToolLoop(
  provider: ReturnType<typeof createLLMProvider>,
  messages: Array<{ role: string; content: string; tool_calls?: unknown[]; tool_call_id?: string }>,
  onToolCall?: (tool: string, args: Record<string, unknown>) => void,
  onToolResult?: (tool: string, result: unknown) => void,
): Promise<{ content: string | undefined; toolCalls?: unknown[] }> {
  let result = await provider.chat(messages, { tools: AI_TOOL_DEFS });

  let round = 0;
  while (
    result.toolCalls &&
    (result.toolCalls as ToolCallRecord[]).length > 0 &&
    round < MAX_TOOL_ROUNDS
  ) {
    round++;
    const toolCalls = result.toolCalls as ToolCallRecord[];

    for (const tc of toolCalls) {
      const toolName = tc.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }

      onToolCall?.(toolName, args);
      const toolResult = await executeTool(toolName, args);
      onToolResult?.(toolName, toolResult);

      messages.push({
        role: "assistant",
        content: "",
        tool_calls: [tc],
      });
      messages.push({
        role: "tool",
        content: JSON.stringify(toolResult),
        tool_call_id: tc.id,
      });
    }

    result = await provider.chat(messages, { tools: AI_TOOL_DEFS });
  }

  return result;
}

export async function agentChat(options: AgentChatOptions): Promise<AgentChatResult> {
  const { message, locale = "id" } = options;
  const context = await buildBusinessContext();
  const systemPrompt = buildSystemPrompt(context, locale);

  let conversationId: string = options.conversationId ?? "";
  if (!conversationId) {
    const conv = await prisma.agentConversation.create({
      data: { userId: options.userId, title: message.substring(0, 50) },
    });
    conversationId = conv.id;
  }

  await prisma.agentMessage.create({ data: { conversationId, role: "user", content: message } });

  const msgs = await prisma.agentMessage.findMany({
    where: { conversationId }, orderBy: { createdAt: "asc" }, take: 20,
    select: { role: true, content: true },
  });
  const llmMessages = [
    { role: "system", content: systemPrompt },
    ...msgs.map((m: MessageRecord) => ({ role: m.role, content: m.content })),
  ];

  const provider = createLLMProvider();
  const result = await runToolLoop(provider, llmMessages);

  const saved = await prisma.agentMessage.create({
    data: {
      conversationId,
      role: "assistant",
      content: result.content ?? "",
      metadata: result.toolCalls ? JSON.parse(JSON.stringify({ toolCalls: result.toolCalls })) : undefined,
    },
  });

  return { messageId: saved.id, content: result.content ?? "", conversationId, provider: provider.name };
}

export async function agentChatStream(
  options: AgentChatOptions,
  callbacks: AgentChatCallbacks,
): Promise<void> {
  const { message, locale = "id" } = options;

  try {
    const context = await buildBusinessContext();
    const systemPrompt = buildSystemPrompt(context, locale);

    let conversationId: string = options.conversationId ?? "";
    if (!conversationId) {
      const conv = await prisma.agentConversation.create({
        data: { userId: options.userId, title: message.substring(0, 50) },
      });
      conversationId = conv.id;
    }

    await prisma.agentMessage.create({ data: { conversationId, role: "user", content: message } });

    const msgs = await prisma.agentMessage.findMany({
      where: { conversationId }, orderBy: { createdAt: "asc" }, take: 20,
      select: { role: true, content: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const llmMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...msgs.map((m: MessageRecord) => ({ role: m.role, content: m.content })),
    ];

    const provider = createLLMProvider();
    let fullContent = "";

    // --- Step 1: initial LLM call with tools ---
    const initialResult = await provider.chat(llmMessages, { tools: AI_TOOL_DEFS });

    // If the model returned tool calls (non-streaming tool use), execute them
    let currentContent = initialResult.content ?? "";
    let toolCalls = (initialResult.toolCalls as ToolCallRecord[]) ?? [];
    let round = 0;
    const maxRounds = 5;

    while (toolCalls.length > 0 && round < maxRounds) {
      round++;

      for (const tc of toolCalls) {
        const toolName = tc.function.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }

        callbacks.onToolCall(toolName, args);
        const toolResult = await executeTool(toolName, args);
        callbacks.onToolResult(toolName, toolResult);

        llmMessages.push({
          role: "assistant",
          content: "",
          tool_calls: [tc],
        });
        llmMessages.push({
          role: "tool",
          content: JSON.stringify(toolResult),
          tool_call_id: tc.id,
        });
      }

      const res = await provider.chat(llmMessages, { tools: AI_TOOL_DEFS });
      currentContent = res.content ?? "";
      toolCalls = (res.toolCalls as ToolCallRecord[]) ?? [];

      if (toolCalls.length === 0) {
        // Final answer available — stream it
        for (const ch of currentContent) {
          callbacks.onChunk(ch);
        }
        fullContent = currentContent;
      }
    }

    // If no tool calls at all, stream the content
    if (round === 0 && toolCalls.length === 0) {
      // Use streaming endpoint for the initial response
      for await (const chunk of provider.chatStream(llmMessages)) {
        fullContent += chunk;
        callbacks.onChunk(chunk);
      }
    }

    const saved = await prisma.agentMessage.create({
      data: { conversationId, role: "assistant", content: fullContent },
    });

    callbacks.onComplete({
      messageId: saved.id,
      content: fullContent,
      conversationId,
      provider: provider.name,
    });
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function getProactiveInsights(userId: string) {
  const config = await prisma.agentConfig.findUnique({ where: { userId } });
  if (!config?.proactiveMode) return [];

  const context = await buildBusinessContext();
  const insights: Array<{ type: string; priority: string; message: string }> = [];

  if (context.stats.overdueInvoices > 0) {
    insights.push({ type: "overdue_warning", priority: "high", message: `${context.stats.overdueInvoices} invoice` + (context.stats.overdueInvoices > 1 ? "s are" : " is") + ` overdue and awaiting payment.` });
  }
  if (context.stats.totalPending > 0 && context.stats.totalPending > context.stats.totalPaid * 0.5) {
    insights.push({ type: "cashflow_alert", priority: "medium", message: `Pending amount is Rp ${context.stats.totalPending.toLocaleString("id-ID")} — over 50% of total revenue. Consider following up with clients.` });
  }
  if (context.stats.unpaidInvoices >= 3) {
    insights.push({ type: "follow_up_reminder", priority: "medium", message: `${context.stats.unpaidInvoices} invoices are unpaid. Want to generate reminders?` });
  }

  return insights;
}
