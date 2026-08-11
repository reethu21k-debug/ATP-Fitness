"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  updateCouponStatus,
  deleteCoupon,
  listCoupons,
} from "@/lib/actions/marketing.actions";
import { NewCouponDialog } from "./new-coupon-dialog";
import type { CouponOverviewRow } from "@/types/database";

export function CouponsPanel({ canManage }: { canManage: boolean }) {
  const [coupons, setCoupons] = useState<CouponOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const data = await listCoupons();
    setCoupons(data as CouponOverviewRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggle(id: string, current: boolean) {
    setBusyId(id);
    await updateCouponStatus(id, !current);
    await load();
    setBusyId(null);
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        "Delete this coupon? Existing redemptions are kept, but the code will stop working.",
      )
    )
      return;
    setBusyId(id);
    await deleteCoupon(id);
    await load();
    setBusyId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Discount codes for renewals, new sign-ups, and referrals.
        </p>
        {canManage && <NewCouponDialog onCreated={load} />}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Used</th>
                <th className="px-4 py-3">Valid until</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && coupons.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No coupons yet.
                  </td>
                </tr>
              )}
              {coupons.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                  <td className="px-4 py-3">
                    {c.discount_type === "percentage"
                      ? `${c.discount_value}%`
                      : `₹${c.discount_value}`}
                    {c.max_discount_amount
                      ? ` (max ₹${c.max_discount_amount})`
                      : ""}
                  </td>
                  <td className="px-4 py-3">
                    {c.times_used}
                    {c.usage_limit ? ` / ${c.usage_limit}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    {c.valid_until
                      ? format(new Date(c.valid_until), "dd MMM yyyy")
                      : "No expiry"}
                  </td>
                  <td className="px-4 py-3">
                    {c.is_expired ? (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        Expired
                      </span>
                    ) : c.is_exhausted ? (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                        Exhausted
                      </span>
                    ) : c.is_active ? (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <div className="flex items-center gap-3 text-xs">
                        <button
                          className="text-primary hover:underline disabled:opacity-50"
                          disabled={busyId === c.id}
                          onClick={() => handleToggle(c.id, c.is_active)}
                        >
                          {c.is_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          className="text-destructive hover:underline disabled:opacity-50"
                          disabled={busyId === c.id}
                          onClick={() => handleDelete(c.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
