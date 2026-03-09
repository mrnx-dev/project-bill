import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Section,
    Text,
} from "@react-email/components";
import * as React from "react";

// ── Company Info Interface ────────────────────────────────────

export interface CompanyInfo {
    companyName: string;
    companyEmail?: string | null;
    companyLogoUrl?: string | null;
    companyAddress?: string | null;
}

const DEFAULT_COMPANY: CompanyInfo = {
    companyName: "ProjectBill",
    companyEmail: null,
    companyLogoUrl: null,
    companyAddress: null,
};

// ── Shared Types ─────────────────────────────────────────────

export type Language = "id" | "en";

// ── Email Layout ─────────────────────────────────────────────

interface EmailLayoutProps {
    preview: string;
    company?: CompanyInfo;
    lang?: Language;
    children: React.ReactNode;
}

export const EmailLayout = ({ preview, company, lang = "id", children }: EmailLayoutProps) => {
    const c = company || DEFAULT_COMPANY;
    const supportEmail = c.companyEmail || "support@mrndev.me";

    const supportText = lang === "id"
        ? "Butuh bantuan? Hubungi kami di "
        : "Need help? Contact us at ";

    return (
        <Html lang={lang}>
            <Head>
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
            </Head>
            <Body
                style={{
                    margin: 0,
                    padding: 0,
                    backgroundColor: "#f3f4f6",
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                }}
            >
                {/* Hidden preview text */}
                <div style={{ display: "none", maxHeight: 0, overflow: "hidden" }}>
                    {preview}
                </div>

                <Container style={{ padding: "40px 16px", maxWidth: 480, margin: "0 auto" }}>
                    {/* Header: Company Branding */}
                    <Section style={{ textAlign: "center", paddingBottom: 24 }}>
                        {c.companyLogoUrl ? (
                            <Img
                                src={c.companyLogoUrl}
                                alt={c.companyName}
                                height={40}
                                style={{ margin: "0 auto 8px auto", display: "block", borderRadius: "8px" }}
                            />
                        ) : (
                            <Heading
                                style={{
                                    margin: 0,
                                    fontSize: 22,
                                    fontWeight: 700,
                                    color: "#111827",
                                    letterSpacing: "-0.02em",
                                }}
                            >
                                {c.companyName}
                            </Heading>
                        )}
                    </Section>

                    {/* Main Card */}
                    <Section
                        style={{
                            backgroundColor: "#ffffff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: 28,
                        }}
                    >
                        {children}
                    </Section>

                    {/* Footer */}
                    <Section style={{ textAlign: "center", paddingTop: 24 }}>
                        <Text
                            style={{
                                margin: "0 0 4px 0",
                                fontSize: 12,
                                color: "#9ca3af",
                                lineHeight: "20px",
                            }}
                        >
                            {supportText}
                            <a
                                href={`mailto:${supportEmail}`}
                                style={{ color: "#6b7280", textDecoration: "underline" }}
                            >
                                {supportEmail}
                            </a>
                        </Text>
                        <Text
                            style={{
                                margin: 0,
                                fontSize: 11,
                                color: "#d1d5db",
                                lineHeight: "18px",
                            }}
                        >
                            Powered by ProjectBill
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

// ── Shared Sub-Components ────────────────────────────────────

interface StatusBadgeProps {
    type: "unpaid" | "pre_due" | "overdue" | "late_fee" | "paid";
    lang?: Language;
}

const BADGE_STYLES: Record<StatusBadgeProps["type"], { bg: string; text: string; label: Record<Language, string> }> = {
    unpaid: { bg: "#fee2e2", text: "#b91c1c", label: { id: "BELUM BAYAR", en: "UNPAID" } },
    pre_due: { bg: "#fef3c7", text: "#92400e", label: { id: "SEGERA JATUH TEMPO", en: "DUE SOON" } },
    overdue: { bg: "#ffedd5", text: "#c2410c", label: { id: "JATUH TEMPO", en: "OVERDUE" } },
    late_fee: { bg: "#fee2e2", text: "#b91c1c", label: { id: "TERLAMBAT", en: "LATE FEE" } },
    paid: { bg: "#d1fae5", text: "#065f46", label: { id: "LUNAS", en: "PAID" } },
};

export const StatusBadge = ({ type, lang = "id" }: StatusBadgeProps) => {
    const badge = BADGE_STYLES[type];
    return (
        <span
            style={{
                backgroundColor: badge.bg,
                color: badge.text,
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 12px",
                borderRadius: 9999,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "inline-block",
            }}
        >
            {badge.label[lang]}
        </span>
    );
};

interface DetailRowProps {
    label: string;
    value: string;
}

export const DetailRow = ({ label, value }: DetailRowProps) => (
    <tr>
        <td style={{ paddingBottom: 6 }}>
            <Text
                style={{
                    margin: 0,
                    fontSize: 12,
                    color: "#9ca3af",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                }}
            >
                {label}
            </Text>
            <Text
                style={{
                    margin: "2px 0 0 0",
                    fontSize: 14,
                    color: "#374151",
                    fontWeight: 500,
                }}
            >
                {value}
            </Text>
        </td>
    </tr>
);

interface InvoiceCardProps {
    badgeType: StatusBadgeProps["type"];
    amount: string;
    clientName: string;
    projectName: string;
    lang?: Language;
    extraRows?: React.ReactNode;
}

export const InvoiceCard = ({
    badgeType,
    amount,
    clientName,
    projectName,
    lang = "id",
    extraRows,
}: InvoiceCardProps) => (
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
            <StatusBadge type={badgeType} lang={lang} />
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
                {extraRows}
            </tbody>
        </table>
    </Section>
);

interface CtaButtonProps {
    label: string;
    href: string;
}

export const CtaButton = ({ label, href }: CtaButtonProps) => (
    <Section style={{ textAlign: "center", margin: "8px 0 4px 0" }}>
        <a
            href={href}
            target="_blank"
            style={{
                display: "inline-block",
                padding: "12px 32px",
                fontSize: 14,
                fontWeight: 600,
                color: "#ffffff",
                backgroundColor: "#1d4ed8",
                borderRadius: 6,
                textDecoration: "none",
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
        >
            {label}
        </a>
    </Section>
);

export default EmailLayout;
