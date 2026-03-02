import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SetupClientWrapper } from "./setup-client-wrapper";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Prevent access if a user already exists
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    redirect("/login");
  }

  return <SetupClientWrapper />;
}
