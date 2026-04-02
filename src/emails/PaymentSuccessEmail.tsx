import { Section, Text } from "@react-email/components";
import {
    EmailLayout,
    StatusBadge,
    DetailRow,
    CtaButton,
} from "./EmailLayout";
import type { CompanyInfo, Language } from "./EmailLayout";

interface PaymentSuccessEmailProps {
    clientName: string;
    projectName: string;
    invoiceNumber: string;
    amount: string;
    invoiceLink: string;
    hasSowAttachment?: boolean;
    company?: CompanyInfo;
    lang?: Language;
}

export const PaymentSuccessEmail = ({
    clientName = "Client Name",
    projectName = "Website Development",
    invoiceNumber = "INV-1234",
    amount = "Rp 1,000,000",
    invoiceLink = "https://projectbill.com/invoices/INV-1234",
    hasSowAttachment = false,
    company,
    lang = "id",
}: PaymentSuccessEmailProps) => {
    const previewText = lang === "id"
        ? "Pembayaran Diterima - Terima kasih atas kerjasamanya!"
        : "Payment Received - Thank you for your business!";

    return (
        <EmailLayout preview={previewText} company={company} lang={lang}>
            <Text
                style={{
                    fontSize: 14,
                    color: "#374151",
                    lineHeight: "22px",
                    margin: "0 0 8px 0",
                }}
            >
                {lang === "id" ? `Halo ${clientName},` : `Hello ${clientName},`}
            </Text>
            <Text
                style={{
                    fontSize: 14,
                    color: "#374151",
                    lineHeight: "22px",
                    margin: "0 0 4px 0",
                }}
            >
                {lang === "id" ? (
                    <>
                        Kami telah berhasil menerima pembayaran Anda sebesar <strong>{amount}</strong>{" "}
                        untuk proyek: <strong>{projectName}</strong>.
                    </>
                ) : (
                    <>
                        We have successfully received your payment of <strong>{amount}</strong>{" "}
                        for the project: <strong>{projectName}</strong>.
                    </>
                )}
            </Text>

            {/* Payment Card */}
            <Section
                style={{
                    backgroundColor: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 20,
                    margin: "20px 0",
                }}
            >
                <div style={{ marginBottom: 16 }}>
                    <StatusBadge type="paid" lang={lang} />
                </div>
                <Text
                    style={{
                        margin: "0 0 16px 0",
                        fontSize: 28,
                        fontWeight: 700,
                        color: "#111827",
                        letterSpacing: "-0.02em",
                    }}
                >
                    {amount}
                </Text>
                <table cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                    <tbody>
                        <DetailRow label={lang === "id" ? "Tagihan Kepada" : "Billed To"} value={clientName} />
                        <DetailRow label={lang === "id" ? "Proyek" : "Project"} value={projectName} />
                        <DetailRow label={lang === "id" ? "No. Invoice" : "Invoice No."} value={invoiceNumber} />
                    </tbody>
                </table>
            </Section>

            <Text
                style={{
                    fontSize: 14,
                    color: "#374151",
                    lineHeight: "22px",
                    margin: "0 0 16px 0",
                }}
            >
                {lang === "id" ? (
                    "Invoice Anda telah ditandai sebagai lunas. Anda dapat melihat detail lengkap dan kuitansi pembayaran menggunakan tombol di bawah ini."
                ) : (
                    "Your invoice has been marked as paid. You can view the full details and receipt using the button below."
                )}
            </Text>

            {hasSowAttachment ? (
                <Text
                    style={{
                        fontSize: 14,
                        color: "#374151",
                        lineHeight: "22px",
                        margin: "0 0 16px 0",
                    }}
                >
                    {lang === "id" ? (
                        "Terlampir adalah dokumen Invoice dan Statement of Work (SOW) resmi untuk arsip Anda."
                    ) : (
                        "Please find attached your Invoice and official Statement of Work (SOW) documents for your records."
                    )}
                </Text>
            ) : (
                <Text
                    style={{
                        fontSize: 14,
                        color: "#374151",
                        lineHeight: "22px",
                        margin: "0 0 16px 0",
                    }}
                >
                    {lang === "id" ? (
                        "Terlampir adalah dokumen Invoice resmi untuk arsip Anda."
                    ) : (
                        "Please find attached your official Invoice document for your records."
                    )}
                </Text>
            )}

            <CtaButton label={lang === "id" ? "Lihat Invoice" : "View Invoices"} href={invoiceLink} />
        </EmailLayout>
    );
};

export default PaymentSuccessEmail;
