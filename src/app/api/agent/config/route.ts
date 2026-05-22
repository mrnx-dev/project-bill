import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
    const { organizationId } = await requireOrgRole(session, ["OWNER", "ADMIN"]);
    const config = await prisma.agentConfig.findUnique({
      where: { userId: session.user.id },
      select: { provider: true, model: true, temperature: true, proactiveMode: true, locale: true },
    });
    return NextResponse.json(config ?? { provider: "openrouter", model: "anthropic/claude-sonnet-4-20250514", temperature: 0.7, proactiveMode: true, locale: "id" });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("[AGENT_CONFIG_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
    const { organizationId } = await requireOrgRole(session, ["OWNER", "ADMIN"]);
    const body = await request.json();
    const config = await prisma.agentConfig.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...body },
      update: body,
    });
    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("[AGENT_CONFIG_PUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}