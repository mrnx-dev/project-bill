import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { env } from "@/lib/env";

const { ...restConfig } = authConfig;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...restConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (
        env.DEPLOYMENT_MODE === "managed" &&
        account?.provider === "casdoor"
      ) {
        if (!user.email) {
          return false;
        }

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        const casdoorProfile = profile as any;
        const role = casdoorProfile?.role === "admin" ? "admin" : "staff";

        if (!existingUser) {
          await prisma.user.create({
            data: {
              email: user.email,
              name:
                user.name ||
                casdoorProfile?.name ||
                user.email.split("@")[0],
              password: "OIDC_MANAGED_USER",
              role: role,
              onboardingCompleted: false,
              subscription: {
                create: {
                  plan: "starter",
                  status: "active",
                  trialStartedAt: new Date(),
                  trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                  currentPeriodEnd: new Date(
                    Date.now() + 14 * 24 * 60 * 60 * 1000,
                  ),
                },
              },
            },
          });
        } else {
          if (existingUser.role !== role) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { role: role },
            });
          }
        }
      }
      return true;
    },
  },
  providers:
    env.DEPLOYMENT_MODE === "managed"
      ? [
          {
            id: "casdoor",
            name: "Casdoor",
            type: "oidc",
            issuer: `${env.CASDOOR_ENDPOINT}/.well-known/openid-configuration`,
            clientId: env.CASDOOR_CLIENT_ID,
            clientSecret: env.CASDOOR_CLIENT_SECRET,
            authorization: {
              params: { scope: "openid profile email" },
            },
          },
        ]
      : [
          CredentialsProvider({
            name: "Credentials",
            credentials: {
              email: {
                label: "Email",
                type: "email",
                placeholder: "Enter your email",
              },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              // Note: Not logging credentials object to prevent password disclosure

              if (!credentials?.email || !credentials?.password) {
                return null;
              }

              const user = await prisma.user.findUnique({
                where: { email: credentials.email as string },
              });

              if (!user) {
                return null;
              }

              const isPasswordValid = await bcrypt.compare(
                credentials.password as string,
                user.password,
              );

              if (!isPasswordValid) {
                return null;
              }

              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
              };
            },
          }),
        ],
});
