import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    // This is a public endpoint deliberately accessible without auth,
    // intended for the client viewing their invoice link.

    const project = await prisma.project.findUnique({
      where: { id },
      select: { terms: true, termsAcceptedAt: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.terms) {
      return NextResponse.json(
        { error: "This project has no terms to accept" },
        { status: 400 },
      );
    }

    if (project.termsAcceptedAt) {
      return NextResponse.json(
        { error: "Terms have already been accepted" },
        { status: 400 },
      );
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        termsAcceptedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      termsAcceptedAt: updatedProject.termsAcceptedAt,
    });
  } catch (error) {
    console.error("Failed to accept project terms:", error);
    return NextResponse.json(
      { error: "Failed to accept terms" },
      { status: 500 },
    );
  }
}
