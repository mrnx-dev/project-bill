import { getClientSession } from "@/lib/client-auth";
import { LogoutButton } from "./logout-button";
import Link from "next/link";

const NAV = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/invoices", label: "Invoices" },
  { href: "/portal/projects", label: "Projects" },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getClientSession();
  if (!session) return <>{children}</>; // /portal/login renders bare (no redirect loop)
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold">Client Portal</span>
            <nav className="flex items-center gap-4 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-muted-foreground hover:text-foreground">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{session.clientName}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}