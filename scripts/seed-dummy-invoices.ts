import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Menyiapkan data dummy untuk testing due date cron...");

    // Pastikan ada organisasi untuk mengaitkan data tenant (ClientAuth/Client/Project/Invoice butuh organizationId)
    const org = await prisma.organization.findFirst()
        ?? await prisma.organization.create({ data: { name: "Seed Org", slug: "seed-org" } });

    // 1. Buat Dummy Client
    const client = await prisma.client.create({
        data: {
            name: "Dummy Client (Cron Test)",
            // GANTI EMAIL INI dengan email Anda sendiri jika ingin menerima tes email dari Resend
            email: "dummy-cron-test@example.com",
            organizationId: org.id,
        },
    });

    // 2. Buat Dummy Project
    const project = await prisma.project.create({
        data: {
            clientId: client.id,
            title: "Proyek Tes Cron Reminders",
            totalPrice: 10000000,
            currency: "IDR",
            organizationId: org.id,
        },
    });

    const today = new Date();

    // Skenario 1: Pre-due (Jatuh tempo dalam 3 hari)
    const datePreDue = new Date(today);
    datePreDue.setDate(today.getDate() + 3);

    // Skenario 2: Overdue Hari 1 (Jatuh tempo 1 hari yang lalu)
    const dateOverdue1 = new Date(today);
    dateOverdue1.setDate(today.getDate() - 1);

    // Skenario 3: Overdue Hari 3 (Jatuh tempo 3 hari yang lalu)
    const dateOverdue3 = new Date(today);
    dateOverdue3.setDate(today.getDate() - 3);

    // Skenario 4: Late Fee (Jatuh tempo 7 hari yang lalu, perlu kena denda)
    const dateLateFee = new Date(today);
    dateLateFee.setDate(today.getDate() - 7);

    const testCases = [
        { dueDate: datePreDue, type: "full_payment", amount: 1000000, desc: "Pre-due (H-3)" },
        { dueDate: dateOverdue1, type: "full_payment", amount: 2000000, desc: "Overdue D1 (H+1)" },
        { dueDate: dateOverdue3, type: "full_payment", amount: 3000000, desc: "Overdue D3 (H+3)" },
        { dueDate: dateLateFee, type: "full_payment", amount: 4000000, desc: "Late Fee (H+7)" },
    ];

    for (const tc of testCases) {
        await prisma.invoice.create({
            data: {
                projectId: project.id,
                invoiceNumber: `TEST-${Math.floor(Math.random() * 100000)}`,
                type: tc.type,
                amount: tc.amount,
                status: "unpaid",
                dueDate: tc.dueDate,
                paymentLink: `https://example.com/pay/${Math.floor(Math.random() * 100000)}`, // Syarat agar bisa ditagih
                organizationId: org.id,
            },
        });
        console.log(`✅ Invoice untuk skenario ${tc.desc} berhasil dibuat (Tanggal: ${tc.dueDate.toISOString().split('T')[0]})`);
    }

    console.log("\nSelesai! Sekarang Anda bisa mencoba menjalankan cron job.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
