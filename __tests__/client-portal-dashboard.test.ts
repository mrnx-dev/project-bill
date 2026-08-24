// jsdom lacks Request/Response globals — mock next/server (repo convention,
// see client-portal-auth.test.ts).
class MockHeaders {
  private h: Record<string, string>;
  constructor(init?: Record<string, string>) { this.h = { ...(init ?? {}) }; }
  get(k: string) { return this.h[k.toLowerCase()] ?? null; }
}
class MockNextResponse {
  constructor(public body: any, public init: { status?: number; headers?: Record<string, string> } = {}) {}
  get status() { return this.init.status ?? 200; }
  get headers() { return new MockHeaders(this.init.headers ?? {}); }
  async json() { return typeof this.body === "string" ? JSON.parse(this.body) : this.body; }
  static json(body: any, init?: { status?: number }) { return new MockNextResponse(body, init); }
  static redirect(url: string | URL, status = 307) { return new MockNextResponse(null, { status, headers: { location: String(url) } }); }
}
jest.mock("next/server", () => ({ NextResponse: MockNextResponse }));

jest.mock("@/lib/prisma", () => {
  const prisma: any = {
    invoice: { findMany: jest.fn() },
    project: { findMany: jest.fn(), findUnique: jest.fn() },
  };
  return { prisma };
});

jest.mock("@/lib/client-auth", () => ({
  getClientSession: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getClientSession } from "@/lib/client-auth";
import {
  getClientInvoices,
  getClientProjects,
  getClientOverview,
  getClientProjectSow,
} from "@/lib/client-portal-queries";

const SESSION = { clientId: "c1", organizationId: "org1", clientName: "Toko Makmur" };

describe("client-portal-queries — scoping", () => {
  beforeEach(() => jest.clearAllMocks());

  test("getClientInvoices scopes by clientId + organizationId, newest first", async () => {
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
    await getClientInvoices(SESSION);
    const arg = (prisma.invoice.findMany as jest.Mock).mock.calls[0][0];
    expect(arg.where).toEqual({ organizationId: "org1", project: { clientId: "c1" } });
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
  });

  test("getClientProjects scopes by clientId + organizationId, includes milestones + invoices", async () => {
    (prisma.project.findMany as jest.Mock).mockResolvedValue([]);
    await getClientProjects(SESSION);
    const arg = (prisma.project.findMany as jest.Mock).mock.calls[0][0];
    expect(arg.where).toEqual({ clientId: "c1", organizationId: "org1" });
    expect(arg.include).toEqual({ milestones: { include: { invoice: true } }, invoices: true });
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
  });

  test("getClientProjectSow scopes by id + clientId + organizationId (null if not client's)", async () => {
    (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);
    expect(await getClientProjectSow(SESSION, "p-other")).toBeNull();
    const arg = (prisma.project.findUnique as jest.Mock).mock.calls[0][0];
    expect(arg.where).toEqual({ id: "p-other", clientId: "c1", organizationId: "org1" });
  });
});

describe("client-portal-queries — shaping", () => {
  beforeEach(() => jest.clearAllMocks());

  test("getClientProjects computes progressPct + paidAmount (MILESTONE billing)", async () => {
    (prisma.project.findMany as jest.Mock).mockResolvedValue([
      {
        id: "p1", title: "Website", status: "in_progress", currency: "IDR",
        totalPrice: { toString: () => "10000000" }, billingMode: "MILESTONE", terms: "x",
        milestones: [
          { percentage: { toString: () => "30" }, invoice: { status: "paid" } },
          { percentage: { toString: () => "70" }, invoice: { status: "unpaid" } },
        ],
        invoices: [{ amount: { toString: () => "3000000" }, status: "paid" }],
      },
    ]);
    const [p] = await getClientProjects(SESSION);
    expect(p.progressPct).toBe(30);
    expect(p.paidAmount).toBe(3000000);
    expect(p.hasTerms).toBe(true);
  });

  test("getClientProjects: SIMPLE billing progress from paid/total", async () => {
    (prisma.project.findMany as jest.Mock).mockResolvedValue([
      {
        id: "p2", title: "Logo", status: "to_do", currency: "IDR",
        totalPrice: { toString: () => "2000000" }, billingMode: "SIMPLE", terms: null,
        milestones: [], invoices: [{ amount: { toString: () => "1000000" }, status: "paid" }],
      },
    ]);
    const [p] = await getClientProjects(SESSION);
    expect(p.progressPct).toBe(50);
    expect(p.hasTerms).toBe(false);
  });

  test("getClientOverview aggregates outstanding balance + unpaid count + active projects + recent", async () => {
    (prisma.invoice.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "i1", invoiceNumber: "INV-1", type: "dp", amount: { toString: () => "1000000" }, status: "unpaid", dueDate: null, createdAt: new Date(), project: { title: "A", currency: "IDR" } },
      { id: "i2", invoiceNumber: "INV-2", type: "full_payment", amount: { toString: () => "2000000" }, status: "paid", dueDate: null, createdAt: new Date(), project: { title: "B", currency: "IDR" } },
      { id: "i3", invoiceNumber: "INV-3", type: "dp", amount: { toString: () => "500000" }, status: "unpaid", dueDate: null, createdAt: new Date(), project: { title: "C", currency: "IDR" } },
    ]);
    (prisma.project.findMany as jest.Mock).mockResolvedValueOnce([
      { status: "in_progress", billingMode: "SIMPLE", totalPrice: { toString: () => "1" }, terms: null, milestones: [], invoices: [] },
      { status: "done", billingMode: "SIMPLE", totalPrice: { toString: () => "1" }, terms: null, milestones: [], invoices: [] },
      { status: "to_do", billingMode: "SIMPLE", totalPrice: { toString: () => "1" }, terms: null, milestones: [], invoices: [] },
    ]);
    const ov = await getClientOverview(SESSION);
    expect(ov.outstandingBalance).toBe(1500000);
    expect(ov.unpaidCount).toBe(2);
    expect(ov.activeProjectCount).toBe(2);
    expect(ov.recentInvoices).toHaveLength(3);
  });

  test("getClientProjectSow returns null when project has no terms", async () => {
    (prisma.project.findUnique as jest.Mock).mockResolvedValue({ title: "P", terms: null, language: "id", termsAcceptedAt: null, termsAcceptedUserAgent: null, client: { name: "C" } });
    expect(await getClientProjectSow(SESSION, "p1")).toBeNull();
  });
});

