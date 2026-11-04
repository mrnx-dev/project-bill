import { generateContractNumber } from "@/lib/invoice-utils";

// @/lib/invoice-utils imports ./prisma, which imports ./env and throws "Invalid environment
// variables" without a .env. It MUST be mocked — self-contained factory, no jest.requireActual,
// same pattern as __tests__/milestone-invoice.test.ts.
jest.mock("@/lib/prisma", () => ({ prisma: {} }));

// generateContractNumber takes the tx explicitly, so the tx stub below is all the test needs,
// and it doubles as the call-order spy.
const mockTx = {
  $executeRaw: jest.fn().mockResolvedValue(1),
  project: { findFirst: jest.fn() },
};
const tx = mockTx as never;
const mocked = mockTx.project.findFirst as jest.Mock;

afterEach(() => jest.clearAllMocks());

test("starts at 0001 when the org has no contract this month", async () => {
  mocked.mockResolvedValue(null);
  const expected = `SPK-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-0001`;
  await expect(generateContractNumber("org-1", tx)).resolves.toBe(expected);
});

test("locks the org+month before reading the sequence", async () => {
  mocked.mockResolvedValue(null);
  await generateContractNumber("org-1", tx);
  const lockCall = mockTx.$executeRaw.mock.invocationCallOrder[0];
  const readCall = mocked.mock.invocationCallOrder[0];
  expect(lockCall).toBeLessThan(readCall);
});

test("continues the sequence of the highest number in the org", async () => {
  mocked.mockResolvedValue({ contractNumber: `SPK-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-0041` });
  const expected = `SPK-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-0042`;
  await expect(generateContractNumber("org-1", tx)).resolves.toBe(expected);
  expect(mocked).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ organizationId: "org-1" }),
  }));
});
