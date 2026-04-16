import type { NextAuthConfig } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role?: string;
  }
}

import { DefaultSession } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, profile, account }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      // Handle Casdoor profile role mapping if available
      if (profile && account?.provider === "casdoor") {
        const casdoorProfile = profile as any;
        token.role = casdoorProfile.role === "admin" ? "admin" : "staff";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
