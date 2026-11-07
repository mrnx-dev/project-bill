jest.mock("@/auth", () => ({ auth: jest.fn().mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1", role: "ADMIN" } }) }));
jest.mock("@/lib/audit-logger", () => ({ createAuditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/crypto", () => ({
  encrypt: jest.fn((v: string) => `enc(${v})`),
  decrypt: jest.fn((v: string) => v.replace(/^enc\((.*)\)$/, "$1")),
  maskSecret: jest.fn((v: string | null) => (v ? `****${v.slice(-4)}` : "")),
  isMaskedValue: jest.fn((v: string) => v.startsWith("****")),
}));
jest.mock("@/lib/prisma", () => {
  const prisma: any = { $executeRaw: jest.fn().mockResolvedValue(0), $transaction: jest.fn() };
  prisma.$transaction = jest.fn(async (cb: (tx: any) => Promise<unknown>) => cb(prisma));
  prisma.settings = { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() };
  prisma.organizationMember = {
    findUnique: jest.fn().mockResolvedValue({ id: "m1", userId: "u1", organizationId: "org1", role: "OWNER" }),
  };
  return { prisma };
});
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
  },
}));

import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

const req = (body: unknown) => ({ json: async () => body }) as unknown as Request;

describe("PUT /api/settings — SMTP fields", () => {
  beforeEach(() => jest.clearAllMocks());

  test("smtpPass is encrypted; host/port/user stored as plain strings", async () => {
    (prisma.settings.findFirst as jest.Mock).mockResolvedValue({ id: "s1", smtpPass: "enc(old)" });
    (prisma.settings.update as jest.Mock).mockImplementation(async ({ data }: any) => ({ id: "s1", ...data }));

    const { PUT } = await import("@/app/api/settings/route");
    await PUT(req({ smtpHost: "mail.acme.test", smtpPort: "587", smtpUser: "u@acme.test", smtpPass: "hunter2" }), {} as never);

    expect(encrypt).toHaveBeenCalledWith("hunter2");
    expect(prisma.settings.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        smtpHost: "mail.acme.test", smtpPort: "587", smtpUser: "u@acme.test", smtpPass: "enc(hunter2)",
      }),
    }));
  });

  test("a masked smtpPass from the form never overwrites the stored value", async () => {
    (prisma.settings.findFirst as jest.Mock).mockResolvedValue({ id: "s1", smtpPass: "enc(old)" });
    (prisma.settings.update as jest.Mock).mockImplementation(async ({ data }: any) => ({ id: "s1", ...data }));

    const { PUT } = await import("@/app/api/settings/route");
    await PUT(req({ smtpPass: "****ld12" }), {} as never);

    const data = (prisma.settings.update as jest.Mock).mock.calls[0][0].data;
    expect(data).not.toHaveProperty("smtpPass");
  });
});
import { integrationsSchema } from "@/lib/validations/settings";

describe("integrationsSchema — SMTP", () => {
  test("all four SMTP fields are optional strings", () => {
    expect(integrationsSchema.parse({})).toEqual({});
  });
  test("accepts a full SMTP payload and keeps values verbatim", () => {
    const parsed = integrationsSchema.parse({
      smtpHost: "mail.acme.test", smtpPort: "465", smtpUser: "u@acme.test", smtpPass: "hunter2",
    });
    expect(parsed.smtpPort).toBe("465");
  });
  test("no longer accepts resendApiKey", () => {
    expect(integrationsSchema.parse({ resendApiKey: "re_x" })).toEqual({});
  });
});

describe("GET /api/settings — smtpPass never leaks", () => {
  beforeEach(() => jest.clearAllMocks());

  test("stored smtpPass is masked in the response", async () => {
    (prisma.settings.findFirst as jest.Mock).mockResolvedValue({ id: "s1", smtpPass: "enc(real-secret)" });

    const { GET } = await import("@/app/api/settings/route");
    const res = await GET({} as never, {} as never);
    const body = (res as any).body;

    expect(body.smtpPass).toMatch(/^\*\*/);
    expect(JSON.stringify(body)).not.toContain("real-secret");
  });
});
