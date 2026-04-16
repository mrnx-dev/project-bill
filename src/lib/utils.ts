import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely retrieves and sanitizes the application base URL from environment variables.
 * Handles surrounding quotes and missing protocols.
 */
export function getBaseUrl() {
  let url = process.env.APP_URL || "http://localhost:3000";

  // 1. Remove surrounding quotes (common in some hosting environments/dotenv setups)
  url = url.replace(/^["']|["']$/g, "").trim();

  // 2. Ensure protocol is present
  if (url && !url.startsWith("http")) {
    url = `https://${url}`;
  }

  // 3. Remove trailing slash for consistency
  return url.replace(/\/$/, "");
}

/**
 * Formats a screaming snake case or uppercase string to human-readable format.
 * Example: 'FULL_PAYMENT' -> 'Full Payment'
 */
export function formatEnum(str: string): string {
  if (!str) return str;
  return str.replace(/_/g, " ").replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

/**
 * Checks if a string looks like a system enum (ALL CAPS with optional underscores).
 */
export function isEnumLike(str: string): boolean {
  if (!str) return false;
  return /^[A-Z0-9_]+$/.test(str);
}
