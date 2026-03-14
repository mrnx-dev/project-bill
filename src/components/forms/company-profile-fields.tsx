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
import { ImageIcon, Mail, Phone } from "lucide-react";

interface CompanyProfileFieldsProps {
  form: UseFormReturn<any>;
}

export function CompanyProfileFields({ form }: CompanyProfileFieldsProps) {
  return (
    <div className="space-y-5">
      <FormField
        control={form.control}
        name="companyName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Company Name <span className="text-destructive">*</span></FormLabel>
            <FormControl>
              <Input placeholder="Enter your company name" className="bg-slate-50 dark:bg-slate-900 border-slate-200" {...field} />
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
                    // eslint-disable-next-line @next/next/no-img-element
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
              Provide a direct image URL (e.g. from Imgur).
            </FormDescription>
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
              <FormLabel className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Support / Reply-to Email
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your support email"
                  type="email"
                  className="bg-slate-50 dark:bg-slate-900 border-slate-200"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-[11px] leading-tight invisible">
                High balancer
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="senderEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Sender Email (Delivery)
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="noreply@yourdomain.com"
                  type="email"
                  className="bg-slate-50 dark:bg-slate-900 border-slate-200"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-[11px] leading-tight">Must be a verified domain in Resend.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="companyWhatsApp"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> WhatsApp Number
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="+628123456789"
                  type="text"
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
            <FormItem className="md:col-span-2">
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
    </div>
  );
}
