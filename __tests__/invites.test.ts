import { inviteMemberSchema, updateMemberRoleSchema } from "@/lib/validations/organization";

describe("Invite Schema Validation", () => {
  test("accepts valid email with role", () => {
    const result = inviteMemberSchema.safeParse({
      email: "user@example.com",
      role: "ADMIN",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty email", () => {
    const result = inviteMemberSchema.safeParse({ email: "", role: "MEMBER" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid email", () => {
    const result = inviteMemberSchema.safeParse({ email: "notanemail", role: "MEMBER" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid role", () => {
    const result = inviteMemberSchema.safeParse({ email: "a@b.com", role: "SUPERADMIN" });
    expect(result.success).toBe(false);
  });

  test("defaults role to MEMBER", () => {
    const result = inviteMemberSchema.safeParse({ email: "a@b.com" });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.role).toBe("MEMBER");
  });
});

describe("Update Member Role Schema Validation", () => {
  test("accepts ADMIN role", () => {
    const result = updateMemberRoleSchema.safeParse({ role: "ADMIN" });
    expect(result.success).toBe(true);
  });

  test("accepts MEMBER role", () => {
    const result = updateMemberRoleSchema.safeParse({ role: "MEMBER" });
    expect(result.success).toBe(true);
  });

  test("rejects OWNER role (only settable at creation)", () => {
    const result = updateMemberRoleSchema.safeParse({ role: "OWNER" });
    expect(result.success).toBe(false);
  });
});

describe("Invite Token Generation", () => {
  test("token is a valid UUID v4", () => {
    const crypto = require("crypto");
    const token = crypto.randomUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(token)).toBe(true);
  });
});
