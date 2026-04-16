import { prisma } from "../prisma";
import { env } from "../env";
import { addMonths } from "date-fns";
import type { Subscription } from "@prisma/client";

// Define the available plans
export type PlanType = "starter" | "pro" | "business";

// Define the limits for each plan
export const PLAN_LIMITS = {
  starter: {
    clients: 5,
    activeProjects: 5,
    invoicesPerMonth: 15,
    emailsPerMonth: 30,
    paymentLinksPerMonth: 10,
    recurringTemplates: 1,
    sowTemplates: 2,
    teamMembers: 1,
    pdfAutoDelivery: false,
    advancedReporting: false,
    watermark: true,
  },
  pro: {
    clients: Infinity,
    activeProjects: Infinity,
    invoicesPerMonth: Infinity,
    emailsPerMonth: 500,
    paymentLinksPerMonth: Infinity,
    recurringTemplates: Infinity,
    sowTemplates: Infinity,
    teamMembers: 5,
    pdfAutoDelivery: true,
    advancedReporting: true,
    watermark: false,
  },
  business: {
    clients: Infinity,
    activeProjects: Infinity,
    invoicesPerMonth: Infinity,
    emailsPerMonth: 2000,
    paymentLinksPerMonth: Infinity,
    recurringTemplates: Infinity,
    sowTemplates: Infinity,
    teamMembers: 15,
    pdfAutoDelivery: true,
    advancedReporting: true,
    watermark: false,
  },
} as const;

// Pricing
export const PLAN_PRICING = {
  starter: { monthly: 0, yearly: 0 },
  pro:     { monthly: 79_000, yearly: 790_000 },
  business:{ monthly: 179_000, yearly: 1_790_000 },
} as const;

// ── Environment Checks ────────────────────────────────────────

export function isSelfHosted(): boolean {
  return env.DEPLOYMENT_MODE === "self-hosted";
}

export function isManagedCloud(): boolean {
  return env.DEPLOYMENT_MODE === "managed";
}

// ── Core Operations ───────────────────────────────────────────

/**
 * Gets or creates the default subscription for a user.
 * Automatically gives a 14-day Pro trial for new users.
 */
export async function getSubscription(userId: string): Promise<Subscription> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (sub) return sub;

  // Create default 14-day trial for "pro" plan if it doesn't exist
  const now = new Date();
  const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

  return prisma.subscription.create({
    data: {
      userId,
      plan: "pro",
      status: "TRIALING",
      trialStartedAt: now,
      trialEndsAt: trialEnds,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnds,
    },
  });
}

// ── Trial & Lifecycle ─────────────────────────────────────────

export async function checkTrialStatus(userId: string): Promise<{ isTrialing: boolean; daysLeft: number }> {
  const sub = await getSubscription(userId);
  if (sub.status !== "TRIALING" || !sub.trialEndsAt) {
    return { isTrialing: false, daysLeft: 0 };
  }

  const now = new Date();
  const diffTime = sub.trialEndsAt.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) {
    return { isTrialing: false, daysLeft: 0 };
  }

  return { isTrialing: true, daysLeft };
}

export async function downgradeExpiredTrials(): Promise<{ count: number }> {
  const now = new Date();
  const result = await prisma.subscription.updateMany({
    where: {
      status: "TRIALING",
      trialEndsAt: { lt: now },
    },
    data: {
      plan: "starter",
      status: "ACTIVE",
      trialEndsAt: null,
      currentPeriodStart: now,
      currentPeriodEnd: addMonths(now, 1),
    },
  });

  return { count: result.count };
}

export async function cancelSubscription(userId: string): Promise<Subscription> {
  return prisma.subscription.update({
    where: { userId },
    data: {
      cancelAtPeriodEnd: true,
    },
  });
}

// ── Limit Checks ──────────────────────────────────────────────

export type ResourceType =
  | "clients"
  | "activeProjects"
  | "invoicesPerMonth"
  | "emailsPerMonth"
  | "paymentLinksPerMonth"
  | "recurringTemplates"
  | "sowTemplates"
  | "teamMembers"
  | "watermark"
  | "pdfAutoDelivery";

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  plan: PlanType;
}

/**
 * Checks if the user is allowed to consume or create a resource.
 * Automatically bypasses all checks if the app is self-hosted.
 */
export async function checkLimit(
  userId: string,
  resource: ResourceType
): Promise<LimitCheckResult> {
  // 1. Self-Hosted: Always allow everything
  if (isSelfHosted()) {
    return {
      allowed: true,
      current: 0,
      limit: Infinity,
      plan: "business", // conceptually
    };
  }

  // 2. Managed Cloud: Check the database
  const sub = await getSubscription(userId);
  const planName = sub.plan as PlanType;
  const limits = PLAN_LIMITS[planName] || PLAN_LIMITS.starter;

  let current = 0;
  const limit = typeof limits[resource] === "number" ? limits[resource] as number : Infinity;

  // For boolean features (like auto-delivery)
  if (typeof limits[resource] === "boolean") {
    return {
      allowed: limits[resource] as boolean,
      current: 0,
      limit: 1, // binary
      plan: planName,
    };
  }

  // Calculate current usage based on resource type
  switch (resource) {
    case "clients":
      current = await prisma.client.count({ where: { isArchived: false } });
      break;
    case "activeProjects":
      current = await prisma.project.count({
        where: {
          status: { not: "DONE" }, // Only count active ones
        },
      });
      break;
    case "recurringTemplates":
      current = await prisma.recurringInvoice.count({
        where: { isActive: true },
      });
      break;
    case "sowTemplates":
      current = await prisma.sOWTemplate.count();
      break;
    case "teamMembers":
      current = await prisma.user.count();
      break;

    // Monthly counters stored directly on the Subscription model
    case "invoicesPerMonth":
      current = sub.invoicesCreated;
      break;
    case "emailsPerMonth":
      current = sub.emailsSent;
      break;
    case "paymentLinksPerMonth":
      current = sub.paymentLinksUsed;
      break;
  }

  return {
    allowed: current < limit,
    current,
    limit,
    plan: planName,
  };
}

// ── Usage Tracking ────────────────────────────────────────────

export type UsageCounterField = "invoicesCreated" | "emailsSent" | "paymentLinksUsed";

/**
 * Increments a monthly usage counter.
 * Silently does nothing in self-hosted mode.
 */
export async function incrementUsage(
  userId: string,
  field: UsageCounterField,
  amount: number = 1
): Promise<void> {
  if (isSelfHosted()) return;

  try {
    // Ensure subscription exists first
    await getSubscription(userId);

    await prisma.subscription.update({
      where: { userId },
      data: {
        [field]: { increment: amount },
      },
    });
  } catch (error) {
    console.error(`Failed to increment usage for ${userId} [${field}]:`, error);
  }
}

/**
 * Resets all subscription counters. Intended to be run via cron on the 1st of every month.
 */
export async function resetAllUsageCounters(): Promise<{ count: number }> {
  const now = new Date();
  const result = await prisma.subscription.updateMany({
    where: {
      status: {
        in: ["ACTIVE", "TRIALING"],
      },
    },
    data: {
      emailsSent: 0,
      invoicesCreated: 0,
      paymentLinksUsed: 0,
      currentPeriodStart: now,
      currentPeriodEnd: addMonths(now, 1),
    },
  });

  return { count: result.count };
}
