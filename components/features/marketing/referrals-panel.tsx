"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  getReferralConfig,
  updateReferralConfig,
  listReferrals,
  type UpdateReferralConfigInput,
} from "@/lib/actions/marketing.actions";
import type {
  ReferralProgramConfig,
  ReferralsOverviewRow,
  CouponDiscountType,
} from "@/types/database";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-secondary text-muted-foreground",
  converted: "bg-primary/10 text-primary",
  rewarded: "bg-success/10 text-success",
  expired: "bg-destructive/10 text-destructive",
};

interface ConfigFormValues {
  isEnabled: boolean;
  referrerRewardType: CouponDiscountType;
  referrerRewardValue: number;
  refereeRewardType: CouponDiscountType;
  refereeRewardValue: number;
}

export function ReferralsPanel({ canManage }: { canManage: boolean }) {
  const [config, setConfig] = useState<ReferralProgramConfig | null>(null);
  const [referrals, setReferrals] = useState<ReferralsOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset } = useForm<ConfigFormValues>({
    defaultValues: {
      isEnabled: true,
      referrerRewardType: "flat",
      referrerRewardValue: 0,
      refereeRewardType: "percentage",
      refereeRewardValue: 0,
    },
  });

  async function load() {
    setLoading(true);
    const [configData, referralsData] = await Promise.all([
      getReferralConfig(),
      listReferrals(),
    ]);
    setConfig(configData);
    setReferrals(referralsData as ReferralsOverviewRow[]);
    if (configData) {
      reset({
        isEnabled: configData.is_enabled,
        referrerRewardType: configData.referrer_reward_type,
        referrerRewardValue: configData.referrer_reward_value,
        refereeRewardType: configData.referee_reward_type,
        refereeRewardValue: configData.referee_reward_value,
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(values: ConfigFormValues) {
    setSaved(false);
    const input: UpdateReferralConfigInput = {
      isEnabled: values.isEnabled,
      referrerRewardType: values.referrerRewardType,
      referrerRewardValue: Number(values.referrerRewardValue),
      refereeRewardType: values.refereeRewardType,
      refereeRewardValue: Number(values.refereeRewardValue),
    };
    startTransition(async () => {
      const result = await updateReferralConfig(input);
      if (result.success) {
        setSaved(true);
        await load();
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <h3 className="text-sm font-semibold">Referral program settings</h3>
            <p className="text-xs text-muted-foreground">
              Every active member gets a shareable referral code automatically.
            </p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                {...register("isEnabled")}
                disabled={!canManage}
              />
              Referral program enabled
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-xl border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Reward for the referring member
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    {...register("referrerRewardType")}
                    disabled={!canManage}
                  >
                    <option value="flat">Flat ₹</option>
                    <option value="percentage">Percentage</option>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    {...register("referrerRewardValue")}
                    disabled={!canManage}
                  />
                </div>
              </div>
              <div className="space-y-2 rounded-xl border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Reward for the new (referred) member
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    {...register("refereeRewardType")}
                    disabled={!canManage}
                  >
                    <option value="flat">Flat ₹</option>
                    <option value="percentage">Percentage</option>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    {...register("refereeRewardValue")}
                    disabled={!canManage}
                  />
                </div>
              </div>
            </div>
            {canManage && (
              <div className="flex items-center gap-3">
                <Button type="submit" size="sm" loading={isPending}>
                  Save settings
                </Button>
                {saved && <span className="text-xs text-success">Saved.</span>}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Referrals</h3>
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Referrer</th>
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Referred person</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && referrals.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No referrals yet.
                    </td>
                  </tr>
                )}
                {referrals.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">
                      {r.referrer_name}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {r.referral_code}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.referee_actual_name || r.referee_name || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {format(new Date(r.created_at), "dd MMM yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
