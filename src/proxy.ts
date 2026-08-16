import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { env } from "@/lib/env";
import { isPublicPath } from "@/lib/proxy-paths";

export { isPublicPath };

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Authenticated user hitting /login -> send to dashboard root. Must run
  // BEFORE the public-path pass-through below: /login is public, so checking
  // it after the short-circuit would be dead code.
  if (pathname === "/login") {
    const token = await getToken({ req, secret: env.AUTH_SECRET });
    if (token) return NextResponse.redirect(new URL("/board", req.url));
  }

  // Public pages and public API pass through. isPublicPath folds in the
  // API-public cases (see proxy-paths.ts), so a separate isPublicApi call is
  // redundant here.
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: env.AUTH_SECRET });

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
