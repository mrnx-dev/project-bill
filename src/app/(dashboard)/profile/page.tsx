import { ProfileSettingsForm } from "./profile-settings-form";
import { ProfileInfoForm } from "./profile-info-form";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  const isManaged = env.DEPLOYMENT_MODE === "managed";

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

      {isManaged ? (
        <div className="p-4 border rounded-lg bg-muted/50">
          <p className="text-sm">
            Password management is handled via Casdoor.{" "}
            {env.CASDOOR_ENDPOINT && (
              <a
                href={env.CASDOOR_ENDPOINT}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-4"
              >
                Go to Casdoor
              </a>
            )}
          </p>
        </div>
      ) : (
        <ProfileSettingsForm />
      )}
    </div>
  );
}
