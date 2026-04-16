import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CompanyLogo } from "@/components/company-logo";
import { format } from "date-fns";
import { id as localeId, enUS as localeEn } from "date-fns/locale";
import { NotepadTextDashed } from "lucide-react";
import { formatEnum } from "@/lib/utils";
import { formatMoney } from "@/lib/currency";

type TranslationKey = "invoice" | "invoiceNo" | "date" | "dueDate" | "paid" | "unpaid" | "billTo" | "projectDetails" | "description" | "type" | "amount" | "qty" | "rate" | "projectServices" | "dpText" | "fullPaymentText" | "itemLabel" | "deductionLabel" | "lessDpText" | "subtotal" | "tax" | "totalDue" | "thanks" | "scopeLockedTxt";

const TRANSLATIONS: Record<string, Record<TranslationKey, string>> = {
  en: {
    invoice: "Invoice",
    invoiceNo: "Invoice No:",
    date: "Date:",
    dueDate: "Due Date:",
    paid: "Paid",
    unpaid: "Awaiting Payment",
    billTo: "Bill To",
    projectDetails: "Project Details",
    description: "Description",
    type: "Type",
    amount: "Amount",
    qty: "Qty",
    rate: "Rate",
    projectServices: "Project Services",
    dpText: "Initial Down Payment (DP)",
    fullPaymentText: "Full Payment / Final Balance",
    itemLabel: "ITEM",
    deductionLabel: "DEDUCTION",
    lessDpText: "Less: Down Payment (Already Paid)",
    subtotal: "Subtotal",
    tax: "Tax",
    totalDue: "Total Due",
    thanks: "Thank you for your business.",
    scopeLockedTxt: "Scope locked"
  },
  id: {
    invoice: "Faktur",
    invoiceNo: "No Faktur:",
    date: "Tanggal:",
    dueDate: "Jatuh Tempo:",
    paid: "Lunas",
    unpaid: "Menunggu Pembayaran",
    billTo: "Tagihan Kepada",
    projectDetails: "Detail Proyek",
    description: "Deskripsi",
    type: "Tipe",
    amount: "Jumlah",
    qty: "Knt",
    rate: "Tarif",
    projectServices: "Layanan Proyek",
    dpText: "Uang Muka (DP) Awal",
    fullPaymentText: "Pembayaran Penuh / Pelunasan Akhir",
    itemLabel: "ITEM",
    deductionLabel: "POTONGAN",
    lessDpText: "Dikurangi: Uang Muka (Sudah Dibayar)",
    subtotal: "Subtotal",
    tax: "Pajak",
    totalDue: "Total Tagihan",
    thanks: "Terima kasih atas kerja sama Anda.",
    scopeLockedTxt: "Lingkup terkunci",
  }
};

