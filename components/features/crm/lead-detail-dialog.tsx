"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLeadDetail, logLeadActivity, updateLeadStatus, updateLeadFollowUp } from "@/lib/actions/crm.actions";
import type { LeadsOverviewRow, LeadActivity, LeadStatus } from "@/types/database";
import { Phone, Mail, MessageCircle, StickyNote, ArrowRight, XCircle, CheckCircle2 } from "lucide-react";

const NEXT_STATUS: Partial<Record<LeadStatus, LeadStatus>> = {
  new: "contacted",
  contacted: "trial_scheduled",
  trial_scheduled: "trial_completed",
};

export function LeadDetailDialog({ leadId, basePath, open, onOpenChange }: { leadId: string; basePath: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [lead, setLead] = useState<LeadsOverviewRow | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    getLeadDetail(leadId).then(({ lead, activities }) => {
      setLead(lead);
      setActivities(activities);
    });
  }, [open, leadId]);

  function refresh() {
    getLeadDetail(leadId).then(({ lead, activities }) => {
      setLead(lead);
      setActivities(activities);
    });
    router.refresh();
  }

  function handleAdvance() {
    if (!lead) return;
    const next = NEXT_STATUS[lead.status];
    if (!next) return;
    startTransition(async () => {
      await updateLeadStatus(leadId, next);
      refresh();
    });
  }

  function handleMarkLost() {
    const reason = prompt("Why was this lead lost? (optional)") ?? "";
    startTransition(async () => {
      await updateLeadStatus(leadId, "lost", { lostReason: reason });
      refresh();
    });
  }

  function handleAddNote() {
    if (!note.trim()) return;
    startTransition(async () => {
      await logLeadActivity(leadId, "note", note);
      setNote("");
      refresh();
    });
  }

  function handleFollowUpChange(date: string) {
    startTransition(async () => {
      await updateLeadFollowUp(leadId, date || null);
      refresh();
    });
  }

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{lead.name}</DialogTitle>
          <DialogDescription>
            <span className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.phone}</span>
              {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {lead.email}</span>}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {NEXT_STATUS[lead.status] && (
            <Button size="sm" onClick={handleAdvance} loading={isPending}>
              Move to {NEXT_STATUS[lead.status]?.replace("_", " ")} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
          {lead.status === "trial_completed" && (
            <Button size="sm" asChild>
              <Link href={`${basePath}/${leadId}/convert`}><CheckCircle2 className="h-3.5 w-3.5" /> Convert to member</Link>
            </Button>
          )}
          {lead.status !== "converted" && lead.status !== "lost" && (
            <Button size="sm" variant="outline" onClick={handleMarkLost} loading={isPending}>
              <XCircle className="h-3.5 w-3.5" /> Mark lost
            </Button>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Follow-up date</label>
          <Input type="date" defaultValue={lead.follow_up_date ?? ""} onChange={(e) => handleFollowUpChange(e.target.value)} className="h-9" />
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="Log a call, WhatsApp, or note…" value={note} onChange={(e) => setNote(e.target.value)} className="h-9" />
            <Button size="sm" variant="outline" onClick={handleAddNote} loading={isPending}><StickyNote className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        <div className="max-h-64 space-y-3 overflow-y-auto border-t pt-3">
          {activities.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">No activity yet.</p>
          ) : (
            activities.map((a) => (
              <div key={a.id} className="flex gap-2 text-xs">
                <span className="mt-0.5 text-muted-foreground"><MessageCircle className="h-3 w-3" /></span>
                <div>
                  <p>{a.description}</p>
                  <p className="text-muted-foreground">{format(new Date(a.created_at), "dd MMM, h:mm a")}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
