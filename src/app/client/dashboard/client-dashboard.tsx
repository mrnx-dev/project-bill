"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: string;
  status: string;
  dueDate: string | null;
  projectTitle: string;
  paymentLink: string | null;
  type: string;
}

interface Project {
  id: string;
  title: string;
  status: string;
  totalPrice: string;
  paidAmount: string;
  currency: string;
  deadline: string | null;
  milestoneProgress: number | null;
}

interface Props {
  invoices: Invoice[];
  projects: Project[];
  companyName: string;
  companyLogoUrl: string | null;
}

function formatCurrency(amount: string, currency: string = "IDR") {
  const num = parseFloat(amount);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    PAID: "bg-green-100 text-green-800",
    UNPAID: "bg-yellow-100 text-yellow-800",
    OVERDUE: "bg-red-100 text-red-800",
    CANCELLED: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.UNPAID}`}>
      {status}
    </span>
  );
}

export function ClientDashboard({ invoices, projects, companyName, companyLogoUrl }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"invoices" | "projects">("invoices");

  const handleLogout = async () => {
    await fetch("/api/client-portal/auth/logout", { method: "POST" });
    router.push("/client/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {companyLogoUrl && (
              <img
                src={companyLogoUrl}
                alt={companyName}
                className="h-8 w-auto object-contain"
              />
            )}
            <h1 className="text-lg font-semibold text-gray-900">{companyName}</h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex gap-6">
            <button
              onClick={() => setActiveTab("invoices")}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                activeTab === "invoices"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab("projects")}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                activeTab === "projects"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Projects ({projects.length})
            </button>
          </nav>
        </div>

        {/* Invoices Tab */}
        {activeTab === "invoices" && (
          <div>
            {invoices.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No invoices yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-sm transition cursor-pointer"
                    onClick={() => router.push(`/client/invoices/${inv.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{inv.projectTitle}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {inv.invoiceNumber} · {inv.type === "DP" ? "Down Payment" : inv.type === "FULL_PAYMENT" ? "Full Payment" : inv.type}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(inv.amount)}
                        </p>
                        <div className="mt-1">{statusBadge(inv.status)}</div>
                      </div>
                    </div>
                    {inv.dueDate && (
                      <p className="text-xs text-gray-400 mt-2">
                        Due: {formatDate(inv.dueDate)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === "projects" && (
          <div>
            {projects.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No projects yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="bg-white rounded-lg border border-gray-200 p-5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{proj.title}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Status: {proj.status}
                          {proj.deadline && ` · Deadline: ${formatDate(proj.deadline)}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(proj.totalPrice, proj.currency)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Paid: {formatCurrency(proj.paidAmount, proj.currency)}
                        </p>
                      </div>
                    </div>

                    {/* Milestone Progress */}
                    {proj.milestoneProgress !== null && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Milestone Progress</span>
                          <span>{proj.milestoneProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition"
                            style={{ width: `${proj.milestoneProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
