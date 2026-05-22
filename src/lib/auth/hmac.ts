import { createHmac, timingSafeEqual } from "crypto";

const HMAC_ALGORITHM = "sha256";

/**
 * Sign an invoice pay request with HMAC for public endpoint security.
 * Signature = HMAC-SHA256(invoiceId + ":" + orgId, INVOICE_HMAC_SECRET)
 */
export function signInvoicePay(invoiceId: string, orgId: string): string {
  const secret = process.env.INVOICE_HMAC_SECRET;
  if (!secret) return "";
  return createHmac(HMAC_ALGORITHM, secret)
    .update(`${invoiceId}:${orgId}`)
    .digest("hex");
}

/**
 * Verify an invoice pay HMAC signature.
 * Falls back to allow (return true) if INVOICE_HMAC_SECRET is not set.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyInvoicePaySig(invoiceId: string, orgId: string, sig: string): boolean {
  const secret = process.env.INVOICE_HMAC_SECRET;
  if (!secret) return true; // fallback: no secret = no verification
  const expected = createHmac(HMAC_ALGORITHM, secret)
    .update(`${invoiceId}:${orgId}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}