import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register standard fonts if needed, or stick to built-ins like Helvetica
// Register standard fonts
Font.register({
    family: 'Open Sans',
    fonts: [
        { src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-regular.ttf' },
        { src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-700.ttf', fontWeight: 'bold' },
        { src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-italic.ttf', fontStyle: 'italic' },
    ]
});

// Create styles
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Open Sans',
        fontSize: 10,
        color: '#333',
        lineHeight: 1.5,
    },
    header: {
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        paddingBottom: 20,
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0F172A',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#475569',
    },
    metaText: {
        fontSize: 10,
        color: '#64748B',
        marginBottom: 2,
        textAlign: 'right',
    },
    content: {
        marginBottom: 30,
        textAlign: 'justify',
    },
    h3: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0F172A',
        marginTop: 15,
        marginBottom: 8,
    },
    paragraph: {
        marginBottom: 10,
    },
    auditTrail: {
        marginTop: 30,
        paddingTop: 15,
        borderTopWidth: 2,
        borderTopColor: '#0F172A',
    },
    auditTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0F172A',
        marginBottom: 12,
    },
    auditRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 15,
    },
    auditCol: {
        width: '50%',
        paddingRight: 10,
        marginBottom: 10,
    },
    auditLabel: {
        fontWeight: 'bold',
        color: '#0F172A',
        marginBottom: 4,
    },
    auditValue: {
        backgroundColor: '#F1F5F9',
        padding: 6,
        borderRadius: 4,
        color: '#334155',
    },
    footerText: {
        marginTop: 20,
        fontSize: 8,
        color: '#94A3B8',
        textAlign: 'center',
        fontStyle: 'italic',
    },
});

export interface SOWDocumentProps {
    project: {
        title: string;
        client: {
            name: string;
        };
        terms: string;
        termsAcceptedAt: Date | string | null;
        termsAcceptedUserAgent: string | null;
        termsAcceptedSessionId: string | null;
    };
}

// A simple Markdown-to-PDF text parser heuristic
// @react-pdf/renderer doesn't support Markdown natively, so we render simple blocks
const renderMarkdownTerms = (mdText: string) => {
    if (!mdText) return null;
    const blocks = mdText.split('\n\n');
    return blocks.map((block, i) => {
        block = block.trim();
        if (block.startsWith('###')) {
            return (
                <Text key={i} style={styles.h3}>
                    {block.replace(/###/g, '').trim()}
                </Text>
            );
        }
        if (block.startsWith('##')) {
            return (
                <Text key={i} style={[styles.h3, { fontSize: 16 }]}>
                    {block.replace(/##/g, '').trim()}
                </Text>
            );
        }
        if (block.startsWith('#')) {
            return (
                <Text key={i} style={[styles.h3, { fontSize: 18 }]}>
                    {block.replace(/#/g, '').trim()}
                </Text>
            );
        }
        return (
            <Text key={i} style={styles.paragraph}>
                {block.replace(/\*\*(.*?)\*\*/g, '$1')}
            </Text>
        );
    });
};

export const SOWDocument = ({ project }: SOWDocumentProps) => {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Statement of Work</Text>
                        <Text style={styles.headerSubtitle}>{project.title}</Text>
                    </View>
                    <View>
                        <Text style={styles.metaText}>Client: {project.client.name}</Text>
                        <Text style={styles.metaText}>
                            Date Generated: {new Date().toLocaleDateString('en-US')}
                        </Text>
                    </View>
                </View>

                <View style={styles.content}>
                    {renderMarkdownTerms(project.terms)}
                </View>

                {project.termsAcceptedAt && (
                    <View style={styles.auditTrail}>
                        <Text style={styles.auditTitle}>Electronic Signature - Audit Trail</Text>

                        <View style={styles.auditRow}>
                            <View style={styles.auditCol}>
                                <Text style={styles.auditLabel}>Accepted By</Text>
                                <Text style={styles.auditValue}>{project.client.name}</Text>
                            </View>
                            <View style={styles.auditCol}>
                                <Text style={styles.auditLabel}>Timestamp (UTC)</Text>
                                <Text style={styles.auditValue}>
                                    {new Date(project.termsAcceptedAt).toUTCString()}
                                </Text>
                            </View>
                            <View style={styles.auditCol}>
                                <Text style={styles.auditLabel}>User Agent</Text>
                                <Text style={styles.auditValue}>
                                    {(project.termsAcceptedUserAgent || 'Unknown').substring(0, 50)}...
                                </Text>
                            </View>
                            <View style={styles.auditCol}>
                                <Text style={styles.auditLabel}>Session ID Verification</Text>
                                <Text style={styles.auditValue}>
                                    {(project.termsAcceptedSessionId || 'Unknown').substring(0, 40)}
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.footerText}>
                            This document serves as a secure digital agreement generated by ProjectBill.
                            The audit trail above validates non-repudiation of the contracting parties.
                        </Text>
                    </View>
                )}
            </Page>
        </Document>
    );
};
