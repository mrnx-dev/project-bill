import { LoginForm } from "@/components/login-form";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  // Check if we need to run initial setup
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    redirect("/setup");
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <LoginForm />
      </div>
    </div>
  );
}
