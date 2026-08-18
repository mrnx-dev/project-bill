import {
  computeMilestoneAmounts,
  validateMilestonePlan,
  convertDpToFirstMilestone,
} from "@/lib/milestone-utils";

describe("computeMilestoneAmounts", () => {
  test("amount = percentage × totalPrice", () => {
    const out = computeMilestoneAmounts(
      [{ name: "Deposit", percentage: 30, order: 0 }],
      10000000,
    );
    expect(out[0].amount).toBe(3000000);
  });

  test("rounding: 3×33.33% sums exactly to totalPrice (last absorbs remainder)", () => {
    const out = computeMilestoneAmounts(
      [
        { name: "A", percentage: 33.33, order: 0 },
        { name: "B", percentage: 33.33, order: 1 },
        { name: "C", percentage: 33.34, order: 2 },
      ],
      30000000,
    );
    const sum = out.reduce((acc, m) => acc + m.amount, 0);
    expect(sum).toBe(30000000);
  });

  test("respects order field", () => {
    const out = computeMilestoneAmounts(
      [
        { name: "B", percentage: 40, order: 2 },
        { name: "A", percentage: 60, order: 1 },
      ],
      1000,
    );
    expect(out[0].name).toBe("A");
    expect(out[1].name).toBe("B");
  });
});

describe("validateMilestonePlan", () => {
  test("sum = 100 is valid", () => {
    expect(validateMilestonePlan([{ name: "A", percentage: 100 }]).valid).toBe(true);
  });
  test("sum < 100 is invalid", () => {
    expect(validateMilestonePlan([{ name: "A", percentage: 30 }]).valid).toBe(false);
  });
  test("sum > 100 is invalid", () => {
    expect(
      validateMilestonePlan([
        { name: "A", percentage: 60 },
        { name: "B", percentage: 50 },
      ]).valid,
    ).toBe(false);
  });
  test("percentage 0 is invalid (out of range)", () => {
    expect(
      validateMilestonePlan([
        { name: "A", percentage: 0 },
        { name: "B", percentage: 100 },
      ]).valid,
    ).toBe(false);
  });
  test("percentage > 100 is invalid", () => {
    expect(validateMilestonePlan([{ name: "A", percentage: 150 }]).valid).toBe(false);
  });
  test("empty plan is invalid", () => {
    expect(validateMilestonePlan([]).valid).toBe(false);
  });
});

describe("convertDpToFirstMilestone", () => {
  test("derives percentage from dpAmount/totalPrice", () => {
    const m = convertDpToFirstMilestone(9000000, 30000000);
    expect(m.name).toBe("Deposit");
    expect(m.percentage).toBe(30);
    expect(m.amount).toBe(9000000);
    expect(m.order).toBe(0);
  });
  test("totalPrice 0 → percentage 0 (guard)", () => {
    expect(convertDpToFirstMilestone(500, 0).percentage).toBe(0);
  });
});

import { milestonePlanSchema, billingModeSchema } from "@/lib/validations/milestone";

describe("billingModeSchema", () => {
  test("accepts SIMPLE", () => {
    expect(billingModeSchema.safeParse("SIMPLE").success).toBe(true);
  });
  test("accepts MILESTONE", () => {
    expect(billingModeSchema.safeParse("MILESTONE").success).toBe(true);
  });
  test("rejects RECURRING (reserved)", () => {
    expect(billingModeSchema.safeParse("RECURRING").success).toBe(false);
  });
  test("rejects unknown", () => {
    expect(billingModeSchema.safeParse("WEEKLY").success).toBe(false);
  });
});

describe("milestonePlanSchema", () => {
  test("accepts a valid plan summing to 100", () => {
    const r = milestonePlanSchema.safeParse([
      { name: "Deposit", percentage: 30, order: 0 },
      { name: "Dev", percentage: 70, order: 1 },
    ]);
    expect(r.success).toBe(true);
  });
  test("rejects plan not summing to 100", () => {
    const r = milestonePlanSchema.safeParse([{ name: "A", percentage: 30, order: 0 }]);
    expect(r.success).toBe(false);
  });
  test("rejects percentage out of (0,100]", () => {
    const r = milestonePlanSchema.safeParse([{ name: "A", percentage: 0, order: 0 }]);
    expect(r.success).toBe(false);
  });
  test("rejects empty name", () => {
    const r = milestonePlanSchema.safeParse([
      { name: "", percentage: 100, order: 0 },
    ]);
    expect(r.success).toBe(false);
  });
});
