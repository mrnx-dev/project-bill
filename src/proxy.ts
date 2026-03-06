import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);
export default auth((_req) => {
  // req.auth
});

export const config = {
  matcher: [
    "/((?!api/webhook|api/webhooks|api/setup|invoices/[^/]+$|login|setup|_next|favicon).*)",
  ],
};
