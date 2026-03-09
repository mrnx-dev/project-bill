import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128-bit IV
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
        throw new Error(
            "ENCRYPTION_KEY must be set in .env as a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32",
        );
    }
    return Buffer.from(key, "hex");
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a string in the format: `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Expects format: `iv:authTag:ciphertext` (all hex-encoded).
 * Returns null if decryption fails (e.g., wrong key or corrupted data).
 */
export function decrypt(encryptedValue: string): string | null {
    try {
        const key = getEncryptionKey();
        const parts = encryptedValue.split(":");

        if (parts.length !== 3) {
            // Not encrypted (legacy plaintext value), return as-is
            return encryptedValue;
        }

        const iv = Buffer.from(parts[0], "hex");
        const authTag = Buffer.from(parts[1], "hex");
        const ciphertext = parts[2];

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (error) {
        console.error("Decryption failed:", error);
        return null;
    }
}

/**
 * Masks a secret string for safe display.
 * Shows only the last 4 characters, prefixed with "****".
 * Returns null if the input is null/undefined/empty.
 */
export function maskSecret(value: string | null | undefined): string | null {
    if (!value) return null;
    if (value.length <= 4) return "****";
    return `****${value.slice(-4)}`;
}

/**
 * Checks if a value is a masked placeholder (starts with "****").
 * Used to detect unchanged fields in PUT requests.
 */
export function isMaskedValue(value: string | null | undefined): boolean {
    if (!value) return false;
    return value.startsWith("****");
}
