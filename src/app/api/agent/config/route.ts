import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const config = await prisma.agentConfig.findUnique({
    where: { userId: session.user.id },
    select: { provider: true, model: true, temperature: true, proactiveMode: true, locale: true },
  });
  return NextResponse.json(config ?? { provider: "openrouter", model: "anthropic/claude-sonnet-4-20250514", temperature: 0.7, proactiveMode: true, locale: "id" });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const body = await request.json();
  const config = await prisma.agentConfig.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...body },
    update: body,
  });
  return NextResponse.json(config);
}
