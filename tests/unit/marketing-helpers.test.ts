import { describe, it, expect } from "vitest";
import {
  computeDiscountAmount,
  fillMessageTemplate,
  isMonthDayMatch,
  buildReferralCode,
  validateCouponRules,
} from "@/lib/utils/marketing-helpers";

describe("computeDiscountAmount", () => {
  it("computes a flat discount regardless of purchase amount", () => {
    expect(computeDiscountAmount({ discountType: "flat", discountValue: 500, purchaseAmount: 2000 })).toBe(500);
  });

  it("computes a percentage discount", () => {
    expect(computeDiscountAmount({ discountType: "percentage", discountValue: 10, purchaseAmount: 2000 })).toBe(200);
  });

  it("caps a percentage discount at max_discount_amount", () => {
    expect(
      computeDiscountAmount({ discountType: "percentage", discountValue: 50, maxDiscountAmount: 300, purchaseAmount: 2000 })
    ).toBe(300);
  });

  it("never discounts more than the purchase amount", () => {
    expect(computeDiscountAmount({ discountType: "flat", discountValue: 5000, purchaseAmount: 1000 })).toBe(1000);
  });

  it("never returns a negative discount", () => {
    expect(computeDiscountAmount({ discountType: "flat", discountValue: -50, purchaseAmount: 1000 })).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    expect(computeDiscountAmount({ discountType: "percentage", discountValue: 33.333, purchaseAmount: 100 })).toBe(33.33);
  });
});

describe("fillMessageTemplate", () => {
  it("substitutes known variables", () => {
    expect(fillMessageTemplate("Hi {{name}}, welcome to {{gym_name}}!", { name: "Asha", gym_name: "FitZone" })).toBe(
      "Hi Asha, welcome to FitZone!"
    );
  });

  it("replaces unknown variables with an empty string instead of throwing", () => {
    expect(fillMessageTemplate("Code: {{coupon_code}}", { name: "Asha" })).toBe("Code: ");
  });

  it("tolerates extra whitespace inside the mustache braces", () => {
    expect(fillMessageTemplate("Hi {{ name }}!", { name: "Ravi" })).toBe("Hi Ravi!");
  });

  it("leaves plain text without placeholders unchanged", () => {
    expect(fillMessageTemplate("No placeholders here.", {})).toBe("No placeholders here.");
  });
});

describe("isMonthDayMatch", () => {
  it("matches when month and day are equal, ignoring year", () => {
    const dob = new Date(Date.UTC(1995, 9, 20)); // Oct 20, 1995
    const today = new Date(Date.UTC(2026, 9, 20)); // Oct 20, 2026
    expect(isMonthDayMatch(dob, today)).toBe(true);
  });

  it("does not match a different day", () => {
    const dob = new Date(Date.UTC(1995, 9, 20));
    const today = new Date(Date.UTC(2026, 9, 21));
    expect(isMonthDayMatch(dob, today)).toBe(false);
  });

  it("does not match a different month", () => {
    const dob = new Date(Date.UTC(1995, 9, 20));
    const today = new Date(Date.UTC(2026, 10, 20));
    expect(isMonthDayMatch(dob, today)).toBe(false);
  });
});

describe("buildReferralCode", () => {
  it("builds a stable, uppercase, alphanumeric code from name + id", () => {
    const code = buildReferralCode("Rithik Kumar", "abcd1234-5678-90ab-cdef-111122223333");
    expect(code).toBe("RITHIKABCD");
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it("strips non-alphabetic characters from the name portion", () => {
    const code = buildReferralCode("O'Brien-Smith", "aaaa0000-0000-0000-0000-000000000000");
    expect(code.startsWith("OBRIEN")).toBe(true);
  });

  it("falls back to MEMBER when no name is given", () => {
    const code = buildReferralCode("", "aaaa0000-0000-0000-0000-000000000000");
    expect(code.startsWith("MEMBER")).toBe(true);
  });
});

describe("validateCouponRules", () => {
  const baseValid: import("@/lib/utils/marketing-helpers").CouponValidationInput = {
    isActive: true,
    validFrom: new Date("2026-01-01"),
    validUntil: new Date("2026-12-31"),
    usageLimit: null,
    timesUsed: 0,
    minPurchaseAmount: 0,
    usageLimitPerMember: 1,
    memberUsesSoFar: 0,
    purchaseAmount: 1000,
    now: new Date("2026-06-01"),
  };

  it("passes for a fully valid coupon", () => {
    expect(validateCouponRules(baseValid)).toEqual({ isValid: true });
  });

  it("rejects an inactive coupon", () => {
    expect(validateCouponRules({ ...baseValid, isActive: false }).isValid).toBe(false);
  });

  it("rejects a coupon that hasn't started yet", () => {
    expect(validateCouponRules({ ...baseValid, validFrom: new Date("2027-01-01") }).isValid).toBe(false);
  });

  it("rejects an expired coupon", () => {
    expect(validateCouponRules({ ...baseValid, validUntil: new Date("2026-01-01") }).isValid).toBe(false);
  });

  it("rejects when the total usage limit is reached", () => {
    expect(validateCouponRules({ ...baseValid, usageLimit: 5, timesUsed: 5 }).isValid).toBe(false);
  });

  it("rejects when the purchase amount is below the minimum", () => {
    expect(validateCouponRules({ ...baseValid, minPurchaseAmount: 5000 }).isValid).toBe(false);
  });

  it("rejects when the member has already used their allotted redemptions", () => {
    expect(validateCouponRules({ ...baseValid, usageLimitPerMember: 1, memberUsesSoFar: 1 }).isValid).toBe(false);
  });

  it("allows a member to redeem again if under their per-member limit", () => {
    expect(validateCouponRules({ ...baseValid, usageLimitPerMember: 3, memberUsesSoFar: 2 }).isValid).toBe(true);
  });
});
