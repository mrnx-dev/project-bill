import { formatContextForPrompt } from "../src/lib/ai/context-builder";
import type { BusinessContext } from "../src/lib/ai/types";

// Mock prisma to prevent real DB connection
jest.mock("../src/lib/prisma", () => ({
  prisma: {
    settings: { findUnique: jest.fn() },
    client: { count: jest.fn(), findMany: jest.fn() },
    project: { count: jest.fn(), findMany: jest.fn() },
    invoice: { findMany: jest.fn(), aggregate: jest.fn(), count: jest.fn() },
  },
}));

describe("Context Builder", () => {
  describe("formatContextForPrompt", () => {
    const mockContext: BusinessContext = {
      companyInfo: {
        name: "Freelance Studio",
        email: "hello@studio.id",
        logoUrl: "https://example.com/logo.png",
      },
      stats: {
        totalClients: 10,
        activeProjects: 5,
        doneProjects: 8,
        totalPaid: 15000000,
        totalPending: 7500000,
        unpaidInvoices: 4,
        overdueInvoices: 2,
      },
      recentInvoices: [
        {
          id: "inv1",
          number: "INV-001",
          amount: 2000000,
          status: "paid",
          dueDate: new Date("2026-04-15"),
          projectName: "Website Redesign",
          clientName: "PT Maju",
        },
        {
          id: "inv2",
          number: "INV-002",
          amount: 1500000,
          status: "unpaid",
          dueDate: new Date("2026-03-01"),
          projectName: "Logo Design",
          clientName: "Startup XYZ",
        },
      ],
      upcomingDeadlines: [
        {
          title: "Mobile App V2",
          deadline: new Date("2026-05-01"),
          clientName: "Tech Corp",
          daysRemaining: 26,
        },
      ],
      topClients: [
        {
          name: "PT Maju",
          email: "info@maju.com",
          totalPaid: 8000000,
          totalPending: 2000000,
          projectCount: 4,
          activeProjectCount: 2,
        },
      ],
    };

    it("includes company info in output", () => {
      const output = formatContextForPrompt(mockContext);
      expect(output).toContain("Freelance Studio");
      expect(output).toContain("hello@studio.id");
    });

    it("includes financial overview with stats", () => {
      const output = formatContextForPrompt(mockContext);
      expect(output).toContain("Financial Overview");
      expect(output).toContain("Clients: 10 (5 active)");
      expect(output).toContain("Revenue Paid: Rp 15.000.000");
      expect(output).toContain("Unpaid Invoices: 4 (2 overdue)");
    });

    it("includes recent invoices when available", () => {
      const output = formatContextForPrompt(mockContext);
      expect(output).toContain("Recent Invoices");
      expect(output).toContain("INV-001");
      expect(output).toContain("✅ Paid");
      expect(output).toContain("⏳ Unpaid");
    });

    it("includes upcoming deadlines", () => {
      const output = formatContextForPrompt(mockContext);
      expect(output).toContain("Upcoming Deadlines");
      expect(output).toContain("Mobile App V2");
      expect(output).toContain("26 days left");
    });

    it("includes top clients by revenue", () => {
      const output = formatContextForPrompt(mockContext);
      expect(output).toContain("Top Clients by Revenue");
      expect(output).toContain("PT Maju");
      expect(output).toContain("Rp 8.000.000 earned");
    });

    it("skips empty sections", () => {
      const emptyContext: BusinessContext = {
        companyInfo: { name: "Test", email: "", logoUrl: undefined },
        stats: {
          totalClients: 0,
          activeProjects: 0,
          doneProjects: 0,
          totalPaid: 0,
          totalPending: 0,
          unpaidInvoices: 0,
          overdueInvoices: 0,
        },
        recentInvoices: [],
        upcomingDeadlines: [],
        topClients: [],
      };

      const output = formatContextForPrompt(emptyContext);
      expect(output).toContain("Company: Test");
      expect(output).not.toContain("Recent Invoices");
      expect(output).not.toContain("Upcoming Deadlines");
      expect(output).not.toContain("Top Clients by Revenue");
    });
  });
});