export default async function InvoicePrintPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      project: {
        include: { client: true, items: true },
      },
    },
  });

  const settings = (await prisma.settings.findUnique({
    where: { id: "global" },
  })) || {
    companyName: "ProjectBill",
    companyAddress: null,
    companyEmail: null,
    companyLogoUrl: null,
    bankName: null,
    bankAccountName: null,
    bankAccountNumber: null,
    companyWhatsApp: null,
    mayarApiKey: null,
  };

  if (!invoice) return notFound();

  const lang = invoice.project.language === "id" ? "id" : "en";
  const t = TRANSLATIONS[lang];
  const dateLocale = lang === "id" ? localeId : localeEn;
  const dateFormat = lang === "id" ? "d MMM yyyy" : "MMM d, yyyy";

  const hasQtyRate = invoice.project.items?.some(i => i.quantity !== null && i.rate !== null);

  const invoiceAmount = Number(invoice.amount);
  const taxRate = invoice.project.taxRate ? Number(invoice.project.taxRate) : 0;
  const taxName = invoice.project.taxName || t.tax;
  const taxAmount = invoiceAmount * (taxRate / 100);
  const grandTotal = invoiceAmount + taxAmount;

  return (
    <div className="bg-white text-slate-900 min-h-screen flex flex-col p-8 md:p-12 mx-auto max-w-[21cm] print:min-h-[29.7cm]">
      <style>{`
          @media print {
              @page {
                  size: A4;
                  margin: 0;
              }
              body {
                  background: white;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
              }
          }
      `}</style>
      
      {/* Auto-print script */}
      <script dangerouslySetInnerHTML={{ __html: `
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        };
      ` }} />
      
      <div className="print-content flex flex-col flex-1 w-full">
      {invoice.status === "PAID" && (
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden print:overflow-visible">
            <div
              className="transform -rotate-45 text-[8rem] sm:text-[10rem] font-black uppercase tracking-widest opacity-[0.03] print:opacity-[0.06] select-none text-emerald-600"
            >
              {t.paid}
            </div>
          </div>
      )}

      {/* Header Section */}
      <div className="flex justify-between items-start mb-12 relative z-10 w-full">
        <div className="space-y-1">
          {settings.companyLogoUrl ? (
            <CompanyLogo
              src={settings.companyLogoUrl}
              companyName={settings.companyName}
            />
          ) : (
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              {settings.companyName}
            </h1>
          )}
          <p className="text-sm text-slate-500 max-w-[250px] whitespace-pre-wrap">
            {settings.companyAddress}
            <br />
            {settings.companyEmail}
            {settings.companyWhatsApp && (
              <>
                <br />
                WhatsApp: {settings.companyWhatsApp}
              </>
            )}
          </p>
        </div>
        <div className="text-right space-y-2">
          <h2 className="text-4xl font-serif font-bold text-slate-800 tracking-widest uppercase mb-4">
            {t.invoice}
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-slate-500 uppercase">
              {t.invoiceNo}
            </span>
            <span className="font-mono font-medium">
              {invoice.invoiceNumber}
            </span>
            <span className="font-semibold text-slate-500 uppercase">
              {t.date}
            </span>
            <span className="font-medium">
              {format(new Date(invoice.createdAt), dateFormat, { locale: dateLocale })}
            </span>
            {invoice.dueDate && (
              <>
                <span className="font-semibold text-slate-500 uppercase">
                  {t.dueDate}
                </span>
                <span className="font-medium">
                  {format(new Date(invoice.dueDate), dateFormat, { locale: dateLocale })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Billing Details */}
      <div className="flex justify-between mb-12 bg-slate-50 p-6 rounded-lg border border-slate-100 print:bg-transparent print:border-none print:p-0 relative z-10">
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
            {t.billTo}
          </p>
          <p className="font-bold text-lg text-slate-800">
            {invoice.project.client.name}
          </p>
          {invoice.project.client.email && (
            <p className="text-sm text-slate-600">
              {invoice.project.client.email}
            </p>
          )}
          {invoice.project.client.phone && (
            <p className="text-sm text-slate-600">
              {invoice.project.client.phone}
            </p>
          )}
        </div>
        <div className="space-y-2 text-right">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
            {t.projectDetails}
          </p>
          <p className="font-bold text-lg text-slate-800">
            {invoice.project.title}
          </p>
        </div>
      </div>

      {/* Table Section */}
      <div className="mt-4 flex-grow relative z-10 bg-white/50 print:bg-transparent">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-slate-800">
              <th className="py-3 px-2 font-bold text-slate-800 uppercase tracking-wider">
                {t.description}
              </th>
              {hasQtyRate && (
                <>
                  <th className="py-3 px-2 font-bold text-slate-800 uppercase tracking-wider text-right">
                    {t.qty}
                  </th>
                  <th className="py-3 px-2 font-bold text-slate-800 uppercase tracking-wider text-right">
                    {t.rate}
                  </th>
                </>
              )}
              <th className="py-3 px-2 font-bold text-slate-800 uppercase tracking-wider text-center">
                {t.type}
              </th>
              <th className="py-3 px-2 font-bold text-slate-800 uppercase tracking-wider text-right">
                {t.amount}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.type === "RECURRING" ? (
              <tr className="border-b border-slate-200">
                <td className="py-4 px-2">
                  <p className="font-medium text-slate-800">
                    {invoice.notes || t.projectServices}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {lang === "id" ? "Tagihan Rutin" : "Recurring Invoice"}
                  </p>
                </td>
                {hasQtyRate && (
                  <>
                    <td className="py-4 px-2 text-right">-</td>
                    <td className="py-4 px-2 text-right">-</td>
                  </>
                )}
                <td className="py-4 px-2 text-center">
                  <Badge
                    variant="outline"
                    className="font-mono text-slate-600 bg-slate-50"
                  >
                    RECURRING
                  </Badge>
                </td>
                <td className="py-4 px-2 text-right font-medium text-slate-800">
                  {formatMoney(
                    invoice.amount.toString(),
                    invoice.project.currency || "IDR",
                  )}
                </td>
              </tr>
            ) : invoice.type === "DP" ||
              !invoice.project.items ||
              invoice.project.items.length === 0 ? (
              <tr className="border-b border-slate-200">
                <td className="py-4 px-2">
                  <p className="font-medium text-slate-800">
                    {t.projectServices}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {invoice.type === "DP"
                      ? t.dpText
                      : t.fullPaymentText}
                  </p>
                </td>
                {hasQtyRate && (
                  <>
                    <td className="py-4 px-2 text-right">-</td>
                    <td className="py-4 px-2 text-right">-</td>
                  </>
                )}
                <td className="py-4 px-2 text-center">
                  <Badge
                    variant="outline"
                    className="font-mono text-slate-600 bg-slate-50"
                  >
                    {formatEnum(invoice.type).toUpperCase()}
                  </Badge>
                </td>
                <td className="py-4 px-2 text-right font-medium text-slate-800">
                  {formatMoney(
                    invoice.amount.toString(),
                    invoice.project.currency || "IDR",
                  )}
                </td>
              </tr>
            ) : (
              <>
                {invoice.project.items.map((item: any) => (
                  <tr key={item.id} className="border-b border-slate-200">
                    <td className="py-4 px-2">
                      <p className="font-medium text-slate-800">
                        {item.description}
                      </p>
                    </td>
                    {hasQtyRate && (
                      <>
                        <td className="py-4 px-2 text-right text-slate-600">
                          {item.quantity ? Number(item.quantity).toString() : "-"}
                        </td>
                        <td className="py-4 px-2 text-right text-slate-600">
                          {item.rate ? formatMoney(item.rate.toString(), invoice.project.currency || "IDR") : "-"}
                        </td>
                      </>
                    )}
                    <td className="py-4 px-2 text-center">
                      <Badge
                        variant="outline"
                        className="font-mono text-slate-600 bg-slate-50"
                      >
                        {t.itemLabel}
                      </Badge>
                    </td>
                    <td className="py-4 px-2 text-right font-medium text-slate-800">
                      {formatMoney(
                        item.price.toString(),
                        invoice.project.currency || "IDR",
                      )}
                    </td>
                  </tr>
                ))}
                {invoice.project.dpAmount &&
                  Number(invoice.project.dpAmount) > 0 &&
                  Number(invoice.project.totalPrice) >
                  Number(invoice.amount) && (
                    <tr className="border-b border-slate-200">
                      <td className="py-4 px-2">
                        <p className="font-medium text-slate-500 italic">
                          {t.lessDpText}
                        </p>
                      </td>
                      {hasQtyRate && (
                        <>
                          <td className="py-4 px-2 text-right">-</td>
                          <td className="py-4 px-2 text-right">-</td>
                        </>
                      )}
                      <td className="py-4 px-2 text-center">
                        <Badge
                          variant="outline"
                          className="font-mono text-slate-600 bg-slate-50"
                        >
                          {t.deductionLabel}
                        </Badge>
                      </td>
                      <td className="py-4 px-2 text-right font-medium text-slate-800">
                        -
                        {formatMoney(
                          invoice.project.dpAmount.toString(),
                          invoice.project.currency || "IDR",
                        )}
                      </td>
                    </tr>
                  )}
              </>
            )}
          </tbody>
        </table>
        <div className="flex justify-end mt-6">
          <div className="w-1/2">
            <div className="flex justify-between py-2 text-sm text-slate-600">
              <span>{t.subtotal}</span>
              <span>
                {formatMoney(
                  invoiceAmount,
                  invoice.project.currency || "IDR",
                )}
              </span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between py-2 text-sm text-slate-600 border-b border-slate-200">
                <span>{taxName} ({taxRate}%)</span>
                <span>
                  {formatMoney(
                    taxAmount,
                    invoice.project.currency || "IDR"
                  )}
                </span>
              </div>
            )}
            <div className={`flex justify-between py-4 text-xl font-bold text-slate-900 ${taxRate === 0 ? 'border-t border-slate-200' : ''}`}>
              <span>{t.totalDue}</span>
              <span>
                {formatMoney(
                  grandTotal,
                  invoice.project.currency || "IDR",
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Full-width separator */}
        <hr className="border-t border-slate-200 mt-0" />

        {/* Notes Section for DP and Full Payment */}
        {invoice.notes && invoice.type !== "RECURRING" && (
          <div className="mt-6 relative z-10 max-w-md">
            <h4 className="font-semibold text-slate-500 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <NotepadTextDashed className="h-3.5 w-3.5" />
              {lang === "id" ? "Catatan" : "Notes"}
            </h4>
            <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">
              {invoice.notes}
            </p>
          </div>
        )}
      </div>

      <div className="mt-auto text-center text-xs text-slate-400 border-t pt-4">
        <p>{t.thanks}</p>
        <p>ProjectBill © {new Date().getFullYear()}</p>
      </div>
      </div>
    </div>
  );
}
