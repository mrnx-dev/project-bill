import { isPublicPath } from "@/lib/proxy-paths";

describe("isPublicPath", () => {
  test("login is public", () => {
    expect(isPublicPath("/login")).toBe(true);
  });
  test("setup is public", () => {
    expect(isPublicPath("/setup")).toBe(true);
  });
  test("root is public", () => {
    expect(isPublicPath("/")).toBe(true);
  });
  test("public invoice view is public", () => {
    expect(isPublicPath("/invoices/abc-123")).toBe(true);
    expect(isPublicPath("/invoices/abc-123/print")).toBe(true);
    expect(isPublicPath("/invoices/abc-123/sow/print")).toBe(true);
  });
  test("dashboard invoice list is NOT public", () => {
    expect(isPublicPath("/invoices")).toBe(false);
  });
  test("invite token page is public", () => {
    expect(isPublicPath("/invite/sometoken")).toBe(true);
  });
  test("NextAuth handler is public", () => {
    expect(isPublicPath("/api/auth/callback/credentials")).toBe(true);
    expect(isPublicPath("/api/auth/signin")).toBe(true);
  });
  test("webhooks are public (verified by signature)", () => {
    expect(isPublicPath("/api/webhooks/mayar")).toBe(true);
  });
  test("cron endpoints are public (verified by CRON_SECRET)", () => {
    expect(isPublicPath("/api/cron/reminders")).toBe(true);
  });
  test("setup api is public", () => {
    expect(isPublicPath("/api/setup")).toBe(true);
  });
  test("public-sow api is public", () => {
    expect(isPublicPath("/api/invoices/abc/public-sow")).toBe(true);
    expect(isPublicPath("/api/projects/abc/public-sow")).toBe(true);
  });
  test("pay api is public", () => {
    expect(isPublicPath("/api/invoices/abc/pay")).toBe(true);
  });
  test("invite token api is public (POST still guarded by its own auth())", () => {
    expect(isPublicPath("/api/invites/sometoken")).toBe(true);
  });
  test("dashboard board is NOT public", () => {
    expect(isPublicPath("/board")).toBe(false);
  });
  test("projects api is NOT public", () => {
    expect(isPublicPath("/api/projects")).toBe(false);
    expect(isPublicPath("/api/projects/abc")).toBe(false);
  });
  test("invoice detail api is NOT public (only the public-sow/pay subpaths are)", () => {
    expect(isPublicPath("/api/invoices/abc")).toBe(false);
    expect(isPublicPath("/api/invoices/abc/mark-paid")).toBe(false);
  });
});
