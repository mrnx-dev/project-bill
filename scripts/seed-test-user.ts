import bcrypt from "bcryptjs";
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import "dotenv/config"; // Ensure .env is loaded

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    const testEmail = "admin@example.com";

    // Upsert test user
    const existingUser = await prisma.user.findUnique({
        where: { email: testEmail }
    });

    if (!existingUser) {
        const hashedPassword = await bcrypt.hash("password123", 10);
        await prisma.user.create({
            data: {
                name: "Test Admin",
                email: testEmail,
                password: hashedPassword
            }
        });
        console.log("Seeded test admin.");
    } else {
        // Reset password just in case
        const hashedPassword = await bcrypt.hash("password123", 10);
        await prisma.user.update({
            where: { email: testEmail },
            data: { password: hashedPassword }
        });
        console.log("Updated test admin password.");
    }
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
