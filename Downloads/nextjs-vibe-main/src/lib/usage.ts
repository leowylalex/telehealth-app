import { auth } from "@clerk/nextjs/server";
import { RateLimiterPrisma } from "rate-limiter-flexible";

import { prisma } from "@/lib/db";

const FREE_POINTS = process.env.NODE_ENV === 'development' ? 1000 : 2;
const PRO_POINTS = 100;
const DURATION = 30 * 24 * 60 * 60; // 30 days
const GENERATION_COST = 1;

function mockProAccess() {
  if (process.env.NODE_ENV === 'development') {
    // Check if user has been upgraded to pro in development
    return process.env.MOCK_PRO_ACCESS === 'true';
  }
  return false;
}

export async function getUsageTracker() {
  const { has } = await auth();
  const hasProAccess = mockProAccess() || has({ plan: "pro" });

  const usageTracker = new RateLimiterPrisma({
    storeClient: prisma,
    tableName: "Usage",
    points: hasProAccess ? PRO_POINTS : FREE_POINTS,
    duration: DURATION,
  });

  return usageTracker;
};

export async function consumeCredits() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not authenticated");
  }

  const usageTracker = await getUsageTracker();
  const result = await usageTracker.consume(userId, GENERATION_COST);
  return result;
};

export async function getUsageStatus() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not authenticated");
  }

  const usageTracker = await getUsageTracker();
  const result = await usageTracker.get(userId);
  return result;
};
