/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function resetPassword() {
    const email = process.argv[2];
    const newPassword = process.argv[3];

    if (!email || !newPassword) {
        console.error('Usage: npm run reset-password <email> <newPassword>');
        console.error('Example: npm run reset-password admin@example.com mynewpassword123');
        process.exit(1);
    }

    if (newPassword.length < 6) {
        console.error('Error: New password must be at least 6 characters long.');
        process.exit(1);
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            console.error(`Error: User with email '${email}' not found.`);
            process.exit(1);
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });

        console.log(`✅ Password successfully reset for user: ${email}`);

    } catch (error) {
        console.error('❌ Failed to reset password:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetPassword();
