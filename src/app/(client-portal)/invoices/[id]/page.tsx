import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { verifyClientJWT } from "@/lib/client-jwt";

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

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("client_session");

  if (!sessionCookie?.value) redirect("/client/login");

  const payload = await verifyClientJWT(sessionCookie.value);
  if (!payload) redirect("/client/login");

  const data = await getApiData<{ invoices: any[] }>("/api/client-portal/invoices", sessionCookie.value);
  const invoice = data?.invoices?.find((inv: any) => inv.id === id);

  if (!invoice) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <a href="/client/dashboard" className="text-sm text-indigo-600 hover:text-indigo-800">
            ← Back to dashboard
          </a>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Invoice {invoice.invoiceNumber}
          </h1>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Project</p>
                <p className="font-medium text-gray-900">{invoice.projectTitle}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  invoice.status === "PAID" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                }`}>
                  {invoice.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Amount</p>
                <p className="text-xl font-bold text-gray-900">
                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(parseFloat(invoice.amount))}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Due Date</p>
                <p className="font-medium text-gray-900">
                  {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                </p>
              </div>
            </div>

            {invoice.paymentLink && invoice.status !== "PAID" && (
              <a
                href={invoice.paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 transition"
              >
                Pay Now →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
