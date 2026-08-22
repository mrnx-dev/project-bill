// --- Mock infrastructure (repo convention: jsdom lacks Request/Response globals;
// see milestone-invoice.test.ts / accept-terms.test.ts) ---
class MockHeaders {
  private h: Record<string, string>;
  constructor(init?: Record<string, string>) { this.h = { ...(init ?? {}) }; }
  get(k: string) { return this.h[k.toLowerCase()] ?? null; }
}
class MockRequest {
  url: string; method: string; headers: MockHeaders; private _body: string;
  constructor(url: string, init: { method?: string; body?: string; headers?: Record<string,string> } = {}) {
    this.url = url; this.method = init.method ?? "GET";
    this.headers = new MockHeaders(init.headers); this._body = init.body ?? "";
  }
  async json() { return JSON.parse(this._body); }
  async text() { return this._body; }
}
global.Request = MockRequest as unknown as typeof Request;

// Extended MockNextResponse: supports static redirect() + a headers getter (the verify
// route uses NextResponse.redirect and tests assert res.headers.get("location")).
class MockNextResponse {
  constructor(public body: any, public init: { status?: number; headers?: Record<string,string> } = {}) {}
  get status() { return this.init.status ?? 200; }
  get headers() { return new MockHeaders(this.init.headers ?? {}); }
  async json() { return typeof this.body === "string" ? JSON.parse(this.body) : this.body; }
  static json(body: any, init?: { status?: number }) { return new MockNextResponse(body, init); }
  static redirect(url: string | URL, status = 307) { return new MockNextResponse(null, { status, headers: { location: String(url) } }); }
}
jest.mock("next/server", () => ({ NextResponse: MockNextResponse }));

// next/headers cookies stub (shared by verify/logout/getClientSession tests)
const cookieStore: Record<string, string> = {};
jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    get: (k: string) => (cookieStore[k] ? { value: cookieStore[k] } : undefined),
    set: (k: string, v: string) => { cookieStore[k] = v; },
    delete: (k: string) => { delete cookieStore[k]; },
  })),
}));

// prisma (self-referential; no requireActual — real @/lib/prisma imports @/lib/env)
jest.mock("@/lib/prisma", () => {
  const prisma: any = {
    client: { findMany: jest.fn(), findFirst: jest.fn() },
    clientAuth: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(async (cb: (tx: any) => Promise<unknown>) => cb(prisma)),
  };
  return { prisma };
});
jest.mock("@/lib/env", () => ({ env: { AUTH_SECRET: "test-auth-secret", APP_URL: "http://localhost:3000" } }));
jest.mock("@/lib/email", () => ({ sendMagicLinkEmail: jest.fn().mockResolvedValue({ success: true }) }));
// Rate-limit: the module-level limiter would persist across tests; mock so check() always allows.
jest.mock("@/lib/rate-limit", () => ({ RateLimiter: jest.fn().mockImplementation(() => ({ check: () => ({ success: true }) })) }));

import { prisma } from "@/lib/prisma";
import { sendMagicLinkEmail } from "@/lib/email";
import { generateToken, hashToken, signSession, COOKIE_NAME } from "@/lib/client-auth";

