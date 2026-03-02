import { z } from "zod";

const envSchema = z.object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
    NEXT_PUBLIC_APP_URL: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM_EMAIL: z.string().optional(),
    MAYAR_API_URL: z.string().optional(),
    MAYAR_API_KEY: z.string().optional(),
    MAYAR_WEBHOOK_SECRET: z.string().optional(),
    CRON_SECRET: z.string().optional(),
});

// Validate `process.env` against our schema
const envConfig = envSchema.safeParse(process.env);

if (!envConfig.success) {
    console.error("❌ Invalid environment variables:", envConfig.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
}

export const env = envConfig.data;
