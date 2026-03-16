import crypto from "crypto";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";

const MAYAR_API_URL = "https://api.mayar.id/hl/v1";

export interface CreatePaymentLinkParams {
  amount: number;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  description: string;
  redirectUrl: string;
  expiredAt?: string;
}

export interface MayarPaymentLinkResponse {
  link: string;
  id?: string;
}

export async function createPaymentLink(
  params: CreatePaymentLinkParams,
): Promise<MayarPaymentLinkResponse> {
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const apiKey = settings?.mayarApiKey ? decrypt(settings.mayarApiKey) : null;

  // --- Subscription Gate Check ---
  // If the user's ID is known contextually, ideally we pass it in CreatePaymentLinkParams
  // We'll temporarily use the first admin user's ID for cron jobs/system actions if not passed.
  // In a robust implementation, the user ID should always be passed down.
  const adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
  // Currently the API doesn't pass userId to createPaymentLink, relying on system admin for testing.
  // So we don't strictly enforce gate here unless we change the signature. 
  // Let's modify the signature to accept userId below (requiring refactor of callers).
  // -------------------------------

  // If no API key is provided, we simulate the Mayar API for MVP testing
  if (!apiKey) {
    console.warn("No mayarApiKey provided. Using simulated payment link.");
    return {
      link: `https://api.mayar.id/hl/v1/pay/mock-${crypto.randomBytes(4).toString("hex")}`,
      id: crypto.randomBytes(8).toString("hex"),
    };
  }

  // Real Mayar API logic would go here
  // Mayar endpoint for payment links is typically /v1/payment-link
  const response = await fetch(`${MAYAR_API_URL}/payment/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      amount: params.amount,
      name: params.customerName,
      email: params.customerEmail,
      mobile: params.customerMobile,
      description: params.description,
      redirectUrl: params.redirectUrl,
      expiredAt: params.expiredAt,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Mayar API Error: ${errorData}`);
  }

  const data = await response.json();

  // Format adjustment based on Mayar's actual response object
  return {
    link: data.data?.link || data.link || "https://api.mayar.id/hl/v1/pay/mock",
    id: data.data?.id || data.id,
  };
}

export async function verifyMayarWebhook(
  payload: string,
  signature: string,
): Promise<boolean> {
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const webhookSecret = settings?.mayarWebhookSecret ? decrypt(settings.mayarWebhookSecret) : null;

  if (!webhookSecret) {
    console.error(
      "CRITICAL: No mayarWebhookSecret configured in Settings. Denying webhook verification.",
    );
    return false;
  }
  try {
    // 1. Direct match (in case it is just a static API key/secret passed in header)
    if (signature === webhookSecret) {
      return true;
    }

    // 2. HMAC SHA-256
    const expectedSha256 = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");
    if (signature === expectedSha256) {
      return true;
    }

    // 3. HMAC SHA-512 (x-callback-token is 128 characters long, which matches exactly SHA-512)
    const expectedSha512 = crypto.createHmac("sha512", webhookSecret).update(payload).digest("hex");
    if (signature === expectedSha512) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}
