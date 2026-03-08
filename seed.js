/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.sOWTemplate.create({
        data: {
            name: 'Default SOW Template',
            content: '1. Ruang Lingkup: Pembuatan website profil bisnis.\n2. Revisi: Maksimal 2 kali revisi minor.\n3. Pembayaran: 50% DP, 50% pelunasan sebelum rilis.\n4. Garansi: Bug fixing selama 1 bulan setelah rilis.'
        }
    });
    console.log('Seeded default template.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
