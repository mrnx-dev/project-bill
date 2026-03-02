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
import { Loader2 } from "lucide-react";

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

import { toast } from "sonner";

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
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your company branding.
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8 bg-zinc-50 border p-6 rounded-lg dark:bg-zinc-950"
        >
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">
              General Information
            </h3>
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corp" {...field} />
                  </FormControl>
                  <FormDescription>
                    This will appear on your invoices.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyLogoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Logo URL (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://i.imgur.com/yourlogo.png"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Paste a <strong>direct image link</strong> (ending in .png,
                    .jpg, .svg, etc.). You can upload your logo to{" "}
                    <a
                      href="https://imgur.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-600"
                    >
                      Imgur
                    </a>{" "}
                    or{" "}
                    <a
                      href="https://imgbb.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-600"
                    >
                      ImgBB
                    </a>{" "}
                    to get a direct URL.
                  </FormDescription>
                  {field.value && (
                    <div className="mt-2 p-3 border rounded-md bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-2">
                        Preview:
                      </p>
                      <img
                        src={field.value}
                        alt="Logo preview"
                        className="h-12 w-auto object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          const parent = (e.target as HTMLImageElement)
                            .parentElement;
                          if (parent && !parent.querySelector(".error-msg")) {
                            const errEl = document.createElement("p");
                            errEl.className = "text-xs text-red-500 error-msg";
                            errEl.textContent =
                              "⚠ Failed to load image. Make sure the URL points directly to an image file, not an HTML page.";
                            parent.appendChild(errEl);
                          }
                        }}
                      />
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="companyEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Support / Contact Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="hello@acme.com"
                        type="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="companyAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123 Startup Ave, San Francisco, CA"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </form>
      </Form>
    </div>
  );
}
