// client-auth.ts imports @/lib/env (for AUTH_SECRET); mock it so the unit test
// doesn't need a real .env. Same pattern as casdoor-auth.test.ts.
jest.mock("@/lib/env", () => ({ env: { AUTH_SECRET: "test-auth-secret" } }));

import {
  generateToken,
  hashToken,
  signSession,
  verifySessionCookie,
  COOKIE_NAME,
} from "@/lib/client-auth";

describe("generateToken", () => {
  test("is 32-byte base64url (~43 chars) and unique", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).not.toEqual(b);
  });
});

describe("hashToken", () => {
  test("is deterministic (same input → same hash)", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });
  test("different input → different hash", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
  test("is a 64-char hex (sha-256)", () => {
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("signSession / verifySessionCookie", () => {
  test("round-trip: sign → verify → payload back", () => {
    const payload = { clientId: "c1", exp: Date.now() + 60000, sessionVersion: 0 };
    const signed = signSession(payload);
    expect(signed.split(".").length).toBe(4);
    const out = verifySessionCookie(signed);
    expect(out).toEqual(payload);
  });

  test("tampered signature → null", () => {
    const signed = signSession({ clientId: "c1", exp: Date.now() + 60000, sessionVersion: 0 });
    const tampered = signed.slice(0, -1) + (signed.endsWith("a") ? "b" : "a");
    expect(verifySessionCookie(tampered)).toBeNull();
  });

  test("expired exp → null", () => {
    const signed = signSession({ clientId: "c1", exp: Date.now() - 1, sessionVersion: 0 });
    expect(verifySessionCookie(signed)).toBeNull();
  });

  test("undefined / malformed → null", () => {
    expect(verifySessionCookie(undefined)).toBeNull();
    expect(verifySessionCookie("garbage")).toBeNull();
    expect(verifySessionCookie("a.b.c")).toBeNull();
  });
});

test("COOKIE_NAME is the client session cookie name", () => {
  expect(COOKIE_NAME).toBe("pb_client_session");
});
