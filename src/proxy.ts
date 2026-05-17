import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { rlsContext } from "@/lib/rls";
import { verifyClientJWT } from "@/lib/client-jwt";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/setup",
  "/api/setup",
  "/invite",
  "/invoices",
  "/client/login",
  "/api/auth",
  "/api/invites",
  "/api/webhooks",
  "/api/cron",
  "/_next",
  "/favicon.ico",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  // Specific public API sub-routes under /api/invoices/[id]/ and /api/projects/[id]/
  if (/^\/api\/invoices\/[^/]+\/(public-sow|pay)$/.test(pathname)) return true;
  if (/^\/api\/projects\/[^/]+\/public-sow$/.test(pathname)) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth, no RLS context needed
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const isApiRoute = pathname.startsWith("/api");
  const isClientApi = pathname.startsWith("/api/client-portal");
  const isClientPage = pathname === "/client" || pathname.startsWith("/client/");
  const isClientAuthApi = pathname.startsWith("/api/client-portal/auth");

  // Client portal auth APIs are public
  if (isClientAuthApi) {
    return NextResponse.next();
  }

  // Client portal routes — verify JWT
  if (isClientApi || isClientPage) {
    const cookie = request.cookies.get("client_session");
    if (!cookie?.value) {
      if (isClientApi) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
      return NextResponse.redirect(new URL("/client/login", request.url));
    }

    const payload = await verifyClientJWT(cookie.value);
    if (!payload) {
      if (isClientApi) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
      const resp = NextResponse.redirect(new URL("/client/login", request.url));
      resp.cookies.delete("client_session");
      return resp;
    }

    return rlsContext.run(
      { organizationId: payload.organizationId },
      () => NextResponse.next(),
    );
  }

  // Admin routes — verify NextAuth session
  const session = await auth();
  if (!session?.user?.activeOrganizationId) {
    if (isApiRoute) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return rlsContext.run(
    { organizationId: session.user.activeOrganizationId },
    () => NextResponse.next(),
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.ico).*)",
  ],
};
