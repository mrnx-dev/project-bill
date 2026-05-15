import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  ENCRYPTION_KEY: z.string().min(64, "ENCRYPTION_KEY must be at least 64 characters"),
  APP_URL: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  AUTH_TRUST_HOST: z.string().optional(),
  DEPLOYMENT_MODE: z.enum(["self-hosted", "managed"]).default("self-hosted"),
  // New Casdoor variables
  CASDOOR_ENDPOINT: z.string().optional(),
  CASDOOR_CLIENT_ID: z.string().optional(),
  CASDOOR_CLIENT_SECRET: z.string().optional(),
  CASDOOR_ORG_NAME: z.string().optional(),
  // AI Assistant
  AI_PROVIDER: z.enum(["openrouter", "openai", "anthropic", "local"]).default("openrouter"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("anthropic/claude-sonnet-4-20250514"),
  AI_BASE_URL: z.string().optional(),
  // Client Portal JWT
  CLIENT_JWT_SECRET: z.string().optional(),
  CLIENT_JWT_EXPIRY: z.string().optional(),
}).passthrough();

// Validate `process.env` against our schema
const envConfig = envSchema.safeParse(process.env);

if (!envConfig.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(envConfig.error.issues, null, 2),
  );
  throw new Error("Invalid environment variables");
}

export const env = envConfig.data;
