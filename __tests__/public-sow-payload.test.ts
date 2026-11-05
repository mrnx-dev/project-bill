// __tests__/public-sow-payload.test.ts — mock next/server + @/lib/prisma, as in __tests__/accept-terms.test.ts
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/invoices/[id]/public-sow/route";

// jsdom has no global `Request` — hand the route a headers-only stub; it only reads `x-forwarded-for`.
// Also stub a typed global so the route module's Request annotation resolves at import time.
function mockRequestSetup() {
  class MockRequest {}
  global.Request = MockRequest as unknown as typeof Request;
}
mockRequestSetup();
const mockRequest = () => ({ headers: { get: () => null } }) as unknown as Request;

jest.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { findUnique: jest.fn() },
    settings: { findFirst: jest.fn() },
  },
}));

const ALLOWED = ["title","contractNumber","createdAt","deadline","totalPrice","currency",
  "taxName","taxRate","dpAmount","billingMode","language","terms","termsAcceptedAt",
  "termsAcceptedUserAgent","termsAcceptedSessionId","items","milestones","client","provider"];

test("payload key set is exactly the allow-list", async () => {
  (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
    id: "inv-1",
    organizationId: "org-1",
    project: {
      id: "p1", title: "Web", contractNumber: "SPK-202611-0001", createdAt: new Date("2026-11-01"),
      deadline: null, totalPrice: "100.0000", currency: "IDR", taxName: null, taxRate: null,
      dpAmount: null, billingMode: "SIMPLE", language: "id", terms: "Klausul",
      termsAcceptedAt: null, termsAcceptedUserAgent: null, termsAcceptedSessionId: null,
      organizationId: "org-1", clientId: "c1",
      items: [{ description: "Landing", quantity: null, rate: null, price: "100.0000" }],
      milestones: [{ name: "Tahap 1", percentage: "50.00", amount: "50.0000", dueDate: null, order: 0 }],
      client: { name: "Budi", email: "b@x.id", phone: "0812" },
    },
  });
  (prisma.settings.findFirst as jest.Mock).mockResolvedValue({
    companyName: "Studio A", companyAddress: "Jl. Mawar", companyEmail: "hi@a.id",
    companyWhatsApp: "62811", bankAccountNumber: "123", mayarApiKey: "key",
  });

  const res = await GET(mockRequest(), { params: Promise.resolve({ id: "inv-1" }) });
  const body = await res.json();

  expect(Object.keys(body).sort()).toEqual([...ALLOWED].sort());
  expect(body.id).toBeUndefined(); // the accept-terms key must not be handed out
  expect(Object.keys(body.client).sort()).toEqual(["email", "name", "phone"]);
  expect(Object.keys(body.provider).sort()).toEqual(["address", "email", "name", "whatsapp"]);
  expect(Object.keys(body.items[0]).sort()).toEqual(["description", "price", "quantity", "rate"]);
  expect(Object.keys(body.milestones[0]).sort()).toEqual(["amount", "dueDate", "name", "percentage"]);
  expect(JSON.stringify(body)).not.toContain("123");
  expect(JSON.stringify(body)).not.toContain("key");
  expect(body.totalPrice).toBe(100);      // Decimal already converted by the mapper
});

test("a terms-less project still 400s instead of rendering an empty agreement", async () => {
  (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
    id: "inv-1",
    organizationId: "org-1",
    project: { terms: null, organizationId: "org-1", clientId: "c1" },
  });

  const res = await GET(mockRequest(), { params: Promise.resolve({ id: "inv-1" }) });

  expect(res.status).toBe(400);
});
