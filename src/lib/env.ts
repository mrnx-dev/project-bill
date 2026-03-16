import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be a 64-char hex string (32 bytes)"),
  APP_URL: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  AUTH_TRUST_HOST: z.string().optional(),
  DEPLOYMENT_MODE: z.enum(["self-hosted", "managed"]).default("self-hosted"),
});

// Validate `process.env` against our schema
const envConfig = envSchema.safeParse(process.env);

if (!envConfig.success) {
  console.error(
    "❌ Invalid environment variables:",
    envConfig.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables");
}

export const env = envConfig.data;
