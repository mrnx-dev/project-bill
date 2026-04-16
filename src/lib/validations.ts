import { z } from "zod";
import { CURRENCY_CODES } from "@/lib/currency";

export const projectSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  totalPrice: z.coerce.number().nonnegative("Total price must be non-negative"),
  dpAmount: z.union([z.coerce.number().nonnegative(), z.null()]).optional(),
  currency: z.enum(CURRENCY_CODES).default("IDR"),
  language: z.enum(["id", "en"]).default("id"),
  deadline: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  taxName: z.string().nullable().optional(),
  taxRate: z.coerce.number().nonnegative().optional().nullable(),
  items: z
    .array(
      z.object({
        description: z.string().min(1, "Item description is required"),
        price: z.coerce.number().nonnegative("Price must be a non-negative number"),
        quantity: z.coerce.number().nonnegative().optional().nullable(),
        rate: z.coerce.number().nonnegative().optional().nullable(),
      }),
    )
    .optional(),
}).superRefine((data, ctx) => {
  if (data.taxRate && data.taxRate > 0 && (!data.taxName || data.taxName.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["taxName"],
      message: "Tax Name is required when Tax Rate is greater than 0",
    });
  }
});

export const invoiceSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  type: z.enum(["DP", "FULL_PAYMENT"]),
  amount: z.coerce.number().positive("Amount must be a positive number"),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});


export const recurringInvoiceSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  amount: z.coerce.number().positive("Amount must be positive"),
  frequency: z.enum(["MONTHLY", "WEEKLY", "YEARLY"]).default("MONTHLY"),
  dayOfMonth: z.coerce.number().min(1).max(28).default(1),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});
