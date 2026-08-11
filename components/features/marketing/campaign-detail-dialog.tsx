"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getCampaignDetail } from "@/lib/actions/marketing.actions";
import type { CampaignAnalyticsRow, CampaignRecipient } from "@/types/database";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-secondary text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
  opened: "bg-success/10 text-success",
  clicked: "bg-success/10 text-success",
};

export function CampaignDetailDialog({
  campaignId, open, onOpenChange,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [campaign, setCampaign] = useState<CampaignAnalyticsRow | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getCampaignDetail(campaignId).then(({ campaign, recipients }) => {
      setCampaign(campaign as CampaignAnalyticsRow);
      setRecipients(recipients as CampaignRecipient[]);
      setLoading(false);
    });
  }, [campaignId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{campaign?.name ?? "Campaign"}</DialogTitle>
          <DialogDescription>
            {campaign ? `${campaign.recipients_sent} sent of ${campaign.recipients_total} · ${campaign.open_rate}% opened · ${campaign.click_rate}% clicked` : "Loading campaign details…"}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="sticky top-0 border-b bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Recipient</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && recipients.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">No recipients recorded yet.</td></tr>
              )}
              {recipients.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{r.recipient_name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.recipient_email || r.recipient_phone || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status] ?? ""}`}>{r.status}</span>
                    {r.error_message && <p className="mt-0.5 text-[11px] text-destructive">{r.error_message}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
