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
