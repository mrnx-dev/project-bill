import { prisma } from "./prisma";
import { env } from "./env";
import { addMonths } from "date-fns";
import type { Subscription } from "@prisma/client";

// Define the available plans
export type PlanType = "starter" | "pro" | "business";

// Define the limits for each plan
export const PLAN_LIMITS = {
  starter: {
    maxClients: 5,
    maxActiveProjects: 5,
    maxInvoicesPerMonth: 15,
    maxEmailsPerMonth: 30,
    maxPaymentLinksPerMonth: 10,
    maxRecurringTemplates: 1,
    maxSowTemplates: 2,
    maxTeamMembers: 1,
    pdfAutoDelivery: false,
    advancedReporting: false,
    watermark: true,
  },
  pro: {
    maxClients: Infinity,
    maxActiveProjects: Infinity,
    maxInvoicesPerMonth: Infinity,
    maxEmailsPerMonth: 500,
    maxPaymentLinksPerMonth: Infinity,
    maxRecurringTemplates: Infinity,
    maxSowTemplates: Infinity,
    maxTeamMembers: 5,
    pdfAutoDelivery: true,
    advancedReporting: true,
    watermark: false,
  },
  business: {
    maxClients: Infinity,
    maxActiveProjects: Infinity,
    maxInvoicesPerMonth: Infinity,
    maxEmailsPerMonth: 2000,
    maxPaymentLinksPerMonth: Infinity,
    maxRecurringTemplates: Infinity,
    maxSowTemplates: Infinity,
    maxTeamMembers: 15,
    pdfAutoDelivery: true,
    advancedReporting: true,
    watermark: false,
  },
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
 * In a real billing flow, this would be tied to Stripe/Mayar customers.
 */
export async function getSubscription(userId: string): Promise<Subscription> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (sub) return sub;

  // Create default starter subscription if it doesn't exist
  return prisma.subscription.create({
    data: {
      userId,
      plan: "starter",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: addMonths(new Date(), 1), // Auto-renews next month
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
          status: { not: "done" }, // Only count active ones
        },
      });
      break;
    case "recurringTemplates":
      current = await prisma.recurringInvoice.count({
        where: { isActive: true },
      });
      break;
    case "sowTemplates":
      current = await prisma.sowTemplate.count();
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
  const result = await prisma.subscription.updateMany({
    data: {
      emailsSent: 0,
      invoicesCreated: 0,
      paymentLinksUsed: 0,
      currentPeriodStart: new Date(),
      currentPeriodEnd: addMonths(new Date(), 1),
    },
  });

  return { count: result.count };
}
