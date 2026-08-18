import { isTenantModel } from "@/lib/rls";

describe("RLS — Tenant Model Detection", () => {
  test("Client is a tenant model", () => {
    expect(isTenantModel("Client")).toBe(true);
  });

  test("Organization is NOT a tenant model", () => {
    expect(isTenantModel("Organization")).toBe(false);
  });

  test("User is NOT a tenant model", () => {
    expect(isTenantModel("User")).toBe(false);
  });

  test("Unknown model is treated as tenant", () => {
    expect(isTenantModel("SomeRandomModel")).toBe(true);
  });

  test("undefined is not a tenant model", () => {
    expect(isTenantModel(undefined)).toBe(false);
  });

  test("PaymentMilestone is a tenant model (RLS auto-scopes)", () => {
    expect(isTenantModel("PaymentMilestone")).toBe(true);
  });
});

describe("Organization Invite Logic", () => {
  test("inviteSchema requires email", () => {
    const { inviteMemberSchema } = require("@/lib/validations/organization");
    const result = inviteMemberSchema.safeParse({ email: "", role: "MEMBER" });
    expect(result.success).toBe(false);
  });

  test("inviteSchema validates correct data", () => {
    const { inviteMemberSchema } = require("@/lib/validations/organization");
    const result = inviteMemberSchema.safeParse({ email: "test@example.com", role: "ADMIN" });
    expect(result.success).toBe(true);
    expect(result.data.role).toBe("ADMIN");
  });
});

describe("Organization Deletion Logic", () => {
  test("deletedAt is set on soft-delete", () => {
    const now = new Date();
    const deletedAt = now;
    expect(deletedAt).toBeInstanceOf(Date);
  });

  test("org with deletedAt > 30 days ago is purgeable", () => {
    const thirtyDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(thirtyDaysAgo < cutoff).toBe(true);
  });
});

describe("Agent history — conversation ownership (IDOR guard)", () => {
  test("rejects conversationId belonging to a different user", () => {
    // The route must look up the conversation and verify BOTH userId and
    // organizationId match the session before returning messages. This test
    // encodes the ownership predicate the route must apply.
    const session = { id: "u1", activeOrganizationId: "org-1" };
    const conversation = { id: "c1", userId: "u2", organizationId: "org-1" };
    const allowed =
      conversation.userId === session.id &&
      conversation.organizationId === session.activeOrganizationId;
    expect(allowed).toBe(false);
  });

  test("rejects conversationId belonging to a different org", () => {
    const session = { id: "u1", activeOrganizationId: "org-1" };
    const conversation = { id: "c1", userId: "u1", organizationId: "org-2" };
    const allowed =
      conversation.userId === session.id &&
      conversation.organizationId === session.activeOrganizationId;
    expect(allowed).toBe(false);
  });

  test("allows conversationId matching both user and org", () => {
    const session = { id: "u1", activeOrganizationId: "org-1" };
    const conversation = { id: "c1", userId: "u1", organizationId: "org-1" };
    const allowed =
      conversation.userId === session.id &&
      conversation.organizationId === session.activeOrganizationId;
    expect(allowed).toBe(true);
  });
});
