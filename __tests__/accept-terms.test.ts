import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/projects/[id]/accept-terms/route";

// Mock next/server to bypass Request/Response type errors in jsdom
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      json: async () => body,
      status: init?.status || 200,
    })),
  },
}));

// Provide a dummy Request class for the test environment
class MockRequest {
  url: string;
  method: string;
  headers: { get: (name: string) => string | null };
  body: string | null;

  constructor(
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ) {
    this.url = url;
    this.method = init?.method || "GET";
    this.body = init?.body ?? null;
    const headerMap = new Map(
      Object.entries(init?.headers || { "content-type": "application/json" }),
    );
    this.headers = {
      get: (name: string) => headerMap.get(name.toLowerCase()) || null,
    };
  }

  async json() {
    return JSON.parse(this.body ?? "{}");
  }
}
// Cast it as any to bypass strict Request typing in the test global
global.Request = MockRequest as unknown as typeof Request;

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      findUnique: jest.fn(),
    },
  },
}));

describe("PATCH /api/projects/[id]/accept-terms", () => {
  beforeEach(() => {
    // The handler now proves the caller holds the matching invoice — default stub so
    // the existing cases reach the project. cleared again by afterEach.
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ projectId: "1" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 when invoiceId is missing", async () => {
    const request = new MockRequest(
      "http://localhost:3000/api/projects/1/accept-terms",
      { method: "PATCH", body: "{}" },
    );

    const response = await PATCH(request as unknown as Request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("invoiceId is required");
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it("should return 403 when the invoice belongs to a different project", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ projectId: "other" });

    const request = new MockRequest(
      "http://localhost:3000/api/projects/1/accept-terms",
      { method: "PATCH", body: JSON.stringify({ invoiceId: "inv-1" }) },
    );

    const response = await PATCH(request as unknown as Request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Invoice does not match project");
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it("should return 403 when the invoice does not exist", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new MockRequest(
      "http://localhost:3000/api/projects/1/accept-terms",
      { method: "PATCH", body: JSON.stringify({ invoiceId: "inv-1" }) },
    );

    const response = await PATCH(request as unknown as Request, {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(403);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it("should return 404 if project is not found", async () => {
    (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new MockRequest(
      "http://localhost:3000/api/projects/1/accept-terms",
      { method: "PATCH", body: JSON.stringify({ invoiceId: "inv-1" }) },
    );

    const response = await PATCH(request as unknown as Request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Project not found");
  });

  it("should return 400 if project has no terms", async () => {
    (prisma.project.findUnique as jest.Mock).mockResolvedValue({
      terms: null,
      termsAcceptedAt: null,
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });

    const request = new MockRequest(
      "http://localhost:3000/api/projects/1/accept-terms",
      { method: "PATCH", body: JSON.stringify({ invoiceId: "inv-1" }) },
    );

    const response = await PATCH(request as unknown as Request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("This project has no terms to accept");
  });

  it("should return 400 if terms are already accepted", async () => {
    (prisma.project.findUnique as jest.Mock).mockResolvedValue({
      terms: "Some terms",
      termsAcceptedAt: new Date(),
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });

    const request = new MockRequest(
      "http://localhost:3000/api/projects/1/accept-terms",
      { method: "PATCH", body: JSON.stringify({ invoiceId: "inv-1" }) },
    );

    const response = await PATCH(request as unknown as Request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Terms have already been accepted");
  });

  it("should successfully accept terms and return 200", async () => {
    const fakeDate = new Date();
    const fakeSessionId = "fake-session-id";

    // Mock crypto.randomUUID
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: () => fakeSessionId
      }
    });

    (prisma.project.findUnique as jest.Mock).mockResolvedValue({
      terms: "Some terms",
      termsAcceptedAt: null,
      termsVersionId: 0,
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });

    (prisma.project.update as jest.Mock).mockResolvedValue({
      termsAcceptedAt: fakeDate,
    });

    const request = new MockRequest(
      "http://localhost:3000/api/projects/1/accept-terms",
      {
        method: "PATCH",
        headers: { "user-agent": "Test Browser" },
        body: JSON.stringify({ invoiceId: "inv-1" }),
      },
    );

    const response = await PATCH(request as unknown as Request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: {
        termsAcceptedAt: expect.any(Date),
        termsAcceptedUserAgent: "Test Browser",
        termsAcceptedSessionId: fakeSessionId,
        termsVersionId: 1,
      },
    });
  });
});
