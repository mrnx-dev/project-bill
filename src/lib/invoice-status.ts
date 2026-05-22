export const INVOICE_STATUS = {
  DRAFT: "DRAFT",
  UNPAID: "UNPAID",
  PAID: "PAID",
  VOID: "VOID",
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

export const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["UNPAID"],
  UNPAID: ["PAID", "VOID"],
  PAID: ["VOID"],
  VOID: [],
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}