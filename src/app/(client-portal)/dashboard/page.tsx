import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyClientJWT } from "@/lib/client-jwt";
import { ClientDashboard } from "./client-dashboard";

export const dynamic = "force-dynamic";

async function getApiData<T>(url: string, cookie: string): Promise<T | null> {
  try {
    const baseUrl = process.env.APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}${url}`, {
      headers: { Cookie: `client_session=${cookie}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("client_session");

  if (!sessionCookie?.value) {
    redirect("/client/login");
  }

  const payload = await verifyClientJWT(sessionCookie.value);
  if (!payload) {
    redirect("/client/login");
  }

  const [invoicesData, projectsData, settingsData] = await Promise.all([
    getApiData<{ invoices: any[] }>("/api/client-portal/invoices", sessionCookie.value),
    getApiData<{ projects: any[] }>("/api/client-portal/projects", sessionCookie.value),
    getApiData<{ companyName: string; companyLogoUrl: string | null }>("/api/client-portal/settings", sessionCookie.value),
  ]);

  return (
    <ClientDashboard
      invoices={invoicesData?.invoices || []}
      projects={projectsData?.projects || []}
      companyName={settingsData?.companyName || "ProjectBill"}
      companyLogoUrl={settingsData?.companyLogoUrl}
    />
  );
}
