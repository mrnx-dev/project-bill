import { checkLimit, getSubscription, incrementUsage, isManagedCloud, isSelfHosted, resetAllUsageCounters } from "../src/lib/billing/subscription";
import { prisma } from "../src/lib/prisma";

// Mock prisma and env
jest.mock("../src/lib/prisma", () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    client: { count: jest.fn() },
    project: { count: jest.fn() },
    recurringInvoice: { count: jest.fn() },
    sOWTemplate: { count: jest.fn() },
    user: { count: jest.fn() },
  },
}));

jest.mock("../src/lib/env", () => ({
  env: {
    DEPLOYMENT_MODE: "managed", // we will override this in tests
  },
}));

describe("Subscription Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Environment Checks", () => {
    it("should correctly identify self-hosted mode", async () => {
      const { env } = await import("../src/lib/env");
      env.DEPLOYMENT_MODE = "self-hosted";
      expect(isSelfHosted()).toBe(true);
      expect(isManagedCloud()).toBe(false);
    });

    it("should correctly identify managed cloud mode", async () => {
      const { env } = await import("../src/lib/env");
      env.DEPLOYMENT_MODE = "managed";
      expect(isSelfHosted()).toBe(false);
      expect(isManagedCloud()).toBe(true);
    });
  });

  describe("checkLimit", () => {
    it("should allow everything in self-hosted mode", async () => {
      const { env } = await import("../src/lib/env");
      env.DEPLOYMENT_MODE = "self-hosted";

      const result = await checkLimit("any-user", "clients");
      
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(Infinity);
      expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
    });

    it("should enforce starter plan limits in managed mode", async () => {
      const { env } = await import("../src/lib/env");
      env.DEPLOYMENT_MODE = "managed";

      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        userId: "user-1",
        plan: "starter",
        invoicesCreated: 15,
        emailsSent: 10,
        paymentLinksUsed: 0,
      });

      // Starter maxInvoicesPerMonth is 15
      const result = await checkLimit("user-1", "invoicesPerMonth");
      
      expect(result.allowed).toBe(false); // 15 < 15 is false
      expect(result.current).toBe(15);
      expect(result.limit).toBe(15);
      expect(result.plan).toBe("starter");
    });

    it("should enforce pro plan limits when queried", async () => {
      const { env } = await import("../src/lib/env");
      env.DEPLOYMENT_MODE = "managed";

      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        userId: "user-2",
        plan: "pro",
        invoicesCreated: 100,
      });

      // Pro maxEmailsPerMonth is 500
      (prisma.client.count as jest.Mock).mockResolvedValue(10); // clients are unlimited

      const result = await checkLimit("user-2", "clients");
      
      expect(result.allowed).toBe(true); // 10 < Infinity is true
      expect(result.current).toBe(10);
      expect(result.limit).toBe(Infinity);
      expect(result.plan).toBe("pro");
    });
  });

  describe("incrementUsage", () => {
    it("should literally do nothing in self-hosted mode", async () => {
      const { env } = await import("../src/lib/env");
      env.DEPLOYMENT_MODE = "self-hosted";

      await incrementUsage("user-1", "invoicesCreated");
      
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it("should increment counter in managed mode", async () => {
      const { env } = await import("../src/lib/env");
      env.DEPLOYMENT_MODE = "managed";

      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        userId: "user-1",
        plan: "starter",
      });

      await incrementUsage("user-1", "emailsSent", 2);
      
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: {
          emailsSent: { increment: 2 },
        },
      });
    });
  });

  describe("resetAllUsageCounters", () => {
    it("should run updateMany query", async () => {
      (prisma.subscription.updateMany as jest.Mock).mockResolvedValue({ count: 5 });
      
      const result = await resetAllUsageCounters();
      
      expect(result.count).toBe(5);
      expect(prisma.subscription.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          emailsSent: 0,
          invoicesCreated: 0,
          paymentLinksUsed: 0,
        }),
        where: expect.objectContaining({
          status: expect.objectContaining({
            in: ["ACTIVE", "TRIALING"],
          }),
        }),
      }));
    });
  });
});
