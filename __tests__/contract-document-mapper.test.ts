import { toContractDocumentProps } from "@/lib/contract-document-mapper";

const project = {
  title: "Web", contractNumber: "SPK-202611-0001", createdAt: new Date("2026-11-01"),
  deadline: null, totalPrice: "5000000.0000", currency: "IDR", taxName: null, taxRate: null,
  dpAmount: null, billingMode: "SIMPLE", language: "id", terms: "No. {{nomor}} untuk {{klien.nama}}",
  termsAcceptedAt: null, termsAcceptedUserAgent: null, termsAcceptedSessionId: null,
  items: [], milestones: [], client: { name: "Budi", email: null, phone: null },
};
const provider = { companyName: "Studio A", companyAddress: null, companyEmail: null, companyWhatsApp: null };

test("terms leave the mapper already rendered", () => {
  const out = toContractDocumentProps({ project, provider });
  expect(out.terms).toBe("No. SPK-202611-0001 untuk Budi");
  expect(out.terms).not.toContain("{{");
});

test("a legacy body without placeholders passes through unchanged", () => {
  const out = toContractDocumentProps({ project: { ...project, terms: "## Klausul\nTeks." }, provider });
  expect(out.terms).toBe("## Klausul\nTeks.");
});
