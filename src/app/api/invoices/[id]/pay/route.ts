import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPaymentLink } from "@/lib/billing/mayar";
import { getBaseUrl } from "@/lib/utils";
import { isMayarSupported } from "@/lib/currency";


export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

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

    if (invoice.status === "PAID") {
      return NextResponse.json(
        { error: "Invoice is already paid" },
        { status: 400 },
      );
    }

    if (!isMayarSupported(invoice.project.currency)) {
      return NextResponse.json(
        { error: "Online payment is not available for this currency. Please use manual bank transfer." },
        { status: 400 },
      );
    }

    const invoiceAmount = Number(invoice.amount);
    const taxRate = invoice.project.taxRate ? Number(invoice.project.taxRate) : 0;
    const taxAmount = invoiceAmount * (taxRate / 100);
    const grandTotal = invoiceAmount + taxAmount;

    const baseUrl = getBaseUrl();

    let expiredAtDate: string | undefined;
    if (invoice.dueDate) {
      const due = new Date(invoice.dueDate);
      const now = new Date();
      if (due < now) {
        // If it's already past due, give them 3 days from now to pay the new link
        const newDue = new Date();
        newDue.setDate(newDue.getDate() + 3);
        expiredAtDate = newDue.toISOString();
      } else {
        expiredAtDate = due.toISOString();
      }
    }

    // Prepare payload for Mayar API `create payment link`
    const mayarRes = await createPaymentLink({
      amount: Math.round(grandTotal),
      customerName: invoice.project.client.name,
      customerEmail: invoice.project.client.email || "client@company.com",
      customerMobile: invoice.project.client.phone || "081234567890",
      description: `Invoice for ${invoice.project.title}. ID: ${invoice.id}`,
      redirectUrl: `${baseUrl}/invoices/${invoice.id}`,
      expiredAt: expiredAtDate,
    });

    const paymentUrl = mayarRes.link;
    const paymentId = mayarRes.id;

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
