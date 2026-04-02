import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { env } from "@/lib/env";

const { ...restConfig } = authConfig;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...restConfig,
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
