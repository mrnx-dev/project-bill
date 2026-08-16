import { applyTenantScope, isTenantModel } from "@/lib/rls";

describe("isTenantModel", () => {
  test("Client is a tenant model", () => {
    expect(isTenantModel("Client")).toBe(true);
  });
  test("Organization is NOT a tenant model", () => {
    expect(isTenantModel("Organization")).toBe(false);
  });
  test("User is NOT a tenant model", () => {
    expect(isTenantModel("User")).toBe(false);
  });
  test("undefined is not a tenant model", () => {
    expect(isTenantModel(undefined)).toBe(false);
  });
});

describe("applyTenantScope — where mode", () => {
  test("injects organizationId into where when absent", () => {
    const out = applyTenantScope("Project", { where: { status: "to_do" } }, "org-1", "where");
    expect(out.where).toEqual({ status: "to_do", organizationId: "org-1" });
  });
  test("does NOT overwrite when organizationId already present", () => {
    const out = applyTenantScope("Project", { where: { organizationId: "org-2" } }, "org-1", "where");
    expect(out.where.organizationId).toBe("org-2");
  });
  test("does NOT inject when orgId is undefined", () => {
    const out = applyTenantScope("Project", { where: { status: "to_do" } }, undefined, "where");
    expect(out.where).toEqual({ status: "to_do" });
  });
  test("does NOT inject for a non-tenant model", () => {
    const out = applyTenantScope("User", { where: { email: "a@b.com" } }, "org-1", "where");
    expect(out.where).toEqual({ email: "a@b.com" });
  });
  test("initializes where when args.where is absent", () => {
    const out = applyTenantScope("Project", {}, "org-1", "where");
    expect(out.where).toEqual({ organizationId: "org-1" });
  });
});

describe("applyTenantScope — data mode (create)", () => {
  test("injects organizationId into data when absent", () => {
    const out = applyTenantScope("Project", { data: { title: "X" } }, "org-1", "data");
    expect(out.data).toEqual({ title: "X", organizationId: "org-1" });
  });
  test("does NOT overwrite when data.organizationId already present", () => {
    const out = applyTenantScope("Project", { data: { organizationId: "org-2" } }, "org-1", "data");
    expect(out.data.organizationId).toBe("org-2");
  });
});

describe("applyTenantScope — dataMany mode (createMany)", () => {
  test("injects into each row that lacks organizationId", () => {
    const out = applyTenantScope("ProjectItem", { data: [{ description: "a" }, { description: "b", organizationId: "org-2" }] }, "org-1", "dataMany");
    expect(out.data[0].organizationId).toBe("org-1");
    expect(out.data[1].organizationId).toBe("org-2");
  });
  test("returns args unchanged when data is not an array", () => {
    const out = applyTenantScope("ProjectItem", { data: {} }, "org-1", "dataMany");
    expect(out.data).toEqual({});
  });
});

import { withTenant, getTenantCtx } from "@/lib/rls";

// jsdom env lacks Request/Response globals (repo convention: polyfill, see
// accept-terms.test.ts). withTenant returns a plain Response, so only minimal
// stubs are needed for the assertions below.
class MockResponse {
  constructor(
    public body: any,
    public init: { status?: number } = {},
  ) {}
  get status() {
    return this.init.status ?? 200;
  }
}
class MockRequest {
  constructor(public url: string) {}
}
global.Response = MockResponse as any;
global.Request = MockRequest as any;

// Mock @/auth so withTenant does not need a real session.
jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

describe("withTenant", () => {
  test("returns 401 when there is no session", async () => {
    const { auth } = require("@/auth");
    auth.mockResolvedValue(null);
    const handler = withTenant(async () => new Response("ok"));
    const res = await handler(new Request("http://localhost/x"), {} as any);
    expect(res.status).toBe(401);
  });

  test("returns 401 when session has no activeOrganizationId", async () => {
    const { auth } = require("@/auth");
    auth.mockResolvedValue({ user: { id: "u1" } });
    const handler = withTenant(async () => new Response("ok"));
    const res = await handler(new Request("http://localhost/x"), {} as any);
    expect(res.status).toBe(401);
  });

  test("runs handler with tenant context set", async () => {
    const { auth } = require("@/auth");
    auth.mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org-1" } });
    let captured: any = null;
    const handler = withTenant(async () => {
      captured = getTenantCtx();
      return new Response("ok");
    });
    await handler(new Request("http://localhost/x"), {} as any);
    expect(captured).toEqual({ organizationId: "org-1", userId: "u1" });
  });

  test("preserves native handler signature (passes ctx through)", async () => {
    const { auth } = require("@/auth");
    auth.mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org-1" } });
    let receivedCtx: any = null;
    const handler = withTenant(async (_req, ctx) => {
      receivedCtx = ctx;
      return new Response("ok");
    });
    const ctx = { params: Promise.resolve({ id: "abc" }) };
    await handler(new Request("http://localhost/x"), ctx as any);
    expect(await receivedCtx.params).toEqual({ id: "abc" });
  });
});

describe("getTenantCtx", () => {
  test("returns undefined outside a withTenant run", () => {
    expect(getTenantCtx()).toBeUndefined();
  });
});
