import * as z from "zod";

export const companyProfileSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  companyAddress: z.string().optional(),
  companyEmail: z.email("Invalid email").optional().or(z.literal("")),
  companyLogoUrl: z.url("Invalid URL").optional().or(z.literal("")),
  companyWhatsApp: z.string().optional(),
});

export const bankDetailsSchema = z.object({
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
});

export const integrationsSchema = z.object({
  resendApiKey: z.string().optional().or(z.literal("")),
  mayarApiKey: z.string().optional().or(z.literal("")),
  mayarWebhookSecret: z.string().optional().or(z.literal("")),
});

export const settingsSchema = z.object({
  ...companyProfileSchema.shape,
  ...bankDetailsSchema.shape,
  ...integrationsSchema.shape,
});

export type CompanyProfileFormValues = z.infer<typeof companyProfileSchema>;
export type BankDetailsFormValues = z.infer<typeof bankDetailsSchema>;
export type IntegrationsFormValues = z.infer<typeof integrationsSchema>;
export type SettingsFormValues = z.infer<typeof settingsSchema>;
