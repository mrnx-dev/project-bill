import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");
  if (conversationId) {
    const messages = await prisma.agentMessage.findMany({
      where: { conversationId }, orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, metadata: true, createdAt: true },
    });
    return NextResponse.json({ messages });
  }
  const conversations = await prisma.agentConversation.findMany({
    where: { userId: session.user.id }, orderBy: { updatedAt: "desc" }, take: 10,
    select: { id: true, title: true, updatedAt: true, _count: { select: { messages: true } } },
  });
  return NextResponse.json({ conversations });
}
