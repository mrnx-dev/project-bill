import crypto from "crypto";

describe("verifyMayarWebhook", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should return false if MAYAR_WEBHOOK_SECRET is empty", async () => {
    // Suppress expected console.error for this specific test
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    process.env.MAYAR_WEBHOOK_SECRET = "";

    // Dynamically import the module so it reads the updated process.env
    const { verifyMayarWebhook } = await import("../src/lib/mayar");

    const result = verifyMayarWebhook("test_payload", "any_signature");
    expect(result).toBe(false);

    consoleSpy.mockRestore();
  });

  it("should return true for a valid payload and signature", async () => {
    const secret = "my_super_secret_webhook_key";
    process.env.MAYAR_WEBHOOK_SECRET = secret;

    const { verifyMayarWebhook } = await import("../src/lib/mayar");

    const payload = JSON.stringify({ event: "payment.success", amount: 1000 });

    // Sign the payload using the same logic the module expects
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const result = verifyMayarWebhook(payload, signature);
    expect(result).toBe(true);
  });

  it("should return false for an invalid signature", async () => {
    const secret = "my_super_secret_webhook_key";
    process.env.MAYAR_WEBHOOK_SECRET = secret;

    const { verifyMayarWebhook } = await import("../src/lib/mayar");

    const payload = JSON.stringify({ event: "payment.success", amount: 1000 });

    // Use a bogus signature
    const invalidSignature = crypto
      .createHmac("sha256", "wrong_secret")
      .update(payload)
      .digest("hex");

    const result = verifyMayarWebhook(payload, invalidSignature);
    expect(result).toBe(false);
  });

  it("should return false if signature length is mismatched", async () => {
    const secret = "secret";
    process.env.MAYAR_WEBHOOK_SECRET = secret;

    const { verifyMayarWebhook } = await import("../src/lib/mayar");

    const payload = JSON.stringify({ event: "payment.success" });

    // Provide a signature that is valid hex but wrong length
    const invalidSignature = "1234abcd";

    const result = verifyMayarWebhook(payload, invalidSignature);
    expect(result).toBe(false);
  });
});
