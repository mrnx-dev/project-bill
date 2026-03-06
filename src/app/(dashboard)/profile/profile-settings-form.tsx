"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const profileSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters."),
    confirmNewPassword: z.string().min(6, "Password confirmation required."),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "New passwords do not match",
    path: ["confirmNewPassword"],
  });

export function ProfileSettingsForm() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof profileSchema>) {
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      toast.success("Password updated successfully!");
      form.reset();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 bg-zinc-50 border p-6 rounded-lg dark:bg-zinc-950"
      >
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">
            Admin Security
          </h3>
          <p className="text-sm text-muted-foreground">
            Change your admin password.
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmNewPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Button type="submit" disabled={isSaving} variant="secondary">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update Password
        </Button>
      </form>
    </Form>
  );
}
