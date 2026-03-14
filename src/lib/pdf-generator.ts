import puppeteer from 'puppeteer';
import { getBaseUrl } from './utils';

export async function generateSowPdfBuffer(invoiceId: string): Promise<Buffer> {
    const baseUrl = getBaseUrl();
    // We use the exact print URL the user likes
    const targetUrl = `${baseUrl}/invoices/${invoiceId}/sow/print`;
    console.log(`[PDF Generator] Target URL for SOW: ${targetUrl}`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();

        // Set a standard viewport
        await page.setViewport({ width: 1200, height: 800 });

        // Bypass ngrok anti-abuse landing page
        await page.setExtraHTTPHeaders({
            'ngrok-skip-browser-warning': 'true',
        });

        // Navigate to the print page.
        // networkidle0 ensures all network requests (like fonts) are finished before printing
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });

        // Let's add a small artificial delay just to ensure React has fully hydrated and rendered the Markdown
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Generate PDF exactly as the user would with 'Print to PDF'
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true, // ensure background colors/borders are printed
            margin: {
                top: '0cm',
                bottom: '0cm',
                left: '0cm',
                right: '0cm'
            }
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}

export async function generateInvoicePdfBuffer(invoiceId: string): Promise<Buffer> {
    const baseUrl = getBaseUrl();
    const targetUrl = `${baseUrl}/invoices/${invoiceId}/print`;
    console.log(`[PDF Generator] Target URL for Invoice: ${targetUrl}`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();

        await page.setViewport({ width: 1200, height: 800 });

        await page.setExtraHTTPHeaders({
            'ngrok-skip-browser-warning': 'true',
        });

        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });

        await new Promise((resolve) => setTimeout(resolve, 1500));

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0cm',
                bottom: '0cm',
                left: '0cm',
                right: '0cm'
            }
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}
