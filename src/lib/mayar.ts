import crypto from "crypto";

// For MVP, we use placeholder implementation if keys are missing
const MAYAR_API_URL = process.env.MAYAR_API_URL || "https://api.mayar.id/hl/v1";
const MAYAR_API_KEY = process.env.MAYAR_API_KEY || "";
const MAYAR_WEBHOOK_SECRET = process.env.MAYAR_WEBHOOK_SECRET || "";

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
  // If no API key is provided, we simulate the Mayar API for MVP testing
  if (!MAYAR_API_KEY) {
    console.warn("No MAYAR_API_KEY provided. Using simulated payment link.");
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
      Authorization: `Bearer ${MAYAR_API_KEY}`,
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

export function verifyMayarWebhook(
  payload: string,
  signature: string,
): boolean {
  if (!MAYAR_WEBHOOK_SECRET) {
    console.error(
      "CRITICAL: No MAYAR_WEBHOOK_SECRET provided. Denying webhook verification.",
    );
    return false;
  }
  try {
    // 1. Direct match (in case it is just a static API key/secret passed in header)
    if (signature === MAYAR_WEBHOOK_SECRET) {
      return true;
    }

    // 2. HMAC SHA-256
    const expectedSha256 = crypto.createHmac("sha256", MAYAR_WEBHOOK_SECRET).update(payload).digest("hex");
    if (signature === expectedSha256) {
      return true;
    }

    // 3. HMAC SHA-512 (x-callback-token is 128 characters long, which matches exactly SHA-512)
    const expectedSha512 = crypto.createHmac("sha512", MAYAR_WEBHOOK_SECRET).update(payload).digest("hex");
    if (signature === expectedSha512) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}
