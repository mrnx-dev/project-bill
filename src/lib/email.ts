import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_mock");

export interface SendInvoiceEmailParams {
  to: string;
  clientName: string;
  projectTitle: string;
  amountStr: string;
  invoiceLink: string;
}

export async function sendInvoiceEmail(params: SendInvoiceEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("No RESEND_API_KEY found. Mocking email delivery.");
    console.log(`[MOCK EMAIL] To: ${params.to} | Link: ${params.invoiceLink}`);
    return { success: true, mocked: true };
  }

  try {
    const data = await resend.emails.send({
      from: "Project Bill <noreply@projectbill.mrndev.me>",
      to: [params.to],
      subject: `Invoice for ${params.projectTitle} - Action Required`,
      html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
                    <h2 style="color: #333;">Hello ${params.clientName},</h2>
                    <p>This is a formal invoice for the completion of the project: <strong>${params.projectTitle}</strong>.</p>
                    
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 16px;">Amount Due:</p>
                        <h1 style="margin: 5px 0 0 0; color: #111;">${params.amountStr}</h1>
                    </div>
                    
                    <p>You can securely view and pay this invoice using the link below:</p>
                    
                    <a href="${params.invoiceLink}" style="display: inline-block; background-color: #0F172A; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">
                        View Your Invoice
                    </a>
                    
                    <p style="margin-top: 30px; font-size: 12px; color: #666;">
                        Powered by <strong>Project Bill</strong>. The friction-free workspace for freelancers.
                    </p>
                </div>
            `,
    });

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send email via Resend:", error);
    return { success: false, error };
  }
}

// --- Reminder Email Templates ---

export type ReminderType = "pre_due" | "overdue_d1" | "overdue_d3" | "late_fee";

export interface SendReminderEmailParams {
  to: string;
  clientName: string;
  projectTitle: string;
  amountStr: string;
  invoiceLink: string;
  reminderType: ReminderType;
  lateFeeAmountStr?: string;
}

const REMINDER_SUBJECTS: Record<ReminderType, (title: string) => string> = {
  pre_due: (t) => `Reminder: Invoice for "${t}" is due in 3 days`,
  overdue_d1: (t) => `Overdue: Invoice for "${t}" is now past due`,
  overdue_d3: (t) => `Follow-up: Invoice for "${t}" is 3 days overdue`,
  late_fee: (t) => `Notice: Late fee applied to invoice for "${t}"`,
};

const REMINDER_BODIES: Record<
  ReminderType,
  (p: SendReminderEmailParams) => string
> = {
  pre_due: (p) => `
        <h2 style="color: #333;">Hello ${p.clientName},</h2>
        <p>This is a friendly reminder that your invoice for <strong>${p.projectTitle}</strong> is due in <strong>3 days</strong>.</p>
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <p style="margin: 0; font-size: 16px;">Amount Due:</p>
            <h1 style="margin: 5px 0 0 0; color: #111;">${p.amountStr}</h1>
        </div>
        <p>Please complete the payment at your earliest convenience to avoid any delays.</p>
    `,
  overdue_d1: (p) => `
        <h2 style="color: #333;">Hello ${p.clientName},</h2>
        <p>Your invoice for <strong>${p.projectTitle}</strong> was due <strong>yesterday</strong> and is now overdue.</p>
        <div style="background-color: #fefce8; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #eab308;">
            <p style="margin: 0; font-size: 16px;">Amount Due:</p>
            <h1 style="margin: 5px 0 0 0; color: #111;">${p.amountStr}</h1>
        </div>
        <p>Please process this payment as soon as possible.</p>
    `,
  overdue_d3: (p) => `
        <h2 style="color: #333;">Hello ${p.clientName},</h2>
        <p>This is a follow-up reminder. Your invoice for <strong>${p.projectTitle}</strong> is now <strong>3 days overdue</strong>.</p>
        <div style="background-color: #fff7ed; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f97316;">
            <p style="margin: 0; font-size: 16px;">Amount Due:</p>
            <h1 style="margin: 5px 0 0 0; color: #111;">${p.amountStr}</h1>
        </div>
        <p>Please note that a late fee may be applied if payment remains outstanding.</p>
    `,
  late_fee: (p) => `
        <h2 style="color: #333;">Hello ${p.clientName},</h2>
        <p>Your invoice for <strong>${p.projectTitle}</strong> is now <strong>7 days overdue</strong>. A <strong>5% late fee</strong> has been applied.</p>
        <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <p style="margin: 0; font-size: 16px;">New Amount Due (incl. late fee):</p>
            <h1 style="margin: 5px 0 0 0; color: #dc2626;">${p.lateFeeAmountStr || p.amountStr}</h1>
        </div>
        <p>Please settle this invoice immediately to prevent further action.</p>
    `,
};

export async function sendReminderEmail(params: SendReminderEmailParams) {
  const subject = REMINDER_SUBJECTS[params.reminderType](params.projectTitle);
  const bodyContent = REMINDER_BODIES[params.reminderType](params);

  if (!process.env.RESEND_API_KEY) {
    console.warn("[MOCK REMINDER EMAIL]", params.reminderType);
    console.log(`  To: ${params.to} | Subject: ${subject}`);
    return { success: true, mocked: true };
  }

  try {
    const data = await resend.emails.send({
      from: "Project Bill <noreply@projectbill.mrndev.me>",
      to: [params.to],
      subject,
      html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
                    ${bodyContent}
                    <a href="${params.invoiceLink}" style="display: inline-block; background-color: #0F172A; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">
                        View Your Invoice
                    </a>
                    <p style="margin-top: 30px; font-size: 12px; color: #666;">
                        Powered by <strong>Project Bill</strong>. The friction-free workspace for freelancers.
                    </p>
                </div>
            `,
    });

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send reminder email:", error);
    return { success: false, error };
  }
}
