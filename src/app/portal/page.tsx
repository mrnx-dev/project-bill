import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "./logout-button";

export default async function PortalHomePage() {
  const session = await getClientSession();
  if (!session) redirect("/portal/login");
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Client Portal</h1>
          <LogoutButton />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {session.clientName}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Portal access active. (Dashboard — invoices, project status, SOW download — arrives in Sub-project B.)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
