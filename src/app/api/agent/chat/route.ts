import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { agentChatStream } from "@/lib/ai/agent";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const body = await request.json();
    const { message, conversationId } = body;
    if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    agentChatStream(
      { message, conversationId, userId: session.user.id },
      (chunk: string) => writer.write(encoder.encode(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`)),
      (result) => {
        writer.write(encoder.encode(`data: ${JSON.stringify({ type: "done", conversationId: result.conversationId, messageId: result.messageId })}\n\n`));
        writer.write(encoder.encode("data: [DONE]\n\n"));
        writer.close();
      },
      (error: Error) => {
        writer.write(encoder.encode(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`));
        writer.close();
      },
    );

    return new Response(stream.readable, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to process chat" }, { status: 500 });
  }
}
