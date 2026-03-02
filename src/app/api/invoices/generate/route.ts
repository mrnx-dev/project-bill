import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPaymentLink } from "@/lib/mayar";
import { sendInvoiceEmail } from "@/lib/email";
import { auth } from "@/auth";
import { generateInvoiceNumber } from "@/lib/invoice-utils";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session) return new NextResponse("Unauthorized", { status: 401 });
        const json = await request.json();
        const { projectId } = json;

        if (!projectId) {
            return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { client: true, invoices: true, items: true }
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        if (project.status !== "done") {
            return NextResponse.json({ error: "Project is not marked as done yet." }, { status: 400 });
        }

        const existingInvoice = project.invoices.find(i => i.type === "full_payment");
        if (existingInvoice) {
            if (existingInvoice.paymentLink) {
                return NextResponse.json({ invoice: existingInvoice, emailSent: false }, { status: 200 });
            }
        }

        let amountToPay = Number(project.totalPrice);
        if (project.dpAmount) {
            amountToPay -= Number(project.dpAmount);
        }

        const customerEmail = project.client.email || "client@example.com";

        // Build itemized description
        let description = `Payment for project: ${project.title}`;
        if ((project as any).items && (project as any).items.length > 0) {
            const currencyFormatter = new Intl.NumberFormat(project.currency === "IDR" ? "id-ID" : "en-US", {
                style: "currency",
                currency: project.currency || "IDR",
                minimumFractionDigits: 0
            });
            const itemLines = (project as any).items.map((i: any) =>
                `- ${i.description}: ${currencyFormatter.format(Number(i.price))}`
            ).join("\n");
            description += `\n\n${itemLines}`;
        }

        const paymentLinkRes = await createPaymentLink({
            amount: amountToPay,
            customerName: project.client.name,
            customerEmail: customerEmail,
            description,
        });

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);

        const invoiceNumber = await generateInvoiceNumber();

        const newInvoice = await prisma.invoice.create({
            data: {
                invoiceNumber,
                projectId: project.id,
                type: "full_payment",
                amount: amountToPay,
                status: "unpaid",
                dueDate,
                paymentLink: paymentLinkRes.link,
                paymentId: paymentLinkRes.id,
            }
        });

        // Soft-fail: Try communicating with Resend, but don't fail the whole block if it errors.
        let emailSuccess = false;
        if (project.client.email) {
            try {
                const formatCurrency = new Intl.NumberFormat(project.currency === "IDR" ? "id-ID" : "en-US", {
                    style: "currency",
                    currency: project.currency || "IDR",
                    minimumFractionDigits: 0
                }).format(amountToPay);

                const emailRes = await sendInvoiceEmail({
                    to: project.client.email,
                    clientName: project.client.name,
                    projectTitle: project.title,
                    amountStr: formatCurrency,
                    paymentLink: paymentLinkRes.link
                });

                emailSuccess = emailRes.success;
            } catch (err) {
                console.error("Email delivery failed non-fatally", err);
            }
        }

        return NextResponse.json({ invoice: newInvoice, emailSent: emailSuccess }, { status: 201 });
    } catch (error) {
        console.error("Failed to generate invoice:", error);
        return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 });
    }
}
