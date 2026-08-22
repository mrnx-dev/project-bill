// Pure path matchers for the proxy. No env/auth imports so this module is
// unit-testable without a database or .env file.

// Public pages (no session required). Note: `/invoices` (dashboard list) is
// protected, while `/invoices/:id` and its print/sow subpaths are public.
const PUBLIC_PAGE_PREFIXES: string[] = ["/login", "/setup"];
const PUBLIC_PAGE_EXACT = new Set<string>(["/"]);

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PAGE_EXACT.has(pathname)) return true;
  if (PUBLIC_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  // /invoices/:id... (public invoice view) — but NOT bare /invoices
  if (pathname.startsWith("/invoices/")) return true;
  // /invite/:token
  if (pathname.startsWith("/invite/")) return true;
  // Public API routes (auth via signature/secret at the handler, not session).
  // Folded in so `isPublicPath` is the single public predicate (the proxy
  // checks `isPublicPath || isPublicApi`; the isPublicApi call is then
  // redundant but kept for clarity).
  if (isPublicApi(pathname)) return true;
  return false;
}

// Public API routes (auth via signature/secret at the handler, not session).
const PUBLIC_API_PREFIXES = [
  "/api/auth/",
  "/api/webhooks/",
  "/api/cron/",
  "/api/setup",
  "/api/invites/",
];

export function isPublicApi(pathname: string): boolean {
  if (PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return true;
  }
  // /api/invoices/:id/public-sow and /api/invoices/:id/pay are public;
  // /api/invoices/:id and /api/invoices/:id/mark-paid are NOT.
  if (/^\/api\/invoices\/[^/]+\/(public-sow|pay)$/.test(pathname)) return true;
  // /api/projects/:id/public-sow is public
  if (/^\/api\/projects\/[^/]+\/public-sow$/.test(pathname)) return true;
  return false;
}

// --- Client portal predicates (pure; proxy-safe) ---
export function isPortalPublic(pathname: string): boolean {
  return (
    pathname === "/portal/login" ||
    pathname === "/api/client-portal/auth/request" ||
    pathname === "/api/client-portal/auth/verify"
  );
}

export function portalNeedsSession(pathname: string): boolean {
  if (!pathname.startsWith("/portal/") && !pathname.startsWith("/api/client-portal/")) return false;
  return !isPortalPublic(pathname);
}
