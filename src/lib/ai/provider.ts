// Pluggable LLM Provider Abstraction
import { env } from "@/lib/env";

export interface LLMProvider {
  name: string;
  chat(
    messages: Array<{ role: string; content: string }>,
    options?: { model?: string; temperature?: number; tools?: unknown[] },
  ): Promise<{ content: string; toolCalls?: unknown[] }>;
  chatStream(
    messages: Array<{ role: string; content: string }>,
    options?: { model?: string; temperature?: number },
  ): AsyncIterable<string>;
}

export function createLLMProvider(): LLMProvider {
  const provider = env.AI_PROVIDER;
  const apiKey = env.AI_API_KEY;
  if (!apiKey?.trim()) throw new Error("AI_API_KEY environment variable is required");

  switch (provider) {
    case "openrouter": return createOpenRouterProvider(apiKey);
    case "openai": throw new Error("OpenAI provider not yet implemented");
    case "anthropic": throw new Error("Anthropic provider not yet implemented");
    case "local": throw new Error("Local provider not yet implemented");
    default: throw new Error(`Unknown AI provider: ${provider}`);
  }
}

function createOpenRouterProvider(apiKey: string): LLMProvider {
  const model = env.AI_MODEL || "anthropic/claude-sonnet-4-20250514";
  return {
    name: "openrouter",
    async chat(messages, options = {}) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": env.APP_URL || "http://localhost:3000",
        },
        body: JSON.stringify({
          model: options.model || model,
          messages,
          temperature: options.temperature ?? 0.7,
          tools: options.tools,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenRouter API error ${res.status}: ${text}`);
      }
      const data = await res.json();
      return {
        content: data.choices?.[0]?.message?.content ?? "",
        toolCalls: data.choices?.[0]?.message?.tool_calls,
      };
    },
    async* chatStream(messages, options = {}) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": env.APP_URL || "http://localhost:3000",
        },
        body: JSON.stringify({
          model: options.model || model,
          messages,
          temperature: options.temperature ?? 0.7,
          stream: true,
        }),
      });
      if (!res.ok) throw new Error(`OpenRouter API error ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const json = JSON.parse(line.slice(6));
              const chunk = json.choices?.[0]?.delta?.content;
              if (chunk) yield chunk;
            } catch { /* skip malformed */ }
          }
        }
      }
    },
  };
}
