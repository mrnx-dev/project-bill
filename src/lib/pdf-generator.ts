import puppeteer from 'puppeteer';
import { getBaseUrl } from './utils';
// Puppeteer navigates from inside the container using APP_URL (hairpin through the
// CDN measured fast). The Debian runner image ships puppeteer's own version-matched
// chrome-headless-shell via PUPPETEER_EXECUTABLE_PATH — alpine's chromium package was
// too old for puppeteer 24's CDP protocol and hung intermittently.

export async function renderPdf(targetUrl: string, label: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        // Bypass ngrok anti-abuse landing page
        await page.setExtraHTTPHeaders({ 'ngrok-skip-browser-warning': 'true' });
        // networkidle0 ensures all network requests (like fonts) are finished before printing
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        // Small delay so React has fully hydrated and rendered the Markdown
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true, // ensure background colors/borders are printed
            margin: { top: '0cm', bottom: '0cm', left: '0cm', right: '0cm' },
        });
        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}

export async function generateSowPdfBuffer(invoiceId: string): Promise<Buffer> {
    const targetUrl = `${getBaseUrl()}/invoices/${invoiceId}/sow/print`;
    console.log(`[PDF Generator] Target URL for contract: ${targetUrl}`);
    return renderPdf(targetUrl, 'SOW');
}

export async function generateInvoicePdfBuffer(invoiceId: string): Promise<Buffer> {
    const targetUrl = `${getBaseUrl()}/invoices/${invoiceId}/print`;
    console.log(`[PDF Generator] Target URL for Invoice: ${targetUrl}`);
    return renderPdf(targetUrl, 'Invoice');
}
