import type { NextAuthConfig } from "next-auth";
import { prisma } from "@/lib/prisma";

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

      // DB fallback: if token has no activeOrganizationId but has a user id,
      // look up the user's defaultOrganizationId from the database
      if (!token.activeOrganizationId && token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
          });
          if (dbUser?.defaultOrganizationId) {
            const membership = await prisma.organizationMember.findUnique({
              where: {
                userId_organizationId: {
                  userId: token.id as string,
                  organizationId: dbUser.defaultOrganizationId,
                },
              },
            });
            if (membership) {
              token.activeOrganizationId = dbUser.defaultOrganizationId;
              token.activeOrganizationRole = membership.role;
              console.log(`[JWT_FALLBACK] Restored activeOrganizationId=${dbUser.defaultOrganizationId} from DB for userId=${token.id}`);
            } else {
              // Membership was removed; fallback to first org the user belongs to
              const firstMembership = await prisma.organizationMember.findFirst({
                where: { userId: token.id as string },
                orderBy: { joinedAt: "asc" },
              });
              if (firstMembership) {
                token.activeOrganizationId = firstMembership.organizationId;
                token.activeOrganizationRole = firstMembership.role;
                console.log(`[JWT_FALLBACK] Default org membership removed; fell back to org=${firstMembership.organizationId} for userId=${token.id}`);
              } else {
                console.log(`[JWT_FALLBACK] No org memberships found for userId=${token.id}`);
              }
            }
          }
        } catch (dbError) {
          console.error("[JWT_FALLBACK] Failed to query DB for defaultOrganizationId:", dbError);
        }
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
