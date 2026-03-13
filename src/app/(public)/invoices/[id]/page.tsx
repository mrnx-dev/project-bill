import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PayButton } from "./pay-button";
import { PrintButton } from "./print-button";
import { CompanyLogo } from "@/components/company-logo";
import { ManualPaymentInstructions } from "./manual-payment";
import { TermsAgreement } from "./terms-agreement";
import { RealtimeInvoicePoller } from "@/components/realtime-invoice-poller";
import { format } from "date-fns";
import { id as localeId, enUS as localeEn } from "date-fns/locale";

type TranslationKey = "invoice" | "invoiceNo" | "date" | "dueDate" | "paid" | "unpaid" | "billTo" | "projectDetails" | "description" | "type" | "amount" | "qty" | "rate" | "projectServices" | "dpText" | "fullPaymentText" | "itemLabel" | "deductionLabel" | "lessDpText" | "subtotal" | "tax" | "totalDue" | "thanks" | "scopeLockedTxt";

const TRANSLATIONS: Record<string, Record<TranslationKey, string>> = {
  en: {
    invoice: "Invoice",
    invoiceNo: "Invoice No:",
    date: "Date:",
    dueDate: "Due Date:",
    paid: "Paid",
    unpaid: "Unpaid",
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
    unpaid: "Belum Bayar",
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

export default async function InvoiceViewPage(props: {
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

  const formatCurrency = (amount: string | number, currencyStr: string) => {
    return new Intl.NumberFormat(currencyStr === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency: currencyStr,
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  const hasQtyRate = invoice.project.items?.some(i => i.quantity !== null && i.rate !== null);

  const invoiceAmount = Number(invoice.amount);
  const taxRate = invoice.project.taxRate ? Number(invoice.project.taxRate) : 0;
  const taxName = invoice.project.taxName || t.tax;
  const taxAmount = invoiceAmount * (taxRate / 100);
  const grandTotal = invoiceAmount + taxAmount;

  const hasMayar = !!settings.mayarApiKey;

  return (
    <div className="light-theme min-h-screen bg-neutral-100 py-10 print:py-0 print:bg-white flex justify-center flex-col items-center gap-6">
      {invoice.status !== "paid" && <RealtimeInvoicePoller invoiceId={invoice.id} />}
      {/* Toolbar outside the A4 paper */}
      <div className="w-full max-w-[210mm] flex justify-end print:hidden gap-2">
        <PrintButton />
      </div>

      {/* A4 Container */}
      <div className="w-full max-w-[210mm] min-h-[297mm] bg-white shadow-xl print:shadow-none p-12 text-slate-900 relative flex flex-col">
        {/* Watermark Section */}
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden print:overflow-visible">
          <div
            className={`transform -rotate-45 text-[8rem] sm:text-[10rem] font-black uppercase tracking-widest opacity-[0.03] print:opacity-[0.06] select-none ${invoice.status === "paid" ? "text-emerald-600" : "text-slate-600"
              }`}
          >
            {invoice.status === "paid" ? t.paid : t.unpaid}
          </div>
        </div>

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
              {settings.companyAddress ||
                "123 Technology Drive\nInnovation City, TX 78701"}
              <br />
              {settings.companyEmail || "contact@projectbill.com"}
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
                #{invoice.invoiceNumber}
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

        {/* Status Badge (Absolute Positioned for style) */}
        <div className="absolute top-12 right-[50%] translate-x-[50%] print:hidden z-10">
          {invoice.status === "paid" ? (
            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300 border text-xs py-1 px-3 uppercase tracking-widest font-bold">
              {t.paid}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-red-100 text-red-800 hover:bg-red-200 border-red-300 border text-xs py-1 px-3 uppercase tracking-widest font-bold"
            >
              {t.unpaid}
            </Badge>
          )}
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
              {invoice.type === "recurring" ? (
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
                    {formatCurrency(
                      invoice.amount.toString(),
                      invoice.project.currency || "IDR",
                    )}
                  </td>
                </tr>
              ) : invoice.type === "dp" ||
                !invoice.project.items ||
                invoice.project.items.length === 0 ? (
                <tr className="border-b border-slate-200">
                  <td className="py-4 px-2">
                    <p className="font-medium text-slate-800">
                      {t.projectServices}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {invoice.type === "dp"
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
                      {invoice.type.replace("_", " ").toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-4 px-2 text-right font-medium text-slate-800">
                    {formatCurrency(
                      invoice.amount.toString(),
                      invoice.project.currency || "IDR",
                    )}
                  </td>
                </tr>
              ) : (
                <>
                  {invoice.project.items.map((item) => (
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
                            {item.rate ? formatCurrency(item.rate.toString(), invoice.project.currency || "IDR") : "-"}
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
                        {formatCurrency(
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
                          {formatCurrency(
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

          {/* Totals Section */}
          <div className="flex justify-end mt-6">
            <div className="w-1/2">
              <div className="flex justify-between py-2 text-sm text-slate-600">
                <span>{t.subtotal}</span>
                <span>
                  {formatCurrency(
                    invoiceAmount,
                    invoice.project.currency || "IDR",
                  )}
                </span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between py-2 text-sm text-slate-600 border-b border-slate-200">
                  <span>{taxName} ({taxRate}%)</span>
                  <span>
                    {formatCurrency(
                      taxAmount,
                      invoice.project.currency || "IDR"
                    )}
                  </span>
                </div>
              )}
              <div className={`flex justify-between py-4 text-xl font-bold text-slate-900 border-b-4 border-slate-800 ${taxRate === 0 ? 'border-t border-slate-200' : ''}`}>
                <span>{t.totalDue}</span>
                <span>
                  {formatCurrency(
                    grandTotal,
                    invoice.project.currency || "IDR",
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <div className="mt-auto pt-16 relative z-10 bg-white print:bg-transparent">
          {invoice.status !== "paid" &&
            invoice.project.currency === "IDR" &&
            (invoice.project.terms ? (
              <TermsAgreement
                projectId={invoice.project.id}
                terms={invoice.project.terms}
                termsAcceptedAt={
                  invoice.project.termsAcceptedAt?.toISOString() ?? null
                }
                language={lang as "en" | "id"}
              >
                {!hasMayar ? (
                  <ManualPaymentInstructions
                    bankName={settings.bankName}
                    bankAccountName={settings.bankAccountName}
                    bankAccountNumber={settings.bankAccountNumber}
                    invoiceNumber={invoice.invoiceNumber}
                    lang={lang as "id" | "en"}
                  />
                ) : (
                  <PayButton
                    invoiceId={invoice.id}
                    amountStr={formatCurrency(grandTotal, "IDR")}
                    lang={lang as "id" | "en"}
                  />
                )}
              </TermsAgreement>
            ) : !hasMayar ? (
              <ManualPaymentInstructions
                bankName={settings.bankName}
                bankAccountName={settings.bankAccountName}
                bankAccountNumber={settings.bankAccountNumber}
                invoiceNumber={invoice.invoiceNumber}
                lang={lang as "id" | "en"}
              />
            ) : (
              <PayButton
                invoiceId={invoice.id}
                amountStr={formatCurrency(grandTotal, "IDR")}
                lang={lang as "id" | "en"}
              />
            ))}
          <div className="text-center mt-8 text-xs text-slate-400 border-t pt-4">
            <p>{t.thanks}</p>
            <p>ProjectBill © {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
