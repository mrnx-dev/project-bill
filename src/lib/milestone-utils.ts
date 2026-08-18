export type MilestoneInput = {
  name: string;
  percentage: number;
  dueDate?: string | null;
  order?: number;
};

export type ComputedMilestone = MilestoneInput & { amount: number };

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Compute milestone amounts from percentages. The last milestone absorbs the
 * rounding remainder so the sum of amounts equals totalPrice exactly.
 */
export function computeMilestoneAmounts(
  plan: MilestoneInput[],
  totalPrice: number,
): ComputedMilestone[] {
  const sorted = [...plan].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  // Remainder absorption is only meaningful for plans summing to 100 (which
  // production enforces). Outside that, keep pure percentage math.
  const sum = sorted.reduce((acc, m) => acc + m.percentage, 0);
  const absorbRemainder = Math.abs(sum - 100) < 0.01;
  let priorRoundedSum = 0;
  return sorted.map((m, i) => {
    let amount: number;
    if (i === sorted.length - 1 && absorbRemainder) {
      amount = round4(totalPrice - priorRoundedSum);
    } else {
      amount = round4((m.percentage / 100) * totalPrice);
      priorRoundedSum += amount;
    }
    return { ...m, amount };
  });
}

export function validateMilestonePlan(plan: MilestoneInput[]): {
  valid: boolean;
  sum: number;
} {
  const sum = plan.reduce((acc, m) => acc + m.percentage, 0);
  const allInRange = plan.every((m) => m.percentage > 0 && m.percentage <= 100);
  return { valid: sum === 100 && allInRange && plan.length >= 1, sum };
}

export function convertDpToFirstMilestone(
  dpAmount: number,
  totalPrice: number,
): { name: string; percentage: number; amount: number; order: number } {
  const percentage = totalPrice > 0 ? (dpAmount / totalPrice) * 100 : 0;
  return {
    name: "Deposit",
    percentage: round4(percentage),
    amount: dpAmount,
    order: 0,
  };
}
