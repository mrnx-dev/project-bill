import { TERMS_AGREEMENT_COPY } from "@/app/(public)/invoices/[id]/terms-agreement";

// The component file imports ContractDocument → react-markdown, which is ESM-only under Jest
// (same four mocks as __tests__/contract-document.test.tsx).
jest.mock("remark-gfm", () => ({ __esModule: true, default: () => {} }));
jest.mock("remark-breaks", () => ({ __esModule: true, default: () => {} }));
jest.mock("rehype-sanitize", () => ({ __esModule: true, default: () => {} }));
jest.mock("react-markdown", () => ({ __esModule: true, default: () => null }));

for (const lang of ["en", "id"] as const) {
  const t = TERMS_AGREEMENT_COPY[lang];
  test(`${lang}: one document name, one acknowledge token`, () => {
    expect(t.acknowledgeText).toContain("[SOW]");
    expect(t.acknowledgeText).not.toContain("[TERMS]");
    expect(t.sowTermsTitle).not.toMatch(/Terms|Syarat/);
  });
}

test("id locale names the Indonesian document", () => {
  expect(TERMS_AGREEMENT_COPY.id.sowTermsTitle).toBe("Surat Perjanjian Kerja");
  expect(TERMS_AGREEMENT_COPY.id.reviewSignBtn).toContain("SPK");
});

test("en locale no longer says SOW in the primary action", () => {
  expect(TERMS_AGREEMENT_COPY.en.reviewSignBtn).toBe("Review & Sign Document");
  expect(TERMS_AGREEMENT_COPY.en.sowTermsTitle).toBe("Statement of Work");
});
