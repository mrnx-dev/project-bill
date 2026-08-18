import { z } from "zod";

export const billingModeSchema = z.enum(["SIMPLE", "MILESTONE"]);

export const milestoneItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Milestone name is required"),
  percentage: z.number().gt(0, "Percentage must be > 0").max(100, "Percentage must be <= 100"),
  dueDate: z.string().nullable().optional(),
  order: z.number().int().min(0).default(0),
});

export const milestonePlanSchema = z
  .array(milestoneItemSchema)
  .min(1, "At least one milestone is required")
  .superRefine((plan, ctx) => {
    const sum = plan.reduce((acc, m) => acc + m.percentage, 0);
    if (sum !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Milestone percentages must sum to 100 (got ${sum})`,
        path: ["root"],
      });
    }
  });

export type MilestoneItemValues = z.infer<typeof milestoneItemSchema>;
export type MilestonePlanValues = z.infer<typeof milestonePlanSchema>;
