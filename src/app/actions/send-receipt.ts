"use server";

import { auth } from "@/auth";
import { sendReceiptEmailUtil } from "@/lib/email/send-receipt-email";
import { requireOrgRole } from "@/lib/auth/org-rbac";

export async function sendReceiptEmail(invoiceId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  try {
    const { organizationId } = await requireOrgRole(session, ['OWNER', 'ADMIN']);
    return await sendReceiptEmailUtil({ invoiceId, orgId: organizationId });
  } catch (error) {
    return { success: false, error: "Failed to send receipt email" };
  }
}