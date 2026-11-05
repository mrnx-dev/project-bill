import { format } from "date-fns";
import { id as localeId, enUS as localeEn } from "date-fns/locale";
import { formatMoney } from "@/lib/currency";
import type { ContractDocumentProps } from "@/components/contract-document";

// Everything the engine needs to expand {{placeholders}}: ContractDocumentProps minus the
// terms/audit fields (terms is the template itself; the audit block is added by the component).
export type ContractTemplateData = Omit<
  ContractDocumentProps,
  "terms" | "termsAcceptedAt" | "termsAcceptedUserAgent" | "termsAcceptedSessionId"
>;

// Starter SPK (perjanjian kerja) template in Indonesian. Shown only as a prefill on the
// new-template page — nothing hits the DB until the tenant saves their edited copy.
export const SPK_STARTER_TEMPLATE = `## Perjanjian Kerja (SPK)

Pada hari ini, tanggal ____ , para pihak yang tercantum di bawah ini menyepakati perjanjian kerja berikut.

### 1. Identitas Para Pihak

Pihak Pertama (Klien): Nama ____ , alamat ____ , email ____ , telepon ____ .
Pihak Kedua (Pelaksana): Nama ____ , alamat ____ , email ____ , telepon ____ .

### 2. Lingkup Pekerjaan & Deliverables

Pekerjaan meliputi: ____ . Deliverables yang diserahkan: ____ , diserahkan dalam format ____ .

### 3. Batas Revisi

Revisi dibatasi maksimal ____ putaran; revisi di luar itu dihitung sebagai pekerjaan tambahan dengan biayanya tersendiri.

### 4. Jadwal & Konsekuensi Keterlambatan

Pekerjaan dimulai pada ____ dan diselesaikan paling lambat ____ . Keterlambatan akibat kelalaian Pihak Kedua dikenakan ____ per hari; keterlambatan penyampaian data/umpan balik dari Pihak Pertama menggeser jadwal secara proporsional.

### 5. Harga & Termin Pembayaran

Total nilai pekerjaan: ____ ( ____ rupiah). Pembayaran dengan termin: ____ . Pembayaran dilakukan melalui rekening ____ atas nama ____ .

### 6. Hak Cipta & File Final

Seluruh hak cipta atas hasil kerja beralih ke Pihak Pertama setelah pelunasan penuh. File final diserahkan dalam format ____ setelah pelunasan. Pihak Kedua berhak menampilkan hasil kerja sebagai portofolio kecuali disepakati lain: ____ .

### 7. Kerahasiaan

Masing-masing pihak menjaga kerahasiaan data, materi, dan informasi komersial pihak lainnya yang diperoleh selama pelaksanaan pekerjaan ini, dan tidak mengungkapkannya kepada pihak ketiga tanpa persetujuan tertulis.

### 8. Pembatalan

Pembatalan oleh Pihak Pertama diberitahukan secara tertulis. Upah/kerja yang telah dilakukan hingga tanggal pembatalan tetap terutang, sebesar ____ ; pembayaran yang telah diterima tidak dikembalikan untuk pekerjaan yang telah selesai.

### 9. Mekanisme Perubahan Scope

Setiap perubahan lingkup pekerjaan diajukan secara tertulis (email/pesan) dan disepakati kedua pihak sebelum dikerjakan; perubahan dapat mempengaruhi harga dan jadwal.

### 10. Metode Komunikasi

Komunikasi resmi dilakukan melalui ____ dengan waktu tanggap ____ hari kerja. Rapat/pertemuan dijadwalkan melalui kesepakatan kedua pihak.

Disetujui oleh kedua pihak melalui persetujuan digital pada dokumen ini.
`;

// Escape a scalar value for safe interpolation into a Markdown line: a pipe would split a
// table cell and a newline would break the line, so both are neutralised BEFORE joining.
function escapeValue(v: unknown): string {
  return String(v).replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
}

type Item = ContractTemplateData["items"][number];
type Milestone = ContractTemplateData["milestones"][number];

function itemCell(item: Item, key: keyof Item): string {
  const v = item[key];
  if (key === "description") return escapeValue(v ?? "-");
  if (key === "quantity") return escapeValue(v === null || v === undefined ? "-" : v);
  // rate === null prints "-" (a printed Rp 0 rate reads as an error); price is always present.
  if (key === "rate") return escapeValue(v === null || v === undefined ? "-" : formatMoney(Number(v), "IDR"));
  return escapeValue(v === null || v === undefined ? "-" : formatMoney(Number(v), "IDR"));
}

function buildItemTable(items: Item[], currency: string, total: number): string {
  if (items.length === 0) {
    // No items: no empty table header — the agreed total is the whole clause.
    return formatMoney(total, currency);
  }
  const header = "| Deskripsi | Qty | Harga Satuan | Harga |";
  const rule = "| --- | --- | --- | --- |";
  const rows = items.map((item) => {
    const cells = [
      item.description ?? "-",
      item.quantity === null || item.quantity === undefined ? "-" : String(item.quantity),
      item.rate === null || item.rate === undefined ? "-" : formatMoney(Number(item.rate), currency),
      formatMoney(Number(item.price), currency),
    ];
    return `| ${cells.map(escapeValue).join(" | ")} |`;
  });
  const totalRow = `| **Total** | | | ${formatMoney(total, currency)} |`;
  return [header, rule, ...rows, totalRow].join("\n");
}

