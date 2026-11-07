// Object-level authorization tests for org-scoped routes.
// Repo convention (see milestone-invoice.test.ts): self-referential Prisma mock
// factory — NO jest.requireActual (the real @/lib/prisma imports @/lib/env which
// throws without .env).
jest.mock("@/lib/prisma", () => ({
  prisma: {
    exportJob: { findFirst: jest.fn() },
    organizationMember: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("next/server", () => {
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
  return { NextResponse: MockNextResponse };
});

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

class MockRequest {
  private _body: string;
  constructor(_url: string, init: { method?: string; body?: string } = {}) {
    this._body = init.body ?? "";
  }
  async json() {
    return JSON.parse(this._body);
  }
}

const helper = (over: Partial<{ id: string; userId: string; organizationId: string; role: string }> = {}) => ({
  id: "m1",
  userId: "u-target",
  organizationId: "org1",
  role: "MEMBER",
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe("GET export/status — object-level auth", () => {
  test("nonmember/non-owner rejected 403 and exportJob.findFirst never called", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1" } });
    (prisma.organizationMember.findUnique as jest.Mock).mockResolvedValue(null);

    const { GET } = require("@/app/api/organizations/[id]/export/status/route");
    const res = await GET(new MockRequest("http://x"), { params: Promise.resolve({ id: "org9" }) });

    expect(res.status).toBe(403);
    expect(prisma.exportJob.findFirst).not.toHaveBeenCalled();
  });

  test("member but not OWNER rejected 403", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1" } });
    (prisma.organizationMember.findUnique as jest.Mock).mockResolvedValue(helper({ role: "MEMBER" }));

    const { GET } = require("@/app/api/organizations/[id]/export/status/route");
    const res = await GET(new MockRequest("http://x"), { params: Promise.resolve({ id: "org1" }) });

    expect(res.status).toBe(403);
    expect(prisma.exportJob.findFirst).not.toHaveBeenCalled();
  });

  test("OWNER of the path org sees the job status", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1" } });
    (prisma.organizationMember.findUnique as jest.Mock).mockResolvedValue(helper({ role: "OWNER" }));
    (prisma.exportJob.findFirst as jest.Mock).mockResolvedValue({
      status: "PROCESSING",
      downloadUrl: null,
      completedAt: null,
    });

    const { GET } = require("@/app/api/organizations/[id]/export/status/route");
    const res = await GET(new MockRequest("http://x"), { params: Promise.resolve({ id: "org1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("PROCESSING");
    expect(prisma.exportJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org1" } })
    );
  });
});

describe("PATCH members/[memberId] — no cross-org update", () => {
  test("returns 404 and never updates when target member belongs to another org", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1" } });
    // requester is OWNER of path org org1
    (prisma.organizationMember.findUnique as jest.Mock)
      .mockResolvedValueOnce(helper({ role: "OWNER" })) // requester lookup
      .mockResolvedValueOnce(helper({ id: "m-other", organizationId: "org-other" })); // target lookup

    const { PATCH } = require("@/app/api/organizations/[id]/members/[memberId]/route");
    const req = new MockRequest("http://x", { method: "PATCH", body: JSON.stringify({ role: "MEMBER" }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: "org1", memberId: "m-other" }) });

    expect(res.status).toBe(404);
    expect(prisma.organizationMember.update).not.toHaveBeenCalled();
  });

  test("missing target member returns 404 without update", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1" } });
    (prisma.organizationMember.findUnique as jest.Mock)
      .mockResolvedValueOnce(helper({ role: "OWNER" }))
      .mockResolvedValueOnce(null);

    const { PATCH } = require("@/app/api/organizations/[id]/members/[memberId]/route");
    const req = new MockRequest("http://x", { method: "PATCH", body: JSON.stringify({ role: "MEMBER" }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: "org1", memberId: "m-gone" }) });

    expect(res.status).toBe(404);
    expect(prisma.organizationMember.update).not.toHaveBeenCalled();
  });

  test("OWNER updates a same-org member by that member's id", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1" } });
    (prisma.organizationMember.findUnique as jest.Mock)
      .mockResolvedValueOnce(helper({ role: "OWNER" }))
      .mockResolvedValueOnce(helper({ id: "m1", organizationId: "org1", role: "MEMBER" }));
    (prisma.organizationMember.update as jest.Mock).mockResolvedValue(helper({ role: "ADMIN" }));

    const { PATCH } = require("@/app/api/organizations/[id]/members/[memberId]/route");
    const req = new MockRequest("http://x", { method: "PATCH", body: JSON.stringify({ role: "ADMIN" }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: "org1", memberId: "m1" }) });

    expect(res.status).toBe(200);
    expect(prisma.organizationMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1" }, data: { role: "ADMIN" } })
    );
  });
});

describe("DELETE members/[memberId] — regression guard", () => {
  test("still refuses to remove an OWNER", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1" } });
    (prisma.organizationMember.findUnique as jest.Mock)
      .mockResolvedValueOnce(helper({ id: "m-owner", userId: "u-owner", organizationId: "org1", role: "OWNER" })) // target
      .mockResolvedValueOnce(helper({ role: "OWNER" })); // requester

    const { DELETE } = require("@/app/api/organizations/[id]/members/[memberId]/route");
    const res = await DELETE(new MockRequest("http://x"), { params: Promise.resolve({ id: "org1", memberId: "m-owner" }) });

    expect(res.status).toBe(403);
    expect(prisma.organizationMember.delete).not.toHaveBeenCalled();
  });

  test("allows removing a same-org regular member", async () => {
    // jest.clearAllMocks in beforeEach leaves a stale once-queue from the
    // OWNER-block test (it set two mockResolvedValueOnce entries and the route
    // consumed only the first); use mockReset to clear that queue.
    (prisma.organizationMember.findUnique as jest.Mock).mockReset();
    (prisma.organizationMember.delete as jest.Mock).mockReset();
    (auth as jest.Mock).mockReset();
    (auth as jest.Mock).mockResolvedValue({ user: { id: "u1", activeOrganizationId: "org1" } });
    (prisma.organizationMember.findUnique as jest.Mock)
      .mockResolvedValueOnce(helper({ id: "m1", organizationId: "org1" })) // target
      .mockResolvedValueOnce(helper({ role: "OWNER" })); // requester
    (prisma.organizationMember.delete as jest.Mock).mockResolvedValue(helper());

    const { DELETE } = require("@/app/api/organizations/[id]/members/[memberId]/route");
    const res = await DELETE(new MockRequest("http://x"), { params: Promise.resolve({ id: "org1", memberId: "m1" }) });

    expect(res.status).toBe(204);
    expect(prisma.organizationMember.delete as jest.Mock).toHaveBeenCalledWith({ where: { id: "m1" } });
  });
});
