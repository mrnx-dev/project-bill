// jest.config.ts already sets testEnvironment: 'jsdom' globally — no docblock needed.
// React 19 without @testing-library: set IS_REACT_ACT_ENVIRONMENT in this file
// or React logs the "not wrapped in act(...)" warning for every render.
// FOUR ESM-only modules, not one. next/jest transforms none of them:
//   react-markdown   → SyntaxError: Unexpected token 'export' (index.js:10)
//   rehype-sanitize  → SyntaxError: Unexpected token 'export' (index.js:5)
// Mocking only react-markdown still fails on rehype-sanitize. `transformIgnorePatterns` does not help,
// so the plugin mocks below are required too.
jest.mock("remark-gfm", () => ({ __esModule: true, default: () => {} }));
jest.mock("remark-breaks", () => ({ __esModule: true, default: () => {} }));
jest.mock("rehype-sanitize", () => ({ __esModule: true, default: () => {} }));
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "markdown" }, children),
}));
// The tests below assert on our own labels and numbers, never on the Markdown renderer.
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { ContractDocument, type ContractDocumentProps } from "@/components/contract-document";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base: ContractDocumentProps = {
  language: "id", contractNumber: "SPK-202611-0001", title: "Website Company Profile",
  createdAt: "2026-11-01T00:00:00.000Z",
  provider: { name: "Studio A", address: "Jl. Mawar 1", email: "hi@studio.id", whatsapp: "62811" },
  client: { name: "Budi", email: "budi@mail.com", phone: "62812" },
  items: [], totalPrice: 5000000, currency: "IDR",
  taxName: null, taxRate: null, dpAmount: 2000000, billingMode: "SIMPLE",
  milestones: [], deadline: "2026-12-01T00:00:00.000Z", terms: "## Klausul\nTeks.",
  termsAcceptedAt: null, termsAcceptedUserAgent: null, termsAcceptedSessionId: null,
};

function render(props: ContractDocumentProps) {
  const div = document.createElement("div");
  const root = createRoot(div);
  act(() => { root.render(<ContractDocument {...props} />); });
  // No unmount: React clears the container on unmount, and the assertions read `div.textContent`.
  return div;
}

test("shows both parties and the document number", () => {
  const text = render(base).textContent!;
  expect(text).toContain("SPK-202611-0001");
  expect(text).toContain("Studio A");
  expect(text).toContain("Budi");
});

test("a project without a number renders cleanly", () => {
  // contractNumber is nullable: rows created by scripts/seeds bypass the POST route.
  const text = render({ ...base, contractNumber: null }).textContent!;
  expect(text).not.toContain("null");
  expect(text).not.toContain("undefined");
  expect(text).toContain("Budi");   // the rest of the header still renders
});

test("zero items falls back to the agreed total, no empty scope table", () => {
  const div = render(base);
  // The payment section may use a table, so assert on the scope section specifically.
  expect(div.textContent).not.toContain("Deskripsi");   // the item-table header
  expect(div.textContent).toContain("5.000.000");
});

test("milestone mode renders the schedule and no DP row", () => {
  const text = render({ ...base, billingMode: "MILESTONE", dpAmount: null, milestones: [
    { name: "Tahap Awal 50%", percentage: 50, amount: 2500000, dueDate: null },
    { name: "Pelunasan", percentage: 50, amount: 2500000, dueDate: null },
  ] }).textContent!;
  expect(text).toContain("Tahap Awal 50%");
  expect(text).not.toContain("Uang Muka (DP) Awal");  // the SIMPLE-mode DP row label
});

test("signed document renders the audit trail", () => {
  const text = render({ ...base, termsAcceptedAt: "2026-11-05T10:00:00.000Z",
    termsAcceptedUserAgent: "Mozilla", termsAcceptedSessionId: "sess-1" }).textContent!;
  expect(text).toContain("Mozilla");
  expect(text).toContain("sess-1");
});

test("non-IDR currency prints its own symbol, never Rupiah", () => {
  // formatMoney(5000000,"USD") === "$5,000,000.00"; formatMoney(5000000,"IDR")
  // is "Rp" + NBSP + "5.000.000" (so match "5.000.000", not the whole string).
  const text = render({ ...base, currency: "USD" }).textContent!;
  expect(text).not.toContain("Rp");
  expect(text).toContain("$");
  expect(text).toContain("5,000,000.00");
});
