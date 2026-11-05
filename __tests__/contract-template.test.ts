import { SPK_STARTER_TEMPLATE } from "@/lib/contract-template";

test("starter template carries the ten SPK clauses", () => {
  const required = ["Identitas Para Pihak", "Lingkup Pekerjaan", "Batas Revisi",
    "Jadwal", "Termin Pembayaran", "Hak Cipta", "Kerahasiaan", "Pembatalan",
    "Perubahan Scope", "Metode Komunikasi"];
  for (const clause of required) expect(SPK_STARTER_TEMPLATE).toContain(clause);
});

import { renderContractTemplate, CONTRACT_PLACEHOLDERS, type ContractTemplateData } from "@/lib/contract-template";

const data: ContractTemplateData = {
  language: "id", contractNumber: "SPK-202611-0001", title: "Website Company Profile",
  createdAt: "2026-11-01T00:00:00.000Z",
  provider: { name: "Studio A", address: "Jl. Mawar 1", email: "hi@studio.id", whatsapp: "62811" },
  client: { name: "Budi", email: "budi@mail.com", phone: "62812" },
  items: [{ description: "Landing page", quantity: 1, rate: 2500000, price: 2500000 }],
  totalPrice: 5000000, currency: "IDR", taxName: "PPN", taxRate: 11, dpAmount: 2000000,
  billingMode: "SIMPLE", milestones: [], deadline: "2026-12-01T00:00:00.000Z",
};

test("expands document, party and project tokens", () => {
  const out = renderContractTemplate(
    "{{number}}|{{project.title}}|{{provider.name}}|{{client.name}}|{{client.phone}}", data);
  expect(out).toBe("SPK-202611-0001|Website Company Profile|Studio A|Budi|62812");
});

test("table headers follow the data language, not a hard-coded locale", () => {
  expect(renderContractTemplate("{{scope.table}}", { ...data, language: "en" })).toContain("| Description | Qty | Unit Price | Amount |");
  expect(renderContractTemplate("{{milestone.table}}",
    { ...data, language: "en", billingMode: "MILESTONE",
      milestones: [{ name: "Kickoff", percentage: 50, amount: 2500000, dueDate: null }] })).toContain("| Phase | Percentage | Amount | Due Date |");
  // id stays the current header.
  expect(renderContractTemplate("{{scope.table}}", data)).toContain("| Deskripsi | Qty | Harga Satuan | Harga |");
  // bold total row label also follows the locale.
  expect(renderContractTemplate("{{scope.table}}", { ...data, language: "en" })).toContain("**Total**");
});

test("an unknown token is printed verbatim", () => {
  expect(renderContractTemplate("Halo {{client.namee}}", data)).toContain("{{client.namee}}");
});

test("a body with no placeholders is returned unchanged", () => {
  const body = "## Klausul\nTeks bebas tanpa token.";
  expect(renderContractTemplate(body, data)).toBe(body);
});

test("an item with no rate prints a dash in the rate column, not NaN", () => {
  const out = renderContractTemplate("{{scope.table}}",
    { ...data, items: [{ description: "Retainer", quantity: null, rate: null, price: 1500000 }] });
  expect(out).not.toContain("NaN");
  expect(out).toContain("Retainer");
});

test("a value containing a pipe cannot break the scope table", () => {
  const out = renderContractTemplate("{{scope.table}}",
    { ...data, items: [{ description: "A | B", quantity: 1, rate: 1000, price: 1000 }] });
  expect(out).toContain("A \\| B");
  // escaped data pipe must not add a column: the row keeps exactly 4 cells
  const row = out.split("\n").find((l) => l.includes("A \\\| B"));
  const unescaped = (row?.match(/(^|[^\\])\|/g) ?? []).length;
  expect(unescaped).toBe(5); // leading + 3 separators + trailing = 4 columns
});

test("null values and a zero down-payment render a dash, never undefined", () => {
  const out = renderContractTemplate("{{deadline}}|{{downPayment}}|{{tax.name}}",
    { ...data, deadline: null, dpAmount: null, taxName: null, taxRate: null });
  expect(out).toBe("-|-|-");
  expect(out).not.toContain("undefined");
  expect(out).not.toContain("null");
  expect(renderContractTemplate("{{downPayment}}", { ...data, dpAmount: 0 })).toBe("-");
});

test("the tax percentage is a bare number and its amount is money", () => {
  expect(renderContractTemplate("{{tax.rate}}", data)).toBe("11");
  expect(renderContractTemplate("{{tax.rate}}", { ...data, taxRate: null })).toBe("-");
});

test("items become a markdown table; no items prints the agreed total instead", () => {
  expect(renderContractTemplate("{{scope.table}}", data)).toContain("| Landing page |");
  const empty = renderContractTemplate("{{scope.table}}", { ...data, items: [] });
  expect(empty).not.toContain("| Deskripsi |");
  expect(empty).toContain("5.000.000");
});

test("milestones render a table, SIMPLE mode renders a dash line", () => {
  const ms = renderContractTemplate("{{milestone.table}}", { ...data, billingMode: "MILESTONE",
    milestones: [{ name: "Tahap Awal", percentage: 50, amount: 2500000, dueDate: null }] });
  expect(ms).toContain("| Tahap Awal |");
  expect(renderContractTemplate("{{milestone.table}}", data)).toBe("-");
});

test("tax value is the rate applied to the total", () => {
  expect(renderContractTemplate("{{tax.amount}}", data)).toContain("550.000");
  expect(renderContractTemplate("{{tax.amount}}", { ...data, taxRate: null })).toBe("-");
});

test("every advertised placeholder expands and none survives the render", () => {
  const all = CONTRACT_PLACEHOLDERS.map((p) => p.token).join(" ");
  const out = renderContractTemplate(all, data);
  expect(out).not.toContain("{{");
});
