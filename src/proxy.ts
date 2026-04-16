import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Public routes that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/setup",
  "/api/auth",        // NextAuth callback routes
  "/api/webhooks",    // External webhooks (Mayar, etc.)
  "/invoices",        // Public invoice view: /invoices/[id]
];

// API routes that need auth check (return 401 instead of redirect)
const API_PREFIX = "/api/";

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // API routes: return 401 if not authenticated
  if (pathname.startsWith(API_PREFIX)) {
    if (!isLoggedIn) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Dashboard routes: redirect to /login if not authenticated
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

// Matcher: run middleware on all routes except static assets
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
