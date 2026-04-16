import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SetupClientWrapper } from "./setup-client-wrapper";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // If in managed mode, redirect to login
  if (env.DEPLOYMENT_MODE === "managed") {
    redirect("/login");
  }

  // Prevent access if a user already exists
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    redirect("/login");
  }

  return <SetupClientWrapper />;
}
