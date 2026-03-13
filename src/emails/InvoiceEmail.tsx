import { Text } from "@react-email/components";
import { EmailLayout, InvoiceCard, CtaButton, DetailRow } from "./EmailLayout";
import type { CompanyInfo, Language } from "./EmailLayout";

interface InvoiceEmailProps {
  clientName: string;
  invoiceId: string;
  projectName: string;
  amount: string;
  dueDate: Date | null;
  invoiceLink: string;
  company?: CompanyInfo;
  lang?: Language;
}

export const InvoiceEmail = ({
  clientName = "Client Name",
  invoiceId = "INV-1234",
  projectName = "Website Development",
  amount = "Rp 1,000,000",
  dueDate = new Date(),
  invoiceLink = "https://projectbill.com/invoices/INV-1234",
  company,
  lang = "id",
}: InvoiceEmailProps) => {
  const formattedDate = dueDate
    ? new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(dueDate)
    : (lang === "id" ? "Saat Diterima" : "Upon Receipt");

  const senderName = company?.companyName || "MRN Dev";

  const previewText = lang === "id"
    ? `Invoice baru dari ${senderName} untuk ${projectName}`
    : `New invoice from ${senderName} for ${projectName}`;

  return (
    <EmailLayout preview={previewText} company={company} lang={lang}>
      <Text style={{ fontSize: 14, color: "#374151", lineHeight: "22px", margin: "0 0 8px 0" }}>
        {lang === "id" ? `Halo ${clientName},` : `Hello ${clientName},`}
      </Text>
      <Text style={{ fontSize: 14, color: "#374151", lineHeight: "22px", margin: "0 0 4px 0" }}>
        {lang === "id" ? (
          <>
            Kami telah membuat invoice baru untuk proyek{" "}
            <strong>{projectName}</strong>. Silakan periksa rinciannya di bawah ini.
          </>
        ) : (
          <>
            We have generated a new invoice for the{" "}
            <strong>{projectName}</strong> project. Please review the details below.
          </>
        )}
      </Text>

      <InvoiceCard
        badgeType="unpaid"
        amount={amount}
        clientName={clientName}
        projectName={projectName}
        lang={lang}
        extraRows={
          <>
            <DetailRow label="No. Invoice" value={invoiceId} />
            <DetailRow label={lang === "id" ? "Jatuh Tempo" : "Due Date"} value={formattedDate} />
          </>
        }
      />

      <CtaButton
        label={lang === "id" ? "Lihat Invoice & Bayar" : "View Invoice & Pay"}
        href={invoiceLink}
      />
    </EmailLayout>
  );
};

export default InvoiceEmail;
