import { queryInvoices, queryProjects, analyzeCashflow, getClientDetails, executeTool } from "../src/lib/ai/tools";
import { prisma } from "../src/lib/prisma";

jest.mock("../src/lib/prisma", () => ({
  prisma: {
    invoice: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    project: {
      findMany: jest.fn(),
    },
    client: {
      findMany: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("AI Tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("queryInvoices", () => {
    it("returns invoices without filters", async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: "inv1",
          invoiceNumber: "INV-001",
          amount: 500000,
          status: "paid",
          project: { title: "Website Redesign", client: { name: "PT Maju" } },
        },
      ] as any);

      const result = await queryInvoices({});
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].number).toBe("INV-001");
      expect(result.data[0].status).toBe("paid");
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, take: 10, orderBy: { createdAt: "desc" } }),
      );
    });

    it("filters by status", async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      await queryInvoices({ status: "unpaid", limit: 5 });
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: "unpaid" }, take: 5 }),
      );
    });
  });

  describe("analyzeCashflow", () => {
    it("calculates correct financial metrics", async () => {
      mockPrisma.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 1000000 }, _count: 5 }) // paid
        .mockResolvedValueOnce({ _sum: { amount: 500000 }, _count: 3 })  // unpaid
        .mockResolvedValueOnce({ _sum: { amount: 800000 }, _count: 4 }); // last month paid

      const result = await analyzeCashflow();
      expect(result.success).toBe(true);
      expect(result.data.totalPaid).toBe(1000000);
      expect(result.data.totalPending).toBe(500000);
      expect(result.data.paidCount).toBe(5);
      expect(result.data.unpaidCount).toBe(3);
    });

    it("trends up when current paid >= last month", async () => {
      mockPrisma.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 1000000 }, _count: 5 })
        .mockResolvedValueOnce({ _sum: { amount: 0 }, _count: 0 })
        .mockResolvedValueOnce({ _sum: { amount: 500000 }, _count: 3 });

      const result = await analyzeCashflow();
      expect(result.data.trend).toBe("up");
    });

    it("trends down when current paid < last month", async () => {
      mockPrisma.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 300000 }, _count: 2 })
        .mockResolvedValueOnce({ _sum: { amount: 0 }, _count: 0 })
        .mockResolvedValueOnce({ _sum: { amount: 1000000 }, _count: 8 });

      const result = await analyzeCashflow();
      expect(result.data.trend).toBe("down");
    });
  });

  describe("queryProjects", () => {
    it("returns projects with client and items", async () => {
      mockPrisma.project.findMany.mockResolvedValue([
        {
          id: "proj1",
          title: "Mobile App",
          status: "in_progress",
          totalPrice: 2000000,
          client: { name: "Startup XYZ" },
          items: [{ description: "UI Design", price: 500000 }],
        },
      ] as any);

      const result = await queryProjects({});
      expect(result.success).toBe(true);
      expect(result.data[0].title).toBe("Mobile App");
      expect(result.data[0].items).toHaveLength(1);
    });

    it("filters by status", async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);

      await queryProjects({ status: "done" });
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: "done" } }),
      );
    });
  });

  describe("getClientDetails", () => {
    it("finds clients by name (case insensitive)", async () => {
      mockPrisma.client.findMany.mockResolvedValue([
        {
          id: "cl1",
          name: "PT Maju Jaya",
          email: "info@maju.com",
          phone: "081234567890",
          _count: { projects: 3 },
          projects: [
            { invoices: [{}, {}] },
            { invoices: [{}] },
          ],
        },
      ] as any);

      const result = await getClientDetails({ name: "maju" });
      expect(result.success).toBe(true);
      expect(result.data[0].projectCount).toBe(3);
      expect(result.data[0].totalInvoices).toBe(3);
      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { contains: "maju", mode: "insensitive" } },
        }),
      );
    });
  });

  describe("executeTool", () => {
    it("delegates to query_invoices", async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      const result = await executeTool("query_invoices", { status: "paid" });
      expect(result.success).toBe(true);
    });

    it("delegates to analyze_cashflow", async () => {
      mockPrisma.invoice.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: 0 });
      const result = await executeTool("analyze_cashflow", {});
      expect(result.success).toBe(true);
      expect(result.data.totalPaid).toBe(0);
    });

    it("returns error for unknown tool", async () => {
      const result = await executeTool("unknown_tool", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown tool: unknown_tool");
    });
  });
});
