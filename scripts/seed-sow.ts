import { prisma } from '../src/lib/prisma';

async function main() {
    await prisma.sOWTemplate.create({
        data: {
            name: 'Default SOW Template',
            content: '1. Ruang Lingkup: Pembuatan website profil bisnis.\n2. Revisi: Maksimal 2 kali revisi minor.\n3. Pembayaran: 50% DP, 50% pelunasan sebelum rilis.\n4. Garansi: Bug fixing selama 1 bulan setelah rilis.'
        }
    });
    console.log('Successfully seeded the default SOW Template!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
