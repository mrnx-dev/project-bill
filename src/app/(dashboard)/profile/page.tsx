import { ProfileSettingsForm } from "./profile-settings-form";
import { ProfileInfoForm } from "./profile-info-form";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account profile and admin security settings.
        </p>
      </div>

      <ProfileInfoForm
        initialName={dbUser?.name || ""}
        initialEmail={dbUser?.email || ""}
      />
      <ProfileSettingsForm />
    </div>
  );
}
