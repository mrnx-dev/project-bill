import { SPK_STARTER_TEMPLATE, SOW_STARTER_TEMPLATE_EN, SPK_SAMPLE_DATA, BLANK_STARTER_TEMPLATE, renderContractTemplate } from "@/lib/contract-template";

const TEN_CLAUSES_ID = ["Identitas Para Pihak", "Lingkup Pekerjaan", "Batas Revisi", "Jadwal",
  "Termin Pembayaran", "Hak Cipta", "Kerahasiaan", "Pembatalan", "Perubahan Scope", "Metode Komunikasi"];

test("the Indonesian starter template keeps the ten SPK clauses", () => {
  for (const c of TEN_CLAUSES_ID) expect(SPK_STARTER_TEMPLATE).toContain(c);
});

test("the Indonesian starter keeps all ten clauses and fills them from data", () => {
  const out = renderContractTemplate(SPK_STARTER_TEMPLATE, SPK_SAMPLE_DATA);
  expect(out).not.toContain("{{");
  expect(out).toContain(SPK_SAMPLE_DATA.client.name);
});

test("the English starter has ten English clauses and no placeholder survives", () => {
  for (const c of ["Parties", "Scope", "Revision", "Schedule", "Payment", "Copyright",
    "Confidentiality", "Cancellation", "Scope Change", "Communication"]) expect(SOW_STARTER_TEMPLATE_EN).toContain(c);
  expect(renderContractTemplate(SOW_STARTER_TEMPLATE_EN, { ...SPK_SAMPLE_DATA, language: "en" })).not.toContain("{{");
});

test("the blank starter is empty prose with one heading", () => {
  expect(BLANK_STARTER_TEMPLATE.trim()).toBe("## 1.");
});
