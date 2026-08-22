import crypto from "crypto";
import { env } from "./env";

export const COOKIE_NAME = "pb_client_session";

export type SessionPayload = {
  clientId: string;
  exp: number; // epoch ms
  sessionVersion: number;
};

/** Cryptographically-random 32-byte token, base64url (for the magic link). */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** SHA-256 hex of a token — we store the HASH, never the raw token. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Sign a session payload into `clientId.exp.sessionVersion.signature` (HMAC-SHA256). */
export function signSession(payload: SessionPayload): string {
  const data = `${payload.clientId}.${payload.exp}.${payload.sessionVersion}`;
  const sig = crypto.createHmac("sha256", env.AUTH_SECRET).update(data).digest("hex");
  return `${data}.${sig}`;
}

/** Verify a signed cookie. Returns the payload, or null if tampered/expired/malformed.
 *  Edge-safe: no DB. (Used by the proxy as the coarse gate.) */
export function verifySessionCookie(raw: string | undefined): SessionPayload | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const [clientId, expStr, verStr, sig] = parts;
  if (!clientId) return null;
  const data = `${clientId}.${expStr}.${verStr}`;
  const expected = crypto.createHmac("sha256", env.AUTH_SECRET).update(data).digest("hex");
  if (sig !== expected) return null; // tampered
  const exp = Number(expStr);
  const sessionVersion = Number(verStr);
  if (Number.isNaN(exp) || Number.isNaN(sessionVersion)) return null;
  if (exp < Date.now()) return null; // expired
  return { clientId, exp, sessionVersion };
}

/** Authoritative session: verify cookie + DB sessionVersion check (revocation).
 *  Lazy-imports prisma so this module's top-level stays prisma-free (proxy-safe). */
export async function getClientSession(): Promise<{
  clientId: string;
  organizationId: string;
  clientName: string;
} | null> {
  const { cookies } = await import("next/headers");
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  const payload = verifySessionCookie(raw);
  if (!payload) return null;
  const { prisma } = await import("./prisma"); // lazy — keeps proxy import light
  const auth = await prisma.clientAuth.findUnique({
    where: { clientId: payload.clientId },
    include: { client: true },
  });
  if (!auth || auth.sessionVersion !== payload.sessionVersion) return null; // revoked
  return {
    clientId: auth.clientId,
    organizationId: auth.client.organizationId,
    clientName: auth.client.name,
  };
}
