// Core AI Agent Orchestrator — chat + streaming
import { createLLMProvider } from "./provider";
import { buildSystemPrompt } from "./prompts";
import { buildBusinessContext } from "./context-builder";
import { prisma } from "@/lib/prisma";
import type { AgentConfigDTO } from "./types";

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

// Non-streaming (fallback)
export async function agentChat(options: AgentChatOptions): Promise<AgentChatResult> {
  const { message, locale = "id" } = options;
  const context = await buildBusinessContext();
  const systemPrompt = buildSystemPrompt(context, locale);

  let conversationId = options.conversationId;
  if (!conversationId) {
    const conv = await prisma.agentConversation.create({
      data: { userId: options.userId, title: message.substring(0, 50) },
    });
    conversationId = conv.id;
  }

  // Save user message
  await prisma.agentMessage.create({
    data: { conversationId, role: "user", content: message },
  });

  // Build message history
  const recentMessages = await prisma.agentMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { role: true, content: true },
  });

  const llmMessages = [
    { role: "system", content: systemPrompt },
    ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const provider = createLLMProvider();
  const result = await provider.chat(llmMessages);

  const saved = await prisma.agentMessage.create({
    data: {
      conversationId,
      role: "assistant",
      content: result.content,
      metadata: result.toolCalls ? { toolCalls: result.toolCalls } : undefined,
    },
  });

  return {
    messageId: saved.id,
    content: result.content,
    conversationId,
    provider: provider.name,
  };
}

// Streaming via async iterator
export async function* agentChatStreamIterator(options: AgentChatOptions): AsyncIterable<string> {
  const { message, locale = "id" } = options;
  const context = await buildBusinessContext();
  const systemPrompt = buildSystemPrompt(context, locale);

  let conversationId = options.conversationId;
  if (!conversationId) {
    const conv = await prisma.agentConversation.create({
      data: { userId: options.userId, title: message.substring(0, 50) },
    });
    conversationId = conv.id;
  }

  await prisma.agentMessage.create({
    data: { conversationId, role: "user", content: message },
  });

  const recentMessages = await prisma.agentMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { role: true, content: true },
  });

  const llmMessages = [
    { role: "system", content: systemPrompt },
    ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const provider = createLLMProvider();
  for await (const chunk of provider.chatStream(llmMessages)) {
    yield chunk;
  }
}

// Streaming with callback-based approach (for SSE responses)
export async function agentChatStream(
  options: AgentChatOptions,
  callbacks: {
    onChunk: (chunk: string) => void;
    onComplete: (result: AgentChatResult) => void;
    onError: (error: Error) => void;
  },
): Promise<void> {
  const { message, locale = "id" } = options;

  try {
    const context = await buildBusinessContext();
    const systemPrompt = buildSystemPrompt(context, locale);

    let conversationId = options.conversationId;
    if (!conversationId) {
      const conv = await prisma.agentConversation.create({
        data: { userId: options.userId, title: message.substring(0, 50) },
      });
      conversationId = conv.id;
    }

    await prisma.agentMessage.create({
      data: { conversationId, role: "user", content: message },
    });

    const recentMessages = await prisma.agentMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, content: true },
    });

    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const provider = createLLMProvider();
    let fullContent = "";

    for await (const chunk of provider.chatStream(llmMessages)) {
      fullContent += chunk;
      callbacks.onChunk(chunk);
    }

    const saved = await prisma.agentMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content: fullContent,
      },
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

// Get proactive insights
export async function getProactiveInsights(userId: string) {
  const config = await prisma.agentConfig.findUnique({
    where: { userId },
  });

  if (!config?.proactiveMode) {
    return [];
  }

  const context = await buildBusinessContext();
  const insights: Array<{ type: string; priority: string; message: string }> = [];

  // Overdue warning
  if (context.stats.overdueInvoices > 0) {
    insights.push({
      type: "overdue_warning",
      priority: "high",
      message: `Ada ${context.stats.overdueInvoices} invoice yang sudah jatuh tapi belum dibayar. Mau Elena kirim reminder otomatis?`,
    });
  }

  // Cashflow alert
  if (context.stats.totalPending > 0 && context.stats.totalPending > context.stats.totalPaid * 0.5) {
    insights.push({
      type: "cashflow_alert",
      priority: "medium",
      message: `Total pending Rp ${context.stats.totalPending.toLocaleString("id-ID")} — lebih dari 50% revenue total. Pertimbangkan untuk follow up klien yang belum bayar.`,
    });
  }

  // Follow-up for clients with pending invoices
  if (context.stats.unpaidInvoices >= 3) {
    insights.push({
      type: "follow_up_reminder",
      priority: "medium",
      message: `Ada ${context.stats.unpaidInvoices} invoice belum dibayar. Mau Elena generate reminder email untuk semuanya?`,
    });
  }

  return insights;
}