describe("GET /api/client-portal/invoices", () => {
  beforeEach(() => jest.clearAllMocks());

  test("no session → 401", async () => {
    (getClientSession as jest.Mock).mockResolvedValue(null);
    const { GET } = require("@/app/api/client-portal/invoices/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  test("session → scoped invoice list", async () => {
    (getClientSession as jest.Mock).mockResolvedValue(SESSION);
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([
      { id: "i1", invoiceNumber: "INV-1", type: "dp", amount: { toString: () => "1000000" }, status: "unpaid", dueDate: null, createdAt: new Date(), project: { title: "A", currency: "IDR" } },
    ]);
    const { GET } = require("@/app/api/client-portal/invoices/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].invoiceNumber).toBe("INV-1");
  });
});

describe("GET /api/client-portal/projects", () => {
  beforeEach(() => jest.clearAllMocks());

  test("no session → 401", async () => {
    (getClientSession as jest.Mock).mockResolvedValue(null);
    const { GET } = require("@/app/api/client-portal/projects/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  test("session → scoped project list with progress", async () => {
    (getClientSession as jest.Mock).mockResolvedValue(SESSION);
    (prisma.project.findMany as jest.Mock).mockResolvedValue([
      { id: "p1", title: "Website", status: "in_progress", currency: "IDR", totalPrice: { toString: () => "10000000" }, billingMode: "SIMPLE", terms: "x", milestones: [], invoices: [{ amount: { toString: () => "5000000" }, status: "paid" }] },
    ]);
    const { GET } = require("@/app/api/client-portal/projects/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json[0].progressPct).toBe(50);
  });
});