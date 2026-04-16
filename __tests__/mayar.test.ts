import crypto from "crypto";
import { prisma } from "../src/lib/prisma";
import { decrypt } from "../src/lib/crypto";

jest.mock("../src/lib/prisma", () => ({
  prisma: {
    settings: {
      findUnique: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    }
  },
}));

jest.mock("../src/lib/crypto", () => ({
  decrypt: jest.fn(),
}));

describe("verifyMayarWebhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return false if MAYAR_WEBHOOK_SECRET is empty", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    (prisma.settings.findUnique as jest.Mock).mockResolvedValue({
      mayarWebhookSecret: null,
    });

    const { verifyMayarWebhook } = await import("../src/lib/billing/mayar");
    const result = await verifyMayarWebhook("test_payload", "any_signature");
    expect(result).toBe(false);

    consoleSpy.mockRestore();
  });

  it("should return true for a valid payload and signature", async () => {
    const secret = "my_super_secret_webhook_key";
    
    (prisma.settings.findUnique as jest.Mock).mockResolvedValue({
      mayarWebhookSecret: "encrypted_secret",
    });
    (decrypt as jest.Mock).mockReturnValue(secret);

    const { verifyMayarWebhook } = await import("../src/lib/billing/mayar");
    const payload = JSON.stringify({ event: "payment.success", amount: 1000 });
    
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const result = await verifyMayarWebhook(payload, signature);
    expect(result).toBe(true);
  });

  it("should return false for an invalid signature", async () => {
    const secret = "my_super_secret_webhook_key";
    
    (prisma.settings.findUnique as jest.Mock).mockResolvedValue({
      mayarWebhookSecret: "encrypted_secret",
    });
    (decrypt as jest.Mock).mockReturnValue(secret);

    const { verifyMayarWebhook } = await import("../src/lib/billing/mayar");
    const payload = JSON.stringify({ event: "payment.success", amount: 1000 });
    
    const invalidSignature = crypto
      .createHmac("sha256", "wrong_secret")
      .update(payload)
      .digest("hex");

    const result = await verifyMayarWebhook(payload, invalidSignature);
    expect(result).toBe(false);
  });

  it("should return false if signature length is mismatched", async () => {
    const secret = "secret";
    
    (prisma.settings.findUnique as jest.Mock).mockResolvedValue({
      mayarWebhookSecret: "encrypted_secret",
    });
    (decrypt as jest.Mock).mockReturnValue(secret);

    const { verifyMayarWebhook } = await import("../src/lib/billing/mayar");
    const payload = JSON.stringify({ event: "payment.success" });
    const invalidSignature = "1234abcd";

    const result = await verifyMayarWebhook(payload, invalidSignature);
    expect(result).toBe(false);
  });
});

