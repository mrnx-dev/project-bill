import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getClientProjects } from "@/lib/client-portal-queries";
import { formatMoney } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

export default async function PortalProjectsPage() {
  const session = await getClientSession();
  if (!session) redirect("/portal/login");
  const projects = await getClientProjects(session);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Projects</h1>
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">You have no projects.</p>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.title}</span>
                  <Badge variant="secondary">{p.status}</Badge>
                </div>
                {p.hasTerms && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/portal/projects/${p.id}/sow`}>View SOW</Link>
                  </Button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-center text-sm">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid</span>
                    <span>{formatMoney(p.paidAmount, p.currency)} / {formatMoney(p.totalPrice, p.currency)}</span>
                  </div>
                  <Progress value={p.progressPct} className="h-2" />
                </div>
                <div className="text-muted-foreground text-right sm:pl-4">{p.progressPct}% complete</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}