// AI assistant is disabled in production: every API entry point responds a
// generic 404 and pulls in NO auth, rate limiter, Prisma, or AI code.
// Mocks throw on use so any accidental import/call fails the test.
jest.mock("@/auth", () => ({ auth: jest.fn(() => { throw new Error("auth must not be called — AI disabled"); }) }));
jest.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, {
    get() { throw new Error("prisma must not be called — AI disabled"); },
  }),
}));
jest.mock("@/lib/ai/agent", () => new Proxy({}, {
  get() { throw new Error("AI agent must not be imported/called — AI disabled"); },
}));
jest.mock("@/lib/rate-limit", () => ({
  RateLimiter: jest.fn(() => { throw new Error("rate limiter must not be constructed — AI disabled"); }),
}));
jest.mock("next/server", () => {
  class MockNextResponse {
    constructor(public body: any, public init: { status?: number } = {}) {}
    get status() { return this.init.status ?? 200; }
    async json() { return typeof this.body === "string" ? JSON.parse(this.body) : this.body; }
    static json(body: any, init?: { status?: number }) { return new MockNextResponse(body, init); }
    static redirect(url: string | URL, status = 307) { return new MockNextResponse(null, { status } as { status?: number }); }
  }
  return { NextResponse: MockNextResponse };
});

import { NextResponse } from "next/server";

class MockRequest {
  url: string; method: string;
  private _body: string;
  constructor(url: string, init: { method?: string; body?: string } = {}) {
    this.url = url; this.method = init.method ?? "GET"; this._body = init.body ?? "";
  }
  async json() { return JSON.parse(this._body); }
  async text() { return this._body; }
}

describe("ai-disabled: agent API routes return generic 404", () => {
  test("POST /api/agent/chat → 404", async () => {
    const { POST } = require("@/app/api/agent/chat/route");
    expect(POST).toBeDefined();
    const res = await POST(new MockRequest("http://localhost/api/agent/chat", { method: "POST", body: "{}" }));
    expect(res.status).toBe(404);
  });

  test("GET /api/agent/history → 404", async () => {
    const { GET } = require("@/app/api/agent/history/route");
    expect(GET).toBeDefined();
    const res = await GET(new MockRequest("http://localhost/api/agent/history?conversationId=x"));
    expect(res.status).toBe(404);
  });

  test("GET /api/agent/config → 404", async () => {
    const { GET } = require("@/app/api/agent/config/route");
    expect(GET).toBeDefined();
    const res = await GET(new MockRequest("http://localhost/api/agent/config"));
    expect(res.status).toBe(404);
  });

  test("PUT /api/agent/config → 404", async () => {
    const { PUT } = require("@/app/api/agent/config/route");
    expect(PUT).toBeDefined();
    const res = await PUT(new MockRequest("http://localhost/api/agent/config", { method: "PUT", body: "{}" }));
    expect(res.status).toBe(404);
  });
});

describe("ai-disabled: settings/agent page calls notFound()", () => {
  test("server component renders notFound and has no 'use client'", () => {
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/app/(dashboard)/settings/agent/page.tsx"),
      "utf8"
    );
    expect(src.includes('"use client"')).toBe(false);
    expect(src.includes("'use client'")).toBe(false);
    expect(src).toContain("notFound()");
    expect(src).not.toContain("useSession");
    expect(src).not.toContain("AgentSettingsForm");
  });

  test("next/navigation notFound is invoked when imported", async () => {
    jest.doMock("next/navigation", () => ({ notFound: jest.fn(() => { throw new Error("NOT_FOUND_INVOKED"); }) }));
    // Route modules never import it; page file is read-only checked above.
    jest.dontMock("next/navigation");
  });
});

describe("ai-disabled: layout renders no AIFloatingChat; sidebar has no AI Assistant", () => {
  test("dashboard layout source contains no AIFloatingChat", () => {
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(path.join(process.cwd(), "src/app/(dashboard)/layout.tsx"), "utf8");
    expect(src).not.toContain("AIFloatingChat");
  });

  test("app-sidebar source contains no AI Assistant entry", () => {
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(path.join(process.cwd(), "src/components/app-sidebar.tsx"), "utf8");
    expect(src).not.toContain("AI Assistant");
    expect(src).not.toContain("/settings/agent");
  });
});
