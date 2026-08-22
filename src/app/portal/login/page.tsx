"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

function LoginForm() {
  const params = useSearchParams();
  const error = params.get("error");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/client-portal/auth/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
    toast.success("If the email is registered, a login link is on its way.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Client Portal</CardTitle>
          <CardDescription>
            {error === "invalid_or_expired"
              ? "Your link was invalid or expired. Please request a new one."
              : "Enter your email to receive a login link."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm text-muted-foreground">Check your email for a login link.</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <Input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send login link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// useSearchParams() must be wrapped in a Suspense boundary so the page can be
// statically prerendered (Next.js 16 build requirement).
export default function ClientLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}