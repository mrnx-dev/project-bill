import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout, InvoiceCard, CtaButton, DetailRow } from "./EmailLayout";
import type { CompanyInfo, Language } from "./EmailLayout";

export type ReminderType = "pre_due" | "overdue_d1" | "overdue_d3" | "late_fee";

interface ReminderEmailProps {
    clientName: string;
    projectName: string;
    invoiceId: string;
    amount: string;
    invoiceLink: string;
    reminderType: ReminderType;
    lateFeeAmount?: string;
    company?: CompanyInfo;
    lang?: Language;
}

const REMINDER_CONFIG: Record<
    ReminderType,
    {
        badgeType: "pre_due" | "overdue" | "late_fee";
        preview: Record<Language, (project: string) => string>;
        message: Record<Language, (project: string) => React.ReactNode>;
        closing: Record<Language, string>;
        useLateFeeAmount?: boolean;
    }
> = {
    pre_due: {
        badgeType: "pre_due",
        preview: {
            id: (p) => `Pengingat: Invoice untuk "${p}" jatuh tempo dalam 3 hari`,
            en: (p) => `Reminder: Invoice for "${p}" is due in 3 days`,
        },
        message: {
            id: (p) => (
                <>
                    Ini adalah pengingat ramah bahwa invoice Anda untuk <strong>{p}</strong> akan
                    jatuh tempo dalam <strong>3 hari</strong>.
                </>
            ),
            en: (p) => (
                <>
                    This is a friendly reminder that your invoice for <strong>{p}</strong> is
                    due in <strong>3 days</strong>.
                </>
            ),
        },
        closing: {
            id: "Harap selesaikan pembayaran secepatnya untuk menghindari keterlambatan.",
            en: "Please complete the payment at your earliest convenience to avoid any delays.",
        },
    },
    overdue_d1: {
        badgeType: "overdue",
        preview: {
            id: (p) => `Terlambat: Invoice untuk "${p}" telah melewati jatuh tempo`,
            en: (p) => `Overdue: Invoice for "${p}" is now past due`,
        },
        message: {
            id: (p) => (
                <>
                    Invoice Anda untuk <strong>{p}</strong> seharusnya dibayar{" "}
                    <strong>kemarin</strong> dan sekarang telah melewati batas waktu.
                </>
            ),
            en: (p) => (
                <>
                    Your invoice for <strong>{p}</strong> was due{" "}
                    <strong>yesterday</strong> and is now overdue.
                </>
            ),
        },
        closing: {
            id: "Harap memproses pembayaran ini sesegera mungkin.",
            en: "Please process this payment as soon as possible.",
        },
    },
    overdue_d3: {
        badgeType: "overdue",
        preview: {
            id: (p) => `Follow-up: Invoice untuk "${p}" terlambat 3 hari`,
            en: (p) => `Follow-up: Invoice for "${p}" is 3 days overdue`,
        },
        message: {
            id: (p) => (
                <>
                    Ini adalah pengingat tindak lanjut. Invoice Anda untuk <strong>{p}</strong> sekarang
                    telah <strong>terlambat 3 hari</strong>.
                </>
            ),
            en: (p) => (
                <>
                    This is a follow-up reminder. Your invoice for <strong>{p}</strong> is
                    now <strong>3 days overdue</strong>.
                </>
            ),
        },
        closing: {
            id: "Harap dicatat bahwa denda keterlambatan mungkin berlaku jika pembayaran tetap belum dilunasi.",
            en: "Please note that a late fee may be applied if payment remains outstanding.",
        },
    },
    late_fee: {
        badgeType: "late_fee",
        preview: {
            id: (p) => `Pemberitahuan: Denda keterlambatan berlaku untuk invoice "${p}"`,
            en: (p) => `Notice: Late fee applied to invoice for "${p}"`,
        },
        message: {
            id: (p) => (
                <>
                    Invoice Anda untuk <strong>{p}</strong> sekarang telah{" "}
                    <strong>terlambat 7 hari</strong>. Tambahan <strong>denda 5%</strong> telah
                    dikenakan.
                </>
            ),
            en: (p) => (
                <>
                    Your invoice for <strong>{p}</strong> is now{" "}
                    <strong>7 days overdue</strong>. A <strong>5% late fee</strong> has been
                    applied.
                </>
            ),
        },
        closing: {
            id: "Harap lunasi invoice ini segera untuk mencegah tindakan lebih lanjut.",
            en: "Please settle this invoice immediately to prevent further action.",
        },
        useLateFeeAmount: true,
    },
};

export const ReminderEmail = ({
    clientName = "Client Name",
    projectName = "Website Development",
    invoiceId = "INV-1234",
    amount = "Rp 1,000,000",
    invoiceLink = "https://projectbill.com/invoices/INV-1234",
    reminderType = "pre_due",
    lateFeeAmount,
    company,
    lang = "id",
}: ReminderEmailProps) => {
    const config = REMINDER_CONFIG[reminderType];
    const displayAmount = config.useLateFeeAmount && lateFeeAmount ? lateFeeAmount : amount;

    return (
        <EmailLayout preview={config.preview[lang](projectName)} company={company} lang={lang}>
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
                {config.message[lang](projectName)}
            </Text>

            <InvoiceCard
                badgeType={config.badgeType}
                amount={displayAmount}
                clientName={clientName}
                projectName={projectName}
                lang={lang}
                extraRows={
                    <DetailRow label={lang === "id" ? "No. Invoice" : "Invoice No."} value={`#${invoiceId.split("-")[0]}`} />
                }
            />

            <Text
                style={{
                    fontSize: 14,
                    color: "#6b7280",
                    lineHeight: "22px",
                    margin: "0 0 8px 0",
                }}
            >
                {config.closing[lang]}
            </Text>

            <CtaButton label={lang === "id" ? "Lihat Invoice & Bayar" : "View Invoice & Pay"} href={invoiceLink} />
        </EmailLayout>
    );
};

export default ReminderEmail;