function buildMilestoneTable(milestones: Milestone[], currency: string, mode: string, dateFormat: (iso: string) => string): string {
  if (mode !== "MILESTONE" || milestones.length === 0) {
    // SIMPLE mode has no milestones: a dash line, not an empty table.
    return "-";
  }
  const header = "| Tahap | Persentase | Nilai | Jatuh Tempo |";
  const rule = "| --- | --- | --- | --- |";
  const rows = milestones.map((m) => {
    const cells = [
      m.name ?? "-",
      `${m.percentage}%`,
      formatMoney(Number(m.amount), currency),
      m.dueDate ? dateFormat(m.dueDate) : "-",
    ];
    return `| ${cells.map(escapeValue).join(" | ")} |`;
  });
  return [header, rule, ...rows].join("\n");
}

export function renderContractTemplate(template: string, data: ContractTemplateData): string {
  const lang = data.language === "en" ? "en" : "id";
  const dateLocale = lang === "id" ? localeId : localeEn;
  const dateFormat = lang === "id" ? "d MMM yyyy" : "MMM d, yyyy";
  const fmtDate = (iso: string | null) => (iso ? format(new Date(iso), dateFormat, { locale: dateLocale }) : "-");

  // Tax amount mirrors the printer's rounding: rate applied to the total, rounded to the
  // currency's minor units so USD/EUR cents survive.
  const taxAmount = data.taxRate === null || data.taxRate === undefined
    ? null
    : formatMoney(Number(Math.round((data.totalPrice * data.taxRate / 100 + Number.EPSILON) * 10 ** 2)) / 10 ** 2, data.currency);

  const values: Record<string, string> = {
    "nomor": escapeValue(data.contractNumber ?? "-"),
    "tanggal": escapeValue(fmtDate(data.createdAt)),
    "proyek.judul": escapeValue(data.title),
    "penyedia.nama": escapeValue(data.provider.name),
    "penyedia.alamat": escapeValue(data.provider.address ?? "-"),
    "penyedia.email": escapeValue(data.provider.email ?? "-"),
    "penyedia.whatsapp": escapeValue(data.provider.whatsapp ?? "-"),
    "klien.nama": escapeValue(data.client.name),
    "klien.email": escapeValue(data.client.email ?? "-"),
    "klien.telepon": escapeValue(data.client.phone ?? "-"),
    "lingkup.tabel": buildItemTable(data.items, data.currency, data.totalPrice),
    "lingkup.total": formatMoney(data.totalPrice, data.currency),
    "tenggat": escapeValue(fmtDate(data.deadline)),
    "milestone.tabel": buildMilestoneTable(data.milestones, data.currency, data.billingMode, fmtDate),
    "total": formatMoney(data.totalPrice, data.currency),
    "pajak.nama": escapeValue(data.taxName ?? "-"),
    "pajak.persen": data.taxRate === null || data.taxRate === undefined ? "-" : String(data.taxRate),
    "pajak.nilai": taxAmount ?? "-",
    "dp": data.dpAmount === null || data.dpAmount === undefined || data.dpAmount === 0
      ? "-" : formatMoney(data.dpAmount, data.currency),
  };

  // One pass: a value that itself contains {{…}} is never re-expanded.
  return template.replace(/\{\{([a-z.]+)\}\}/g, (match, key: string) => values[key] ?? match);
}

// 19 tokens for the palette (src/components/placeholder-palette.tsx) and the all-tokens test.
export const CONTRACT_PLACEHOLDERS: { token: string; group: "document" | "parties" | "project" | "money"; label: string }[] = [
  { token: "{{nomor}}", group: "document", label: "Nomor dokumen" },
  { token: "{{tanggal}}", group: "document", label: "Tanggal dokumen" },
  { token: "{{penyedia.nama}}", group: "parties", label: "Nama penyedia" },
  { token: "{{penyedia.alamat}}", group: "parties", label: "Alamat penyedia" },
  { token: "{{penyedia.email}}", group: "parties", label: "Email penyedia" },
  { token: "{{penyedia.whatsapp}}", group: "parties", label: "WhatsApp penyedia" },
  { token: "{{klien.nama}}", group: "parties", label: "Nama klien" },
  { token: "{{klien.email}}", group: "parties", label: "Email klien" },
  { token: "{{klien.telepon}}", group: "parties", label: "Telepon klien" },
  { token: "{{proyek.judul}}", group: "project", label: "Judul proyek" },
  { token: "{{lingkup.tabel}}", group: "project", label: "Tabel lingkup (item)" },
  { token: "{{tenggat}}", group: "project", label: "Batas waktu" },
  { token: "{{milestone.tabel}}", group: "project", label: "Tabel milestone" },
  { token: "{{lingkup.total}}", group: "money", label: "Total nilai" },
  { token: "{{total}}", group: "money", label: "Total nilai" },
  { token: "{{pajak.nama}}", group: "money", label: "Nama pajak" },
  { token: "{{pajak.persen}}", group: "money", label: "Persentase pajak" },
  { token: "{{pajak.nilai}}", group: "money", label: "Nilai pajak" },
  { token: "{{dp}}", group: "money", label: "Uang muka" },
];
