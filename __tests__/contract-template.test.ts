import { SPK_STARTER_TEMPLATE } from "@/lib/contract-template";

test("starter template carries the ten SPK clauses", () => {
  const required = ["Identitas Para Pihak", "Lingkup Pekerjaan", "Batas Revisi",
    "Jadwal", "Termin Pembayaran", "Hak Cipta", "Kerahasiaan", "Pembatalan",
    "Perubahan Scope", "Metode Komunikasi"];
  for (const clause of required) expect(SPK_STARTER_TEMPLATE).toContain(clause);
});
