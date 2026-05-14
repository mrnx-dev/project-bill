"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface OrgOption {
  organizationId: string;
  companyName: string;
}

function SelectOrgContent() {
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  useEffect(() => {
    if (!email) {
      router.push("/client/login?error=missing");
      return;
    }

    fetch(`/api/client-portal/auth/orgs?email=${encodeURIComponent(email)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.orgs) setOrgs(data.orgs);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load organizations");
        setLoading(false);
      });
  }, [email, router]);

  const handleSelect = async (organizationId: string) => {
    try {
      const res = await fetch("/api/client-portal/auth/select-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, organizationId }),
      });
      if (!res.ok) throw new Error("Failed");
      router.push("/client/dashboard");
    } catch {
      setError("Failed to select organization");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Select Organization</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your email is associated with multiple organizations.
          </p>
        </div>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        <div className="space-y-3">
          {orgs.map((org) => (
            <button
              key={org.organizationId}
              onClick={() => handleSelect(org.organizationId)}
              className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-indigo-300 hover:shadow-sm transition"
            >
              <span className="font-medium text-gray-900">{org.companyName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SelectOrgPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Loading...</p></div>}>
      <SelectOrgContent />
    </Suspense>
  );
}
