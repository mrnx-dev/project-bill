import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReminderEmail, ReminderType } from "@/lib/email";

export async function GET(request: Request) {
  // 1. Validate CRON_SECRET (Default Deny if not set)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Fetch all unpaid invoices with a due date and payment link
    const invoices = await prisma.invoice.findMany({
      where: {
        status: "unpaid",
        dueDate: { not: null },
        paymentLink: { not: null },
      },
      include: {
        project: {
          include: { client: true },
        },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let reminded = 0;
    let lateFeeCount = 0;
    const results: { invoiceId: string; action: string }[] = [];

    for (const invoice of invoices) {
      if (!invoice.dueDate || !invoice.paymentLink) continue;

      const dueDate = new Date(invoice.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const diffMs = today.getTime() - dueDate.getTime();
      const daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Skip if already reminded today
      if (invoice.lastReminderAt) {
        const lastReminder = new Date(invoice.lastReminderAt);
        lastReminder.setHours(0, 0, 0, 0);
        if (lastReminder.getTime() === today.getTime()) {
          continue;
        }
      }

      const clientEmail = invoice.project.client.email;
      if (!clientEmail) continue;

      let reminderType: ReminderType | null = null;

      if (daysDiff === -3) {
        reminderType = "pre_due";
      } else if (daysDiff === 1) {
        reminderType = "overdue_d1";
      } else if (daysDiff === 3) {
        reminderType = "overdue_d3";
      } else if (daysDiff >= 7 && !invoice.lateFeeApplied) {
        reminderType = "late_fee";
      }

      if (!reminderType) continue;

      // Format currency
      const currency = invoice.project.currency || "IDR";
      const formatter = new Intl.NumberFormat(
        currency === "IDR" ? "id-ID" : "en-US",
        {
          style: "currency",
          currency,
          minimumFractionDigits: 0,
        },
      );

      let lateFeeAmountStr: string | undefined;

      // Apply late fee if applicable
      const baseUrl =
        process.env.APP_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");
      const invoiceLink = `${baseUrl}/invoices/${invoice.id}`;

      if (reminderType === "late_fee") {
        const currentAmount = Number(invoice.amount);
        const lateFee = currentAmount * 0.05;
        const newAmount = currentAmount + lateFee;

        lateFeeAmountStr = formatter.format(newAmount);

        // Send reminder email first before updating DB
        const emailResult = await sendReminderEmail({
          to: clientEmail,
          clientName: invoice.project.client.name,
          projectTitle: invoice.project.title,
          invoiceId: invoice.id,
          amountStr: formatter.format(Number(invoice.amount)),
          invoiceLink,
          reminderType,
          lateFeeAmountStr,
          lang: invoice.project.language as "id" | "en",
        });

        if (emailResult.success) {
          await prisma.$transaction([
            prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                amount: newAmount,
                lateFeeApplied: true,
                paymentLink: null,
                paymentId: null,
              },
            }),
            prisma.invoice.update({
              where: { id: invoice.id },
              data: { lastReminderAt: new Date() },
            }),
          ]);
          reminded++;
          lateFeeCount++;
          results.push({ invoiceId: invoice.id, action: reminderType });
        }
      } else {
        // Send reminder email (no late fee)
        const emailResult = await sendReminderEmail({
          to: clientEmail,
          clientName: invoice.project.client.name,
          projectTitle: invoice.project.title,
          invoiceId: invoice.id,
          amountStr: formatter.format(Number(invoice.amount)),
          invoiceLink,
          reminderType,
          lateFeeAmountStr,
          lang: invoice.project.language as "id" | "en",
        });

        if (emailResult.success) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { lastReminderAt: new Date() },
          });
          reminded++;
          results.push({ invoiceId: invoice.id, action: reminderType });
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: invoices.length,
      reminded,
      lateFeeApplied: lateFeeCount,
      details: results,
    });
  } catch (error) {
    console.error("Cron reminder job failed:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
