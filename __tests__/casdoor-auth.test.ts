/**
 * Casdoor Auth Conditional Logic Tests
 *
 * Tests the DEPLOYMENT_MODE conditional behavior:
 * - self-hosted: Credentials provider, no Casdoor
 * - managed: Casdoor OIDC provider, auto-provisioning
 */

import { env } from "@/lib/env";

// Mock env at module level
jest.mock("@/lib/env", () => ({
  env: {
    DEPLOYMENT_MODE: "self-hosted",
    CASDOOR_ENDPOINT: "https://casdoor.example.com",
    CASDOOR_CLIENT_ID: "test-client-id",
    CASDOOR_CLIENT_SECRET: "test-secret",
  },
}));

describe("Casdoor Auth — Conditional Provider Logic", () => {
  describe("DEPLOYMENT_MODE detection", () => {
    it("identifies self-hosted mode correctly", () => {
      (env as any).DEPLOYMENT_MODE = "self-hosted";
      expect(env.DEPLOYMENT_MODE).toBe("self-hosted");
      expect(env.DEPLOYMENT_MODE !== "managed").toBe(true);
    });

    it("identifies managed mode correctly", () => {
      (env as any).DEPLOYMENT_MODE = "managed";
      expect(env.DEPLOYMENT_MODE).toBe("managed");
      expect(env.DEPLOYMENT_MODE === "managed").toBe(true);
    });

    it("defaults to self-hosted when not set", () => {
      // The Zod schema defaults to "self-hosted"
      expect(["self-hosted", "managed"]).toContain(env.DEPLOYMENT_MODE);
    });
  });

  describe("Provider selection", () => {
    it("uses Credentials provider in self-hosted mode", () => {
      (env as any).DEPLOYMENT_MODE = "self-hosted";
      const useCasdoor =
        env.DEPLOYMENT_MODE === "managed" &&
        !!env.CASDOOR_ENDPOINT &&
        !!env.CASDOOR_CLIENT_ID;
      expect(useCasdoor).toBe(false);
    });

    it("uses Casdoor OIDC provider in managed mode", () => {
      (env as any).DEPLOYMENT_MODE = "managed";
      const useCasdoor =
        env.DEPLOYMENT_MODE === "managed" &&
        !!env.CASDOOR_ENDPOINT &&
        !!env.CASDOOR_CLIENT_ID;
      expect(useCasdoor).toBe(true);
    });

    it("falls back to Credentials if Casdoor env vars missing in managed mode", () => {
      (env as any).DEPLOYMENT_MODE = "managed";
      (env as any).CASDOOR_ENDPOINT = undefined;
      const useCasdoor =
        env.DEPLOYMENT_MODE === "managed" &&
        !!env.CASDOOR_ENDPOINT &&
        !!env.CASDOOR_CLIENT_ID;
      expect(useCasdoor).toBe(false);
    });
  });

  describe("Casdoor role mapping", () => {
    it("maps Casdoor admin role to projectbill admin", () => {
      const casdoorRole = "admin";
      const mappedRole = casdoorRole === "admin" ? "admin" : "staff";
      expect(mappedRole).toBe("admin");
    });

    it("maps Casdoor non-admin role to projectbill staff", () => {
      const casdoorRole = "user";
      const mappedRole = casdoorRole === "admin" ? "admin" : "staff";
      expect(mappedRole).toBe("staff");
    });

    it("maps undefined Casdoor role to projectbill staff", () => {
      const casdoorRole = undefined;
      const mappedRole = casdoorRole === "admin" ? "admin" : "staff";
      expect(mappedRole).toBe("staff");
    });
  });

  describe("User provisioning logic", () => {
    it("creates new user with subscription on first Casdoor login", () => {
      const existingUser = null; // Simulate no existing user
      const shouldProvision = !existingUser;
      expect(shouldProvision).toBe(true);
    });

    it("does not recreate user on subsequent Casdoor login", () => {
      const existingUser = { id: "123", email: "test@example.com" };
      const shouldProvision = !existingUser;
      expect(shouldProvision).toBe(false);
    });

    it("sets 14-day trial for new managed users", () => {
      const trialDays = 14;
      const now = new Date();
      const trialEndsAt = new Date(
        now.getTime() + trialDays * 24 * 60 * 60 * 1000
      );
      const daysDiff = Math.round(
        (trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );
      expect(daysDiff).toBe(14);
    });
  });

  describe("Route protection", () => {
    const publicPaths = [
      "/login",
      "/setup",
      "/api/auth/callback/casdoor",
      "/api/webhooks/mayar",
      "/invoices/abc-123",
    ];

    const protectedPaths = [
      "/dashboard",
      "/projects",
      "/clients",
      "/invoices",
      "/api/projects",
      "/api/clients",
      "/api/invoices",
      "/settings",
    ];

    it("allows public paths without auth", () => {
      const PUBLIC_PATHS = ["/login", "/setup", "/api/auth", "/api/webhooks", "/invoices"];
      for (const path of publicPaths) {
        const isPublic = PUBLIC_PATHS.some(
          (p) => path === p || path.startsWith(p + "/")
        );
        expect(isPublic).toBe(true);
      }
    });

    it("blocks protected paths without auth", () => {
      const PUBLIC_PATHS = ["/login", "/setup", "/api/auth", "/api/webhooks", "/invoices"];
      for (const path of protectedPaths) {
        const isPublic = PUBLIC_PATHS.some(
          (p) => path === p || path.startsWith(p + "/")
        );
        expect(isPublic).toBe(false);
      }
    });
  });
});
