"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Loader2, Building2, MapPin, Landmark } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { settingsSchema, SettingsFormValues } from "@/lib/validations/settings";
import { CompanyProfileFields } from "@/components/forms/company-profile-fields";
import { BankDetailsFields } from "@/components/forms/bank-details-fields";
import { IntegrationsFields } from "@/components/forms/integrations-fields";

export function SettingsFormClient() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      companyName: "ProjectBill",
      companyAddress: "",
      companyEmail: "",
      companyLogoUrl: "",
      companyWhatsApp: "",
      bankName: "",
      bankAccountName: "",
      bankAccountNumber: "",
    },
  });

  // Load existing settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data) {
            form.reset({
              companyName: data.companyName,
              companyAddress: data.companyAddress || "",
              companyEmail: data.companyEmail || "",
              companyLogoUrl: data.companyLogoUrl || "",
              companyWhatsApp: data.companyWhatsApp || "",
              resendApiKey: data.resendApiKey || "",
              mayarApiKey: data.mayarApiKey || "",
              mayarWebhookSecret: data.mayarWebhookSecret || "",
              bankName: data.bankName || "",
              bankAccountName: data.bankAccountName || "",
              bankAccountNumber: data.bankAccountNumber || "",
            });
          }
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, [form]);

  async function onSubmit(values: z.infer<typeof settingsSchema>) {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      toast.success("Settings updated successfully!");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">General Settings</h2>
        <p className="text-muted-foreground mt-1">
          Manage your workspace profile, company identity, and contact information.
        </p>
      </div>

      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5 text-indigo-500" />
                Company Profile & Contact Info
              </CardTitle>
              <CardDescription>
                This information is used directly on your invoices and reports to establish your brand and help clients reach out to you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <CompanyProfileFields form={form} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5 text-purple-500" />
                Integrations
              </CardTitle>
              <CardDescription>
                Configure external services like Payment Gateway (Mayar) and Email Delivery (Resend). Keys are encrypted at rest.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <IntegrationsFields form={form} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Landmark className="w-5 h-5 text-amber-500" />
                Manual Payment Instructions
              </CardTitle>
              <CardDescription>
                These details serve as a fallback on the client's invoice if your Mayar API Key is missing or fails to authenticate during processing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <BankDetailsFields form={form} />
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSaving} className="px-8 shadow-md">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Preferences"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div >
  );
}
