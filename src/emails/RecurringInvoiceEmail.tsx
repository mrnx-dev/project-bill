import { Text } from "@react-email/components";
import { EmailLayout, InvoiceCard, CtaButton, DetailRow } from "./EmailLayout";
import type { CompanyInfo, Language } from "./EmailLayout";

interface RecurringInvoiceEmailProps {
    clientName: string;
    invoiceId: string;
    projectName: string;
    amount: string;
    dueDate: Date | null;
    invoiceLink: string;
    description?: string | null;
    company?: CompanyInfo;
    lang?: Language;
}

export const RecurringInvoiceEmail = ({
    clientName = "Client Name",
    invoiceId = "INV-1234",
    projectName = "Website Maintenance",
    amount = "Rp 1,000,000",
    dueDate = new Date(),
    invoiceLink = "https://projectbill.com/invoices/INV-1234",
    description,
    company,
    lang = "id",
}: RecurringInvoiceEmailProps) => {
    const formattedDate = dueDate
        ? new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        }).format(dueDate)
        : (lang === "id" ? "Saat Diterima" : "Upon Receipt");

    const senderName = company?.companyName || "MRN Dev";

    const previewText = lang === "id"
        ? `Tagihan rutin baru dari ${senderName} untuk ${projectName}`
        : `New recurring invoice from ${senderName} for ${projectName}`;

    return (
        <EmailLayout preview={previewText} company={company} lang={lang}>
            <Text style={{ fontSize: 14, color: "#374151", lineHeight: "22px", margin: "0 0 8px 0" }}>
                {lang === "id" ? `Halo ${clientName},` : `Hello ${clientName},`}
            </Text>
            <Text style={{ fontSize: 14, color: "#374151", lineHeight: "22px", margin: "0 0 4px 0" }}>
                {lang === "id" ? (
                    <>
                        Ini adalah pemberitahuan bahwa tagihan rutin Anda untuk proyek{" "}
                        <strong>{projectName}</strong> telah diterbitkan. Silakan periksa rinciannya di bawah ini.
                    </>
                ) : (
                    <>
                        This is a notification that your recurring invoice for the{" "}
                        <strong>{projectName}</strong> project has been generated. Please review the details below.
                    </>
                )}
            </Text>

            {description && (
                <Text style={{ fontSize: 13, color: "#6B7280", lineHeight: "20px", margin: "4px 0 12px 0", fontStyle: "italic" }}>
                    {description}
                </Text>
            )}

            <InvoiceCard
                badgeType="unpaid"
                amount={amount}
                clientName={clientName}
                projectName={projectName}
                lang={lang}
                extraRows={
                    <>
                        <DetailRow label={lang === "id" ? "Tipe" : "Type"} value={lang === "id" ? "Tagihan Rutin" : "Recurring Invoice"} />
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

export default RecurringInvoiceEmail;
