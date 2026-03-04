"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Building2, MapPin, Mail, ImageIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

const settingsSchema = z.object({
  companyName: z.string().min(2, "Company Name must be at least 2 characters."),
  companyAddress: z.string().optional(),
  companyEmail: z
    .string()
    .email("Invalid email address")
    .or(z.literal(""))
    .optional(),
  companyLogoUrl: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional(),
});

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      companyName: "ProjectBill Consulting",
      companyAddress: "",
      companyEmail: "",
      companyLogoUrl: "",
    },
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Failed to fetch settings");
        const data = await res.json();

        form.reset({
          companyName: data.companyName || "",
          companyAddress: data.companyAddress || "",
          companyEmail: data.companyEmail || "",
          companyLogoUrl: data.companyLogoUrl || "",
        });
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
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
                Company Identity
              </CardTitle>
              <CardDescription>
                This information is used directly on your invoices and reports to establish your brand.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" className="bg-slate-50 dark:bg-slate-900 border-slate-200" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyLogoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Company Logo URL
                    </FormLabel>
                    <FormControl>
                      <div className="flex gap-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded bg-slate-100 border dark:bg-slate-800 shrink-0 overflow-hidden">
                          {field.value ? (
                            <img src={field.value} alt="Logo" className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <Input
                          placeholder="https://i.imgur.com/yourlogo.png"
                          className="flex-1 mt-1 font-mono text-sm bg-slate-50 dark:bg-slate-900 border-slate-200"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Provide a direct image URL (e.g. from Imgur or your own site).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5 text-emerald-500" />
                Contact Information
              </CardTitle>
              <CardDescription>
                These details help clients reach out to you if they have queries.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="companyEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Address
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="hello@acme.com"
                          type="email"
                          className="bg-slate-50 dark:bg-slate-900 border-slate-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="companyAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123 Startup Ave, CA"
                          className="bg-slate-50 dark:bg-slate-900 border-slate-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
    </div>
  );
}
