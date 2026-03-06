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
import { useRouter } from "next/navigation";

const infoSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address"),
});

export function ProfileInfoForm({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const form = useForm<z.infer<typeof infoSchema>>({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      name: initialName,
      email: initialEmail,
    },
  });

  async function onSubmit(values: z.infer<typeof infoSchema>) {
    setIsSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      toast.success("Profile updated successfully!");
      router.refresh(); // Refresh server components to catch new session state
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to update profile.");
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
            Profile Information
          </h3>
          <p className="text-sm text-muted-foreground">
            Update your account name and email address.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </form>
    </Form>
  );
}
