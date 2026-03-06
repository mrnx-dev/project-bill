import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mayar Headless API Base URL (adjust to production/sandbox based on environment)
const MAYAR_API_BASE_URL =
  process.env.MAYAR_API_URL || "https://api.mayar.id/hl/v1";

const MAYAR_API_KEY = process.env.MAYAR_API_KEY;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!MAYAR_API_KEY) {
      throw new Error(
        "Mayar API Key is not configured in environment variables.",
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "paid") {
      return NextResponse.json(
        { error: "Invoice is already paid" },
        { status: 400 },
      );
    }

    if (invoice.project.currency !== "IDR") {
      return NextResponse.json(
        { error: "Mayar currently only supports IDR" },
        { status: 400 },
      );
    }

    // Prepare payload for Mayar API `create payment link`
    const payload = {
      name: invoice.project.client.name,
      email: invoice.project.client.email || "client@company.com",
      mobile: invoice.project.client.phone || "081234567890",
      amount: Math.round(Number(invoice.amount)),
      description: `Invoice for ${invoice.project.title}. ID: ${invoice.id}`,
      referenceId: invoice.id, // Important for webhook tracing
      isSingleUse: true, // Usually we want one-time payment for one invoice
      expiredAt: invoice.dueDate
        ? new Date(invoice.dueDate).toISOString()
        : undefined,
    };

    // Request Mayar Headless API to create payment link
    const mayarRes = await fetch(`${MAYAR_API_BASE_URL}/payment/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MAYAR_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!mayarRes.ok) {
      const errorData = await mayarRes.json();
      console.error("Mayar API Error:", errorData);
      throw new Error(
        `Failed to create Mayar payment link: ${errorData.message || mayarRes.statusText}`,
      );
    }

    const data = await mayarRes.json();

    // The response structure usually contains a link attribute (e.g. data.link) depending on Mayar's exact schema.
    // Replace `data.data.link` if their schema differs.
    // Typically: { statusCode: 200, data: { link: "...", id: "..." } }
    const paymentUrl = data.data?.link;
    const paymentId = data.data?.id;

    if (!paymentUrl) {
      throw new Error("Mayar did not return a valid payment link.");
    }

    // Save the token and redirect URL to the database
    await prisma.invoice.update({
      where: { id },
      data: {
        paymentLink: paymentUrl,
        paymentId: paymentId || null,
      },
    });

    return NextResponse.json({
      redirect_url: paymentUrl,
      payment_id: paymentId,
    });
  } catch (error: unknown) {
    console.error("Failed to generate payment link:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}
