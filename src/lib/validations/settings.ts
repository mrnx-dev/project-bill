import * as z from "zod";

export const companyProfileSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  companyAddress: z.string().optional(),
  companyEmail: z.string().optional(),
  senderEmail: z.string().optional(),
  companyLogoUrl: z.string().optional(),
  companyWhatsApp: z.string().optional(),
});

export const bankDetailsSchema = z.object({
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
});

export const integrationsSchema = z.object({
  mayarApiKey: z.string().optional().or(z.literal("")),
  mayarWebhookSecret: z.string().optional().or(z.literal("")),
});

/** Email provider config — dynamically validated by manifest */
export const emailProviderSchema = z.object({
  emailProvider: z.string().default("resend"),
  providerConfig: z.record(z.string(), z.record(z.string(), z.string())).optional().default({}),
});

export const settingsSchema = z.object({
  ...companyProfileSchema.shape,
  ...bankDetailsSchema.shape,
  ...integrationsSchema.shape,
  ...emailProviderSchema.shape,
});

export type CompanyProfileFormValues = z.infer<typeof companyProfileSchema>;
export type BankDetailsFormValues = z.infer<typeof bankDetailsSchema>;
export type IntegrationsFormValues = z.infer<typeof integrationsSchema>;
export type EmailProviderFormValues = z.infer<typeof emailProviderSchema>;
export type SettingsFormValues = z.infer<typeof settingsSchema>;
