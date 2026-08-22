"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/client-portal/auth/logout", { method: "POST" });
    router.push("/portal/login");
  };
  return <Button variant="outline" size="sm" onClick={logout}>Logout</Button>;
}
