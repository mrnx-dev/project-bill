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
