"use server";

import { auth } from "@/auth";
import { sendReceiptEmailUtil } from "@/lib/email/send-receipt-email";

export async function sendReceiptEmail(invoiceId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  try {
    return await sendReceiptEmailUtil({ invoiceId, orgId: session.user.activeOrganizationId! });
  } catch (error) {
    return { success: false, error: "Failed to send receipt email" };
  }
}