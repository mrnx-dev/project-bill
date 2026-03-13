"use client";

import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface BankDetailsFieldsProps {
  form: UseFormReturn<any>;
}

export function BankDetailsFields({ form }: BankDetailsFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="bankName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bank Name</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. Chase, BCA"
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
        name="bankAccountName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Account Name</FormLabel>
            <FormControl>
              <Input
                placeholder="Enter account name"
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
        name="bankAccountNumber"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Account Number</FormLabel>
            <FormControl>
              <Input
                placeholder="Enter account number"
                className="bg-slate-50 dark:bg-slate-900 border-slate-200 font-mono"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
