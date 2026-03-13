"use client";

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

interface IntegrationsFieldsProps {
  form: UseFormReturn<any>;
}

export function IntegrationsFields({ form }: IntegrationsFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="mayarApiKey"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mayar API Key</FormLabel>
            <FormControl>
              <Input
                placeholder="Enter Mayar API Key"
                type="password"
                className="bg-slate-50 dark:bg-slate-900 border-slate-200 font-mono text-sm"
                {...field}
                onFocus={(e) => {
                  if (e.target.value?.startsWith("****")) {
                    field.onChange("");
                  }
                }}
              />
            </FormControl>
            <FormDescription className="text-xs">
              {field.value?.startsWith("****") ? "🔒 Key is set. Clear to replace." : ""}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="mayarWebhookSecret"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mayar Webhook Secret</FormLabel>
            <FormControl>
              <Input
                placeholder="Enter Mayar Webhook Secret"
                type="password"
                className="bg-slate-50 dark:bg-slate-900 border-slate-200 font-mono text-sm"
                {...field}
                onFocus={(e) => {
                  if (e.target.value?.startsWith("****")) {
                    field.onChange("");
                  }
                }}
              />
            </FormControl>
            <FormDescription className="text-xs">
              {field.value?.startsWith("****") ? "🔒 Key is set. Clear to replace." : ""}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="resendApiKey"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Resend API Key</FormLabel>
            <FormControl>
              <Input
                placeholder="re_xxxxxxxxxxxxxxxxx"
                type="password"
                className="bg-slate-50 dark:bg-slate-900 border-slate-200 font-mono text-sm"
                {...field}
                onFocus={(e) => {
                  if (e.target.value?.startsWith("****")) {
                    field.onChange("");
                  }
                }}
              />
            </FormControl>
            <FormDescription className="text-xs">
              {field.value?.startsWith("****") ? "🔒 Key is set. Clear to replace." : ""}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
