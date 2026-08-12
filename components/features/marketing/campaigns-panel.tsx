"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Mail, MessageCircle, Radio } from "lucide-react";
import {
  listCampaigns,
  cancelScheduledCampaign,
  sendCampaignNow,
  deleteCampaign,
} from "@/lib/actions/marketing.actions";
import { Button } from "@/components/ui/button";
import { NewCampaignDialog } from "./new-campaign-dialog";
import { CampaignDetailDialog } from "./campaign-detail-dialog";
import type { CampaignAnalyticsRow } from "@/types/database";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-secondary text-muted-foreground",
  scheduled: "bg-warning/10 text-warning",
  sending: "bg-primary/10 text-primary",
  sent: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-secondary text-muted-foreground line-through",
};

const CHANNEL_ICON = { email: Mail, whatsapp: MessageCircle, both: Radio };

export function CampaignsPanel({
  basePath,
  canManage,
}: {
  basePath: string;
  canManage: boolean;
}) {
  const [campaigns, setCampaigns] = useState<CampaignAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const data = await listCampaigns();
    setCampaigns(data as CampaignAnalyticsRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSendNow(id: string) {
    setBusyId(id);
    setError(null);
    const result = await sendCampaignNow(id);
    if (!result.success) setError(result.error ?? "Could not send this campaign.");
    await load();
    setBusyId(null);
  }

  async function handleCancel(id: string) {
    setBusyId(id);
    setError(null);
    const result = await cancelScheduledCampaign(id);
    if (!result.success) setError(result.error ?? "Could not cancel this campaign.");
    await load();
    setBusyId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this campaign? This can't be undone.")) return;
    setBusyId(id);
    setError(null);
    const result = await deleteCampaign(id);
    if (!result.success) setError(result.error ?? "Could not delete this campaign.");
    await load();
    setBusyId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Email and WhatsApp campaigns sent to your members or leads.
        </p>
        {canManage && <NewCampaignDialog onCreated={load} />}
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sent / Total</th>
                <th className="px-4 py-3">Open rate</th>
                <th className="px-4 py-3">Click rate</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && campaigns.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No campaigns yet.
                  </td>
                </tr>
              )}
              {campaigns.map((c) => {
                const ChannelIcon = CHANNEL_ICON[c.channel];
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <button
                        className="font-medium text-left hover:underline"
                        onClick={() => setSelectedId(c.id)}
                      >
                        {c.name}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {c.scheduled_at
                          ? `Scheduled ${format(new Date(c.scheduled_at), "dd MMM yyyy, h:mm a")}`
                          : c.sent_at
                            ? `Sent ${format(new Date(c.sent_at), "dd MMM yyyy")}`
                            : "Not scheduled"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 capitalize">
                        <ChannelIcon className="h-3.5 w-3.5" /> {c.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[c.status]}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.recipients_sent} / {c.recipients_total}
                    </td>
                    <td className="px-4 py-3">{c.open_rate}%</td>
                    <td className="px-4 py-3">{c.click_rate}%</td>
                    <td className="px-4 py-3">
                      {canManage && (
                        <div className="flex items-center gap-2 text-xs">
                          {(c.status === "draft" || c.status === "failed") && (
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busyId === c.id}
                              onClick={() => handleSendNow(c.id)}
                            >
                              {c.status === "failed" ? "Retry send" : "Send now"}
                            </Button>
                          )}
                          {c.status === "scheduled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busyId === c.id}
                              onClick={() => handleCancel(c.id)}
                            >
                              Cancel
                            </Button>
                          )}
                          {c.status === "sending" && (
                            <span className="text-muted-foreground">
                              Sending — if this doesn't update after a minute, delete and recreate it.
                            </span>
                          )}
                          {(c.status === "draft" ||
                            c.status === "cancelled" ||
                            c.status === "failed" ||
                            c.status === "sending") && (
                            <button
                              className="text-destructive hover:underline"
                              onClick={() => handleDelete(c.id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId && (
        <CampaignDetailDialog
          campaignId={selectedId}
          open={!!selectedId}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </div>
  );
}