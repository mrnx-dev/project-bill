"use client";

import { useState, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { clientProviderRegistry } from "@/lib/email/providers/client-registry";
import type { ProviderManifest } from "@/lib/email/providers/types";
import { Loader2 } from "lucide-react";

interface EmailProviderCardProps {
  form: UseFormReturn<any>;
}

export function EmailProviderCard({ form }: EmailProviderCardProps) {
  const [testing, setTesting] = useState(false);

  const manifests = clientProviderRegistry.getAll();
  const emailProvider = form.watch("emailProvider") || "resend";
  const selectedManifest = clientProviderRegistry.getById(emailProvider);

  // Auto-populate default values for provider fields not yet in form state
  useEffect(() => {
    if (!selectedManifest) return;
    const currentConfig: Record<string, string> =
      form.getValues(`providerConfig.${selectedManifest.id}`) || {};
    let hasChanges = false;
    const updatedConfig = { ...currentConfig };

    for (const field of selectedManifest.fields) {
      if (field.defaultValue !== undefined && currentConfig[field.id] === undefined) {
        updatedConfig[field.id] = field.defaultValue;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      form.setValue(`providerConfig.${selectedManifest.id}`, updatedConfig);
    }
  }, [selectedManifest, form]);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/settings/test-email", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Test email sent via ${data.provider}!`);
      } else {
        toast.error(`Failed: ${data.error}`);
      }
    } catch {
      toast.error("Test request failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <FormField
        control={form.control}
        name="emailProvider"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email Provider</FormLabel>
            <Select
              value={field.value || "resend"}
              onValueChange={(v) => {
                field.onChange(v);
                // Reset providerConfig when switching?
                // Keep existing — user can enter new key per provider
              }}
            >
              <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-900 border-slate-200">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {manifests.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription className="text-xs">
              {selectedManifest?.description}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {selectedManifest && (
        <div className="space-y-4 rounded-lg border p-4 bg-slate-50/50 dark:bg-slate-900/50">
          {selectedManifest.fields.map((field) => (
            <FormField
              key={field.id}
              control={form.control}
              name={`providerConfig.${selectedManifest.id}.${field.id}`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </FormLabel>
                  {field.type === "select" ? (
                    <Select
                      value={formField.value ?? field.defaultValue ?? ""}
                      onValueChange={formField.onChange}
                    >
                      <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input
                        type={
                          field.type === "password"
                            ? "password"
                            : field.type === "number"
                            ? "number"
                            : "text"
                        }
                        placeholder={field.placeholder}
                        className="bg-slate-50 dark:bg-slate-900 border-slate-200 font-mono text-sm"
                        value={formField.value ?? ""}
                        onChange={formField.onChange}
                        onBlur={formField.onBlur}
                        name={formField.name}
                        ref={formField.ref}
                        onFocus={(e) => {
                          if (typeof e.target.value === "string" && e.target.value.startsWith("****")) {
                            formField.onChange("");
                          }
                        }}
                      />
                    </FormControl>
                  )}
                  {field.validation?.message && (
                    <FormMessage>{field.validation.message}</FormMessage>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing}
            className="mt-2"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
