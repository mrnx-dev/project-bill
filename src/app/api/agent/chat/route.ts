import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { agentChatStream } from "@/lib/ai/agent";
import { RateLimiter } from "@/lib/rate-limit";

// Rate limit: 20 AI chat requests per user per hour
const aiChatLimiter = new RateLimiter({
  limit: 20,
  windowMs: 60 * 60 * 1000, // 1 hour
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  // Rate limit check
  const rateCheck = aiChatLimiter.check(session.user.id);
  if (!rateCheck.success) {
    const minutesLeft = Math.ceil((rateCheck.reset - Date.now()) / 60000);
    return NextResponse.json(
      { error: `Too many requests. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.` },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const { message, conversationId } = body;
    if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Fire-and-forget: stream processing in background
    agentChatStream(
      { message, conversationId, userId: session.user.id },
      {
        onChunk: (chunk: string) => {
          writer.write(encoder.encode(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`));
        },
        onToolCall: (tool: string, args: Record<string, unknown>) => {
          writer.write(encoder.encode(`data: ${JSON.stringify({ type: "tool_call", tool, args })}\n\n`));
        },
        onToolResult: (tool: string, result: unknown) => {
          writer.write(encoder.encode(`data: ${JSON.stringify({ type: "tool_result", tool, result })}\n\n`));
        },
        onComplete: (result) => {
          writer.write(encoder.encode(`data: ${JSON.stringify({ type: "done", conversationId: result.conversationId, messageId: result.messageId })}\n\n`));
          writer.write(encoder.encode("data: [DONE]\n\n"));
          writer.close().catch(() => {});
        },
        onError: (error: Error) => {
          writer.write(encoder.encode(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`));
          writer.close().catch(() => {});
        },
      },
    );

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-RateLimit-Remaining": String(rateCheck.remaining),
        "X-RateLimit-Reset": String(rateCheck.reset),
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to process chat" }, { status: 500 });
  }
}
