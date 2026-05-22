import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { organizationId } = await requireOrgRole(session, ["OWNER", "ADMIN"]);

    const { id } = await params;
    const body = await req.json();

    const template = await prisma.sOWTemplate.update({
      where: { id, organizationId },
      data: { name: body.name, content: body.content },
    });

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { organizationId } = await requireOrgRole(session, ["OWNER", "ADMIN"]);

    const { id } = await params;

    await prisma.sOWTemplate.delete({ where: { id, organizationId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return new NextResponse("Internal Error", { status: 500 });
  }
}