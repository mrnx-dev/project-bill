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

test("header keeps the number and title; parties come from the body, not the component", () => {
  const text = render({ ...base, terms: "## 1. Identitas\nStudio A — Budi" }).textContent!;
  expect(text).toContain("SPK-202611-0001");
  expect(text).toContain("Website Company Profile");
  expect(text).toContain("Studio A — Budi");          // from terms
  // the hard-coded party cards print these role labels; deleting the grid removes them
  expect(text).not.toContain("PENYEDIA");
  expect(text).not.toContain("KLIEN");
  // the hard-coded scope/schedule/payment sections and their headings are gone
  expect(text).not.toContain("Lingkup Pekerjaan");
  expect(text).not.toContain("Jadwal");
  expect(text).not.toContain("Pembayaran");
  // the body heading "4." is gone: the body supplies its own numbered headings
  expect(text).not.toContain("4. Syarat");
});

test("a project without a number renders cleanly", () => {
  // contractNumber is nullable: rows created by scripts/seeds bypass the POST route.
  const text = render({ ...base, contractNumber: null }).textContent!;
  expect(text).not.toContain("null");
  expect(text).not.toContain("undefined");
  expect(text).toContain("Website Company Profile");   // the header still renders
});

test("a body with no placeholder text prints verbatim", () => {
  const text = render({ ...base, terms: "## Klausul\nTeks apa adanya." }).textContent!;
  expect(text).toContain("Teks apa adanya.");
});

test("signed document renders the audit trail", () => {
  const text = render({ ...base, termsAcceptedAt: "2026-11-05T10:00:00.000Z",
    termsAcceptedUserAgent: "Mozilla", termsAcceptedSessionId: "sess-1" }).textContent!;
  expect(text).toContain("Mozilla");
  expect(text).toContain("sess-1");
});
