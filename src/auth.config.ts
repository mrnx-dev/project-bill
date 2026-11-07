import type { NextAuthConfig } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      activeOrganizationId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role?: string;
    defaultOrganizationId?: string;
  }
}

import { DefaultSession } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Lazy import keeps this config edge-safe without a top-level DB import.
      const { prisma } = await import("@/lib/prisma");

      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      const userId = (user?.id ?? token.id) as string | undefined;

      // One DB round-trip per request is accepted deliberately: only live
      // membership checks close the stale-JWT-after-revoke hole.
      if (userId) {
        const candidate =
          trigger === "update"
            ? ((session as any)?.activeOrganizationId as string | undefined)
            : undefined;
        // Fallback order: an account's default org (sign-in), then the
        // token's current org. At sign-in the token has no org yet.
        const current =
          (user?.defaultOrganizationId as string | undefined) ??
          (token.activeOrganizationId as string | undefined);

        // A candidate is preferred when the user is a member; otherwise we
        // keep (and still re-validate) the existing org. Never carry an
        // unvalidated org into the token — stale JWT after revoke.
        if (candidate) {
          const candidateMembership = await prisma.organizationMember.findUnique({
            where: {
              userId_organizationId: { userId, organizationId: candidate },
            },
          });
          if (candidateMembership) {
            token.activeOrganizationId = candidate;
            return token;
          }
        }

        if (current) {
          const membership = await prisma.organizationMember.findUnique({
            where: {
              userId_organizationId: { userId, organizationId: current },
            },
          });
          token.activeOrganizationId = membership ? current : undefined;
        } else {
          token.activeOrganizationId = undefined;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.activeOrganizationId = token.activeOrganizationId as string | undefined;
      }
      return session;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
