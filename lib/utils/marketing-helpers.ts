// Pure helper functions for the marketing module — deliberately free of any
// Supabase/server dependency so they can be unit tested in isolation and
// reused by both server actions and Edge Functions without duplication.
import type { CouponDiscountType } from "@/types/database";

/**
 * Computes the discount amount for a coupon given its type/value, an
 * optional cap on percentage discounts, and the purchase amount. Mirrors
 * the exact rounding/cap logic used in lib/actions/marketing.actions.ts and
 * the validate_coupon() SQL function, so this is the one place to change if
 * discount math ever needs adjusting.
 */
export function computeDiscountAmount(params: {
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  purchaseAmount: number;
}): number {
  const { discountType, discountValue, maxDiscountAmount, purchaseAmount } = params;

  let discount = discountType === "percentage" ? purchaseAmount * (discountValue / 100) : discountValue;

  if (discountType === "percentage" && maxDiscountAmount != null) {
    discount = Math.min(discount, maxDiscountAmount);
  }

  // Never discount more than the purchase itself, and round to 2 decimals.
  discount = Math.min(Math.round(discount * 100) / 100, purchaseAmount);
  return Math.max(discount, 0);
}

/**
 * Fills a {{variable}} template string with the given values. Missing
 * variables resolve to an empty string rather than throwing, since campaign
 * templates are user-authored and must never crash message sending.
 */
export function fillMessageTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

/**
 * Determines whether a date (month/day only, year ignored) matches today —
 * used for both birthday and festival-offer automation.
 */
export function isMonthDayMatch(date: Date, today: Date): boolean {
  return date.getUTCMonth() === today.getUTCMonth() && date.getUTCDate() === today.getUTCDate();
}

/** Generates a coupon-style referral code from a member's name + id. */
export function buildReferralCode(fullName: string, memberId: string): string {
  const namePart = (fullName.split(" ")[0] || "MEMBER").replace(/[^a-zA-Z]/g, "").slice(0, 6).toUpperCase();
  const idPart = memberId.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `${namePart}${idPart}`;
}

export interface CouponValidationInput {
  isActive: boolean;
  validFrom: Date;
  validUntil: Date | null;
  usageLimit: number | null;
  timesUsed: number;
  minPurchaseAmount: number;
  usageLimitPerMember: number;
  memberUsesSoFar: number;
  purchaseAmount: number;
  now: Date;
}

/**
 * Client/edge-safe re-implementation of the validate_coupon() SQL function's
 * rule ordering, used only for unit testing that ordering and messaging —
 * the database function remains the actual source of truth at runtime.
 */
export function validateCouponRules(input: CouponValidationInput): { isValid: boolean; reason?: string } {
  if (!input.isActive) return { isValid: false, reason: "This coupon code is not valid." };
  if (input.validFrom > input.now) return { isValid: false, reason: "This coupon is not active yet." };
  if (input.validUntil && input.validUntil < input.now) return { isValid: false, reason: "This coupon has expired." };
  if (input.usageLimit != null && input.timesUsed >= input.usageLimit) {
    return { isValid: false, reason: "This coupon has reached its usage limit." };
  }
  if (input.purchaseAmount < input.minPurchaseAmount) {
    return { isValid: false, reason: `This coupon requires a minimum purchase of ${input.minPurchaseAmount}.` };
  }
  if (input.memberUsesSoFar >= input.usageLimitPerMember) {
    return { isValid: false, reason: "You have already used this coupon the maximum number of times." };
  }
  return { isValid: true };
}
