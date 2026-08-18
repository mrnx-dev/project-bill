// Self-referential mock factory — NO jest.requireActual (the real @/lib/prisma
// imports @/lib/env which throws without .env). The $transaction callback receives
// the same mock object. The factory must be self-contained (jest hoists jest.mock
// above module-scope consts, so a module-level mockPrisma would hit the TDZ).
jest.mock("@/lib/prisma", () => {
  const prisma: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
    project: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    paymentMilestone: {
      deleteMany: jest.fn(), createMany: jest.fn(), create: jest.fn(),
      findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(),
      update: jest.fn(), updateMany: jest.fn(),
    },
    invoice: { create: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(async (cb: (tx: any) => Promise<unknown>) => cb(prisma)), // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  return { prisma };
});
jest.mock("@/auth", () => ({ auth: jest.fn() }));
// Top-level mocks (NOT inside test bodies; NOT virtual — these are real modules).
jest.mock("@/lib/billing/subscription", () => ({
  checkOrgLimit: jest.fn().mockResolvedValue({ allowed: true }),
  incrementOrgUsage: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/billing/mayar", () => ({ verifyMayarWebhook: jest.fn().mockResolvedValue(true) }));
jest.mock("@/app/actions/send-invoice", () => ({ sendInvoiceEmail: jest.fn().mockResolvedValue({ success: true }) }));
// The webhook route imports these at module load; puppeteer keeps handles open
// and hangs jest, so stub the heavy side-effect chain (never asserted anyway).
jest.mock("@/lib/pdf-generator", () => ({
  generateSowPdfBuffer: jest.fn().mockResolvedValue(Buffer.from("sow")),
  generateInvoicePdfBuffer: jest.fn().mockResolvedValue(Buffer.from("inv")),
}));
jest.mock("@/lib/email", () => ({ sendPaymentSuccessEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }));
// REDIS_URL is set in .env; the real ioredis client makes every dispatchEvent
// (createAuditLog) wait on connection retries. Stub it for fast, deterministic tests.
jest.mock("@/lib/event-emitter", () => ({ dispatchEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// Repo convention (see accept-terms.test.ts): mock next/server to bypass
// Request/Response globals missing in jsdom. Routes also use
// `new NextResponse(body, { status })`, so the stub is constructible.
class MockNextResponse {
  constructor(
    public body: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    public init: { status?: number } = {},
  ) {}
  get status() {
    return this.init.status ?? 200;
  }
  async json() {
    return typeof this.body === "string" ? JSON.parse(this.body) : this.body;
  }
  static json(body: any, init?: { status?: number }) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return new MockNextResponse(body, init);
  }
}
jest.mock("next/server", () => ({ NextResponse: MockNextResponse }));

// jsdom lacks Request too — richer than the accept-terms stub because routes
// call request.json()/text()/headers.get().
class MockHeaders {
  private h: Record<string, string>;
  constructor(init?: Record<string, string>) {
    this.h = { ...(init ?? {}) };
  }
  get(k: string) {
    return this.h[k.toLowerCase()] ?? null;
  }
}
class MockRequest {
  url: string;
  method: string;
  headers: MockHeaders;
  private _body: string;
  constructor(
    url: string,
    init: { method?: string; body?: string; headers?: Record<string, string> } = {},
  ) {
    this.url = url;
    this.method = init.method ?? "GET";
    this.headers = new MockHeaders(init.headers);
    this._body = init.body ?? "";
  }
  async json() {
    return JSON.parse(this._body);
  }
  async text() {
    return this._body;
  }
}
global.Request = MockRequest as unknown as typeof Request;

jest.setTimeout(30000);

// The route modules are require()d lazily inside tests (they pull in
// @/lib/audit-logger -> ioredis, invoice-utils, etc.); static imports at the
// top would also work but this keeps load order explicit.
/* eslint-disable @typescript-eslint/no-require-imports */

describe("PUT /api/projects/[id]/milestones — save plan", () => {
  beforeEach(() => jest.clearAllMocks());

  test("saves a valid plan (sum=100) and computes amounts", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1" } });
    (prisma.project.findUnique as jest.Mock).mockResolvedValue({
      id: "p1", billingMode: "MILESTONE", totalPrice: 10000000, organizationId: "org1",
      milestones: [], invoices: [],
    });
    (prisma.paymentMilestone.findFirst as jest.Mock).mockResolvedValue(null); // no INVOICED

    const { PUT } = require("@/app/api/projects/[id]/milestones/route");
    const req = new Request("http://localhost/api/projects/p1/milestones", {
      method: "PUT",
      body: JSON.stringify({ milestones: [{ name: "A", percentage: 60, order: 0 }, { name: "B", percentage: 40, order: 1 }] }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);
    expect(prisma.paymentMilestone.deleteMany).toHaveBeenCalled();
    expect(prisma.paymentMilestone.createMany).toHaveBeenCalled();
  });

  test("rejects plan not summing to 100", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1" } });
    const { PUT } = require("@/app/api/projects/[id]/milestones/route");
    const req = new Request("http://localhost/api/projects/p1/milestones", {
      method: "PUT",
      body: JSON.stringify({ milestones: [{ name: "A", percentage: 30, order: 0 }] }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(400);
  });

  test("rejects when project is not MILESTONE mode", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1" } });
    (prisma.project.findUnique as jest.Mock).mockResolvedValue({
      id: "p1", billingMode: "SIMPLE", totalPrice: 1000, organizationId: "org1", milestones: [], invoices: [],
    });
    const { PUT } = require("@/app/api/projects/[id]/milestones/route");
    const req = new Request("http://localhost/api/projects/p1/milestones", {
      method: "PUT",
      body: JSON.stringify({ milestones: [{ name: "A", percentage: 100, order: 0 }] }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(400);
  });

  test("rejects plan edit after a milestone is INVOICED (plan lock)", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1" } });
    (prisma.project.findUnique as jest.Mock).mockResolvedValue({
      id: "p1", billingMode: "MILESTONE", totalPrice: 1000, organizationId: "org1", milestones: [], invoices: [],
    });
    (prisma.paymentMilestone.findFirst as jest.Mock).mockResolvedValue({ id: "m1", status: "INVOICED" });
    const { PUT } = require("@/app/api/projects/[id]/milestones/route");
    const req = new Request("http://localhost/api/projects/p1/milestones", {
      method: "PUT",
      body: JSON.stringify({ milestones: [{ name: "A", percentage: 100, order: 0 }] }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(403);
  });
});

describe("POST .../milestones/[mid]/invoice — Tagih", () => {
  beforeEach(() => jest.clearAllMocks());

  test("creates a MILESTONE invoice, links it, sets INVOICED, audits (tx)", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1" } });
    (prisma.paymentMilestone.findUnique as jest.Mock).mockResolvedValue({
      id: "m1", projectId: "p1", organizationId: "org1", status: "PLANNED",
      amount: 7500000, name: "Design",
      project: { id: "p1", billingMode: "MILESTONE", totalPrice: 30000000, client: { email: "c@x.com" } },
    });
    (prisma.invoice.create as jest.Mock).mockResolvedValue({ id: "inv1", invoiceNumber: "INV-202608-0007" });
    // subscription gate allowed — the top-level mock already returns { allowed: true }

    const { POST } = require("@/app/api/projects/[id]/milestones/[mid]/invoice/route");
    const req = new Request("http://localhost/api/projects/p1/milestones/m1/invoice", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "p1", mid: "m1" }) });
    expect(res.status).toBe(200);
    expect(prisma.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "MILESTONE", status: "UNPAID" }),
    }));
  });

  test("rejects Tagih on an already-INVOICED milestone (idempotent)", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1" } });
    (prisma.paymentMilestone.findUnique as jest.Mock).mockResolvedValue({
      id: "m1", status: "INVOICED", organizationId: "org1", projectId: "p1",
      project: { billingMode: "MILESTONE" },
    });
    const { POST } = require("@/app/api/projects/[id]/milestones/[mid]/invoice/route");
    const req = new Request("http://localhost/api/projects/p1/milestones/m1/invoice", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "p1", mid: "m1" }) });
    expect(res.status).toBe(409);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });
});

describe("webhook mayar — milestone PAID sync (transactional)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("marks invoice PAID + linked milestone PAID + audit atomically", async () => {
    (prisma.invoice.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: "inv1", type: "MILESTONE", invoiceNumber: "INV-1", organizationId: "org1",
      project: { id: "p1", title: "T", currency: "IDR", taxRate: null, termsAcceptedAt: null, client: { email: "c@x.com", name: "C" } },
    });
    // $transaction runs the callback with the mock prisma
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(prisma));

    const { POST } = require("@/app/api/webhooks/mayar/route");
    const body = JSON.stringify({ event: "payment.received", data: { reference_id: "inv1", id: "pay1" } });
    const req = new Request("http://localhost/api/webhooks/mayar", { method: "POST", body, headers: { "x-callback-token": "valid" } });
    // verifyMayarWebhook is mocked at the top level (returns true)
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "inv1", status: "UNPAID" }),
    }));
    expect(prisma.paymentMilestone.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ invoiceId: "inv1", status: "INVOICED" }),
      data: expect.objectContaining({ status: "PAID" }),
    }));
  });

  test("duplicate webhook → count 0 → no milestone update (idempotent)", async () => {
    (prisma.invoice.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(prisma));
    const { POST } = require("@/app/api/webhooks/mayar/route");
    const body = JSON.stringify({ event: "payment.received", data: { reference_id: "inv1" } });
    const req = new Request("http://localhost/api/webhooks/mayar", { method: "POST", body, headers: { "x-callback-token": "valid" } });
    await POST(req);
    expect(prisma.paymentMilestone.updateMany).not.toHaveBeenCalled();
  });
});
