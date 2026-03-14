import * as z from "zod";

export const onboardingClientSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  clientPhone: z.string().optional().or(z.literal("")),
});

export const onboardingProjectSchema = z.object({
  projectTitle: z.string().min(1, "Project title is required"),
  projectPrice: z.string().min(1, "Project price is required").refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Please enter a valid price",
  }),
  projectClientId: z.string().min(1, "Please select a client"),
});

export type OnboardingClientValues = z.infer<typeof onboardingClientSchema>;
export type OnboardingProjectValues = z.infer<typeof onboardingProjectSchema>;
