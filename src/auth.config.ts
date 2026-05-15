import type { NextAuthConfig } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      activeOrganizationId?: string;
      activeOrganizationRole?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role?: string;
    defaultOrganizationId?: string;
    activeOrganizationRole?: string;
  }
}

import { DefaultSession } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.activeOrganizationId = user.defaultOrganizationId;
        token.activeOrganizationRole = user.activeOrganizationRole;
      }
      if (trigger === "update" && (session as any)?.activeOrganizationId) {
        token.activeOrganizationId = (session as any).activeOrganizationId;
        token.activeOrganizationRole = (session as any).activeOrganizationRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.activeOrganizationId = token.activeOrganizationId as string | undefined;
        session.user.activeOrganizationRole = token.activeOrganizationRole as string | undefined;
      }
      return session;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
