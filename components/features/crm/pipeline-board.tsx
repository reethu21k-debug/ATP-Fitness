"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { LeadDetailDialog } from "./lead-detail-dialog";
import type { LeadsOverviewRow, LeadStatus } from "@/types/database";
import { Phone, Clock } from "lucide-react";

const COLUMNS: { status: LeadStatus; label: string }[] = [
  { status: "new", label: "New" },
  { status: "contacted", label: "Contacted" },
  { status: "trial_scheduled", label: "Trial scheduled" },
  { status: "trial_completed", label: "Trial completed" },
  { status: "converted", label: "Converted" },
  { status: "lost", label: "Lost" },
];

export function PipelineBoard({ leadsByStatus, basePath }: { leadsByStatus: Partial<Record<LeadStatus, LeadsOverviewRow[]>>; basePath: string }) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const leads = leadsByStatus[col.status] ?? [];
          return (
            <div key={col.status} className="w-72 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-sm font-semibold">{col.label}</p>
                <span className="text-xs text-muted-foreground">{leads.length}</span>
              </div>
              <div className="space-y-2">
                {leads.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">No leads</div>
                ) : (
                  leads.map((lead) => (
                    <Card key={lead.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setSelectedLeadId(lead.id)}>
                      <CardContent className="space-y-1.5 p-3.5">
                        <p className="text-sm font-medium">{lead.name}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {lead.phone}</p>
                        {lead.follow_up_date && (
                          <p className="flex items-center gap-1 text-xs text-warning"><Clock className="h-3 w-3" /> Follow up {format(new Date(lead.follow_up_date), "dd MMM")}</p>
                        )}
                        {lead.assigned_to_name && <p className="text-xs text-muted-foreground">Assigned: {lead.assigned_to_name}</p>}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedLeadId && (
        <LeadDetailDialog leadId={selectedLeadId} basePath={basePath} open={!!selectedLeadId} onOpenChange={(open) => !open && setSelectedLeadId(null)} />
      )}
    </>
  );
}
