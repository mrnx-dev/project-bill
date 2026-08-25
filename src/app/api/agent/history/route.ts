import { NextResponse } from "next/server";
import { withTenantRls, getTenantCtx } from "@/lib/rls";

export const GET = withTenantRls(async (request: Request, _ctx, tx) => {
  const ctx = getTenantCtx()!;
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");

  if (conversationId) {
    // Object-level authorization (OWASP API1:2023 BOLA): verify ownership
    // before returning messages. 404 (not 403) to avoid leaking existence.
    // NOTE: AgentConversation is a tenant model, so withTenantRls's RLS context
    // also auto-injects `organizationId` into this findUnique's `where` (via the
    // prisma extension). The explicit organizationId check below is therefore
    // belt-and-suspenders (never fails when RLS is active) but is kept as
    // defense-in-depth in case the context is ever absent. The `userId` check
    // is the meaningful one (RLS does not filter by user).
    const conversation = await tx.agentConversation.findUnique({
      where: { id: conversationId },
      select: { userId: true, organizationId: true },
    });
    if (
      !conversation ||
      conversation.userId !== ctx.userId ||
      conversation.organizationId !== ctx.organizationId
    ) {
      return new NextResponse("Not Found", { status: 404 });
    }
    const messages = await tx.agentMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, metadata: true, createdAt: true },
    });
    return NextResponse.json({ messages });
  }

  const conversations = await tx.agentConversation.findMany({
    where: { userId: ctx.userId, organizationId: ctx.organizationId },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, title: true, updatedAt: true, _count: { select: { messages: true } } },
  });
  return NextResponse.json({ conversations });
});
