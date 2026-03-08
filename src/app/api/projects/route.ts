import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const pageParam = searchParams.get("page");

    const args: Prisma.ProjectFindManyArgs = {
      include: { client: true, invoices: true, items: true },
      orderBy: { createdAt: "desc" },
    };

    if (limitParam && pageParam) {
      const limit = parseInt(limitParam, 10);
      const page = parseInt(pageParam, 10);
      args.skip = (page - 1) * limit;
      args.take = limit;

      const [projects, total] = await Promise.all([
        prisma.project.findMany(args),
        prisma.project.count(),
      ]);

      return NextResponse.json({
        data: projects,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    }

    const projects = await prisma.project.findMany(args);
    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 },
    );
  }
}

import { projectSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    let json;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = projectSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const data = validation.data;

    // If items exist, recalculate totalPrice from them
    let totalPrice = data.totalPrice;
    if (data.items && data.items.length > 0) {
      totalPrice = data.items.reduce((acc, item) => acc + item.price, 0);
    }

    const projectData: Prisma.ProjectUncheckedCreateInput = {
      title: data.title,
      clientId: data.clientId,
      totalPrice,
      dpAmount: data.dpAmount ?? null,
      currency: data.currency,
      language: data.language,
      deadline: data.deadline ? new Date(data.deadline) : null,
      status: "to_do",
    };

    projectData.terms = data.terms ?? null;

    if (data.items && data.items.length > 0) {
      projectData.items = {
        create: data.items.map((i) => ({
          description: i.description,
          price: i.price,
          quantity: i.quantity ?? null,
          rate: i.rate ?? null,
        })),
      };
    }

    const project = await prisma.project.create({
      data: projectData,
      include: { client: true, invoices: true, items: true },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}
