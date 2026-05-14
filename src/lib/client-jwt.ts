import { SignJWT, jwtVerify } from "jose";

const getSecret = () => {
  const secret = process.env.CLIENT_JWT_SECRET;
  if (!secret) throw new Error("CLIENT_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
};

const EXPIRY = parseInt(process.env.CLIENT_JWT_EXPIRY || "86400", 10); // 24h default

export interface ClientSessionPayload {
  clientId: string;
  email: string;
  organizationId: string;
}

export async function signClientJWT(payload: ClientSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY}s`)
    .sign(getSecret());
}

export async function verifyClientJWT(token: string): Promise<ClientSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as ClientSessionPayload;
  } catch {
    return null;
  }
}
