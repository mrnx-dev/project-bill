// Signed-document lock tests. Reuses the mock pattern from milestone-invoice.test.ts:
// self-referential prisma mock (real @/lib/prisma imports @/lib/env which throws without .env),
// mocked auth, mocked next/server (jsdom lacks Request/Response globals), lazy route require.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

jest.mock("@/lib/prisma", () => {
  const prisma: any = {
    // in-memory world the route mocks read from
    _world: {
      projects: {} as Record<string, any>,
      items: {} as Record<string, any>,
      clients: {} as Record<string, any>,
      invoices: [] as any[],
      milestones: [] as any[],
    },
    project: {
      findFirst: jest.fn(({ where, include }: any) => {
        const matches = Object.values(prisma._world.projects).filter((p: any) =>
          (!where.id || p.id === where.id) &&
          (!where.clientId || p.clientId === where.clientId) &&
          (!where.organizationId || p.organizationId === where.organizationId) &&
          (!where.termsAcceptedAt ||
            (where.termsAcceptedAt.not !== null
              ? p.termsAcceptedAt !== null
              : true)),
        );
        const p = matches[0] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!p) return null;
        const out = { ...p };
        if (include?.invoices) out.invoices = prisma._world.invoices.filter((i: any) => i.projectId === p.id);
        if (include?.milestones) out.milestones = prisma._world.milestones.filter((m: any) => m.projectId === p.id);
        if (include?.items) out.items = Object.values(prisma._world.items).filter((i: any) => i.projectId === p.id);
        return out;
      }),
      findUnique: jest.fn((args: any) => prisma.project.findFirst(args)),
      update: jest.fn(({ data }: any) => data),
      create: jest.fn(({ data }: any) => data),
      delete: jest.fn(),
    },
    invoice: { deleteMany: jest.fn() },
    organizationMember: {
      findUnique: jest.fn().mockResolvedValue({ id: "m1", userId: "u1", organizationId: "org1", role: "OWNER" }),
    },
    projectItem: {
      findUnique: jest.fn(({ where: { id, organizationId } }: any) => {
        const item = prisma._world.items[id];
        if (!item || item.organizationId !== organizationId) return null;
        return item;
      }),
      delete: jest.fn(),
      create: jest.fn(({ data }: any) => data),
    },
    paymentMilestone: {
      findFirst: jest.fn(({ where: { projectId, status } }: any) =>
        prisma._world.milestones.find((m: any) => m.projectId === projectId && (!status || m.status === status)) || null),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    client: {
      findFirst: jest.fn(({ where: { id, organizationId }, include }: any) => {
        const c = prisma._world.clients[id];
        if (!c || c.organizationId !== organizationId) return null;
        const out = { ...c };
        if (include?.projects) out.projects = Object.values(prisma._world.projects).filter((p: any) => p.clientId === id);
        return out;
      }),
      update: jest.fn(({ where: { id }, data }: any) => ({ ...prisma._world.clients[id], ...data })),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(async (cb: (tx: any) => Promise<unknown>) => cb(prisma)),
    $executeRaw: jest.fn().mockResolvedValue(0), // withTenantRls: SET LOCAL app.current_tenant_id
  };
  return { prisma };
});
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/billing/subscription", () => ({
  checkOrgLimit: jest.fn().mockResolvedValue({ allowed: true }),
  incrementOrgUsage: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/event-emitter", () => ({ dispatchEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/audit-logger", () => ({ createAuditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// Repo convention (see milestone-invoice.test.ts): mock next/server to bypass jsdom's missing
// Request/Response globals.
class MockNextResponse {
  constructor(public body: any, public init: { status?: number } = {}) {}
  get status() {
    return this.init.status ?? 200;
  }
  async json() {
    return typeof this.body === "string" ? JSON.parse(this.body) : this.body;
  }
  static json(body: any, init?: { status?: number }) {
    return new MockNextResponse(body, init);
  }
}
jest.mock("next/server", () => ({ NextResponse: MockNextResponse }));

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
  constructor(url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
    this.url = url;
    this.method = init.method ?? "GET";
    this.headers = new MockHeaders(init.headers);
    this._body = init.body ?? "";
  }
  async json() {
    return JSON.parse(this._body);
  }
}
global.Request = MockRequest as unknown as typeof Request;

jest.setTimeout(15000);

const world = (prisma as any)._world; // eslint-disable-line @typescript-eslint/no-explicit-any

function seedProject(overrides: Record<string, unknown> = {}) {
  world.projects.p1 = {
    id: "p1", organizationId: "org1", clientId: "c1", title: "Proj",
    totalPrice: 100, billingMode: "SIMPLE", language: "id", terms: "some terms",
    termsAcceptedAt: null, ...overrides,
  };
}

function seedClient() {
  world.clients.c1 = { id: "c1", name: "Client", email: "c@x.io", phone: null, organizationId: "org1" };
}

const req = (body: unknown, method: string) =>
  new MockRequest("http://local", { method, body: JSON.stringify(body) }) as unknown as Request;

const ctx = (id = "p1", itemId?: string) =>
  ({
    params: Promise.resolve(itemId ? { id, itemId } : { id }),
    request: new MockRequest("http://local") as unknown as Request,
  }) as { params: Promise<{ id: string; itemId?: string }> };

const SIGN_MSG = "Cannot modify the contract after it has been signed.";

describe("signed-document lock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", role: "ADMIN", activeOrganizationId: "org1" } });
    world.projects = {};
    world.items = {};
    world.clients = {};
    world.invoices = [];
    world.milestones = [];
    seedClient();
    seedProject();
  });

  test("scope items cannot be added to a signed project", async () => {
    seedProject({ termsAcceptedAt: new Date() });
    const { POST } = await import("@/app/api/projects/[id]/items/route");
    const res = (await POST(req({ description: "x", price: 10 }, "POST"), ctx())) as any;
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(SIGN_MSG);
  });

  test("scope items cannot be deleted from a signed project", async () => {
    seedProject({ termsAcceptedAt: new Date() });
    world.items.i1 = { id: "i1", projectId: "p1", organizationId: "org1", price: 10 };
    const { DELETE } = await import("@/app/api/projects/[id]/items/[itemId]/route");
    const res = (await DELETE(req({}, "DELETE"), ctx("p1", "i1"))) as any;
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(SIGN_MSG);
  });

  test("the payment plan cannot change after signing", async () => {
    seedProject({ termsAcceptedAt: new Date(), billingMode: "MILESTONE" });
    const { PUT } = await import("@/app/api/projects/[id]/milestones/route");
    const res = (await PUT(
      req({ milestones: [{ name: "A", percentage: 100 }] }, "PUT"),
      ctx(),
    )) as any;
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(SIGN_MSG);
  });

  test("client identity is frozen once any of its projects is signed", async () => {
    seedProject({ termsAcceptedAt: new Date() });
    const { PATCH } = await import("@/app/api/clients/[id]/route");
    const res = (await PATCH(req({ name: "New Name" }, "PATCH"), ctx("c1"))) as any;
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(SIGN_MSG);
  });

  test("the printed contract body cannot be edited after signing", async () => {
    seedProject({ termsAcceptedAt: new Date(), terms: "## 1. Klausul" });
    const { PATCH } = await import("@/app/api/projects/[id]/route");
    const res = (await PATCH(req({ terms: "## 1. Klausul diubah" }, "PATCH"), ctx())) as any;
    expect(res.status).toBe(403);
  });

  test("a signed project cannot be deleted even when its invoices are paid", async () => {
    seedProject({ termsAcceptedAt: new Date() });
    world.invoices = [{ projectId: "p1", status: "PAID" }];
    const { DELETE } = await import("@/app/api/projects/[id]/route");
    const res = (await DELETE(req({}, "DELETE"), ctx())) as any;
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(SIGN_MSG);
  });

  // The inverse guard — the real regression risk.
  test("an unsigned, uninvoiced project keeps today's behaviour", async () => {
    const { POST } = await import("@/app/api/projects/[id]/items/route");
    const res = (await POST(req({ description: "x", price: 10 }, "POST"), ctx())) as any;
    expect(res.status).toBe(201);
    expect(res.status).not.toBe(200);
  });
});