describe("POST /api/client-portal/auth/request", () => {
  beforeEach(() => jest.clearAllMocks());

  test("valid email + client exists → upsert ClientAuth (hash stored, not raw) + email + 200", async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValue([
      { id: "c1", name: "Toko Makmur", email: "c@x.com", isArchived: false, organizationId: "org1" },
    ]);
    (prisma.clientAuth.upsert as jest.Mock).mockResolvedValue({});

    const { POST } = require("@/app/api/client-portal/auth/request/route");
    const req = new Request("http://localhost/api/client-portal/auth/request", {
      method: "POST",
      body: JSON.stringify({ email: "c@x.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prisma.clientAuth.upsert).toHaveBeenCalled();
    const upsertArg = (prisma.clientAuth.upsert as jest.Mock).mock.calls[0][0];
    expect(upsertArg.create.magicLinkTokenHash).not.toBeUndefined();
    expect(upsertArg.create.magicLinkTokenHash).toMatch(/^[0-9a-f]{64}$/); // a hash, not the raw token
    expect(sendMagicLinkEmail).toHaveBeenCalledTimes(1);
  });

  test("unknown email → 200 but NO ClientAuth write (anti-enumeration)", async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
    const { POST } = require("@/app/api/client-portal/auth/request/route");
    const req = new Request("http://localhost/api/client-portal/auth/request", {
      method: "POST",
      body: JSON.stringify({ email: "nobody@x.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prisma.clientAuth.upsert).not.toHaveBeenCalled();
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  });

  test("email matches 2 orgs → 2 tokens + email with 2 links (multi-org)", async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValue([
      { id: "c1", name: "A", email: "c@x.com", isArchived: false, organizationId: "org1" },
      { id: "c2", name: "B", email: "c@x.com", isArchived: false, organizationId: "org2" },
    ]);
    (prisma.clientAuth.upsert as jest.Mock).mockResolvedValue({});

    const { POST } = require("@/app/api/client-portal/auth/request/route");
    const req = new Request("http://localhost/api/client-portal/auth/request", {
      method: "POST",
      body: JSON.stringify({ email: "c@x.com" }),
    });
    await POST(req);
    expect(prisma.clientAuth.upsert).toHaveBeenCalledTimes(2);
    expect(sendMagicLinkEmail).toHaveBeenCalledTimes(1);
    const emailArg = (sendMagicLinkEmail as jest.Mock).mock.calls[0][0];
    expect(emailArg.links.length).toBe(2);
  });

  test("skips archived clients and clients without email", async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValue([
      { id: "c1", name: "Archived", email: "a@x.com", isArchived: true, organizationId: "org1" },
      { id: "c2", name: "NoEmail", email: null, isArchived: false, organizationId: "org1" },
    ]);
    const { POST } = require("@/app/api/client-portal/auth/request/route");
    const req = new Request("http://localhost/api/client-portal/auth/request", {
      method: "POST",
      body: JSON.stringify({ email: "a@x.com" }),
    });
    await POST(req);
    expect(prisma.clientAuth.upsert).not.toHaveBeenCalled();
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  });
});

describe("GET /api/client-portal/auth/verify (route handler)", () => {
  beforeEach(() => { jest.clearAllMocks(); for (const k in cookieStore) delete cookieStore[k]; });

  test("valid token → mark used + clear hash + set cookie + redirect /portal", async () => {
    const token = generateToken();
    (prisma.clientAuth.findFirst as jest.Mock).mockResolvedValue({
      id: "ca1", clientId: "c1", organizationId: "org1",
      magicLinkTokenHash: hashToken(token),
      magicLinkExpiresAt: new Date(Date.now() + 60000),
      magicLinkUsedAt: null,
      sessionVersion: 0,
    });
    (prisma.clientAuth.update as jest.Mock).mockResolvedValue({});

    const { GET } = require("@/app/api/client-portal/auth/verify/route");
    const req = new Request("http://localhost/api/client-portal/auth/verify?t=" + token);
    const res = await GET(req);
    expect(res.status).toBe(307); // redirect
    expect(prisma.clientAuth.update).toHaveBeenCalled(); // mark used + clear hash
    expect(cookieStore[COOKIE_NAME]).toBeDefined(); // cookie set
  });

  test("expired token → redirect to /portal/login?error (no cookie set)", async () => {
    const token = generateToken();
    (prisma.clientAuth.findFirst as jest.Mock).mockResolvedValue({
      clientId: "c1", magicLinkTokenHash: hashToken(token),
      magicLinkExpiresAt: new Date(Date.now() - 1000), // expired
      magicLinkUsedAt: null, sessionVersion: 0,
    });
    const { GET } = require("@/app/api/client-portal/auth/verify/route");
    const req = new Request("http://localhost/api/client-portal/auth/verify?t=" + token);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect((res.headers.get("location") || "").includes("/portal/login")).toBe(true);
    expect(cookieStore[COOKIE_NAME]).toBeUndefined();
  });

  test("already-used token → redirect to login (reuse fail)", async () => {
    const token = generateToken();
    (prisma.clientAuth.findFirst as jest.Mock).mockResolvedValue({
      clientId: "c1", magicLinkTokenHash: hashToken(token),
      magicLinkExpiresAt: new Date(Date.now() + 60000),
      magicLinkUsedAt: new Date(), // already used
      sessionVersion: 0,
    });
    const { GET } = require("@/app/api/client-portal/auth/verify/route");
    const res = await GET(new Request("http://localhost/api/client-portal/auth/verify?t=" + token));
    expect(res.status).toBe(307);
    expect(cookieStore[COOKIE_NAME]).toBeUndefined();
  });

  test("hash mismatch / unknown token → redirect to login", async () => {
    (prisma.clientAuth.findFirst as jest.Mock).mockResolvedValue(null);
    const { GET } = require("@/app/api/client-portal/auth/verify/route");
    const res = await GET(new Request("http://localhost/api/client-portal/auth/verify?t=bogus"));
    expect(res.status).toBe(307);
    expect(cookieStore[COOKIE_NAME]).toBeUndefined();
  });
});
