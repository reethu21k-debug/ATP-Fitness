"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { computeRiskScores } from "@/lib/actions/ai.actions";
import type { MemberRiskScore } from "@/types/database";
import { Sparkles, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

type RiskRow = MemberRiskScore & { profiles: { full_name: string; avatar_url: string | null } | null };

const LEVEL_STYLE: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/10 text-warning",
  low: "bg-success/10 text-success",
};

export function RiskAnalysisPanel({ initialScores }: { initialScores: RiskRow[] }) {
  const router = useRouter();
  const [scores] = useState(initialScores);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAnalyze() {
    setError(null);
    startTransition(async () => {
      const result = await computeRiskScores();
      if (!result.success) return setError(result.error);
      router.refresh();
    });
  }

  const atRisk = scores.filter((s) => s.risk_level !== "low");

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-warning" /> Cancellation risk</h2>
            <p className="text-sm text-muted-foreground">Members likely to churn, based on attendance and payment signals.</p>
          </div>
          <Button size="sm" onClick={handleAnalyze} loading={isPending}>
            <Sparkles className="h-4 w-4" /> Analyze now
          </Button>
        </div>

        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

        {scores.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No analysis yet — click "Analyze now" to get started.</p>
        ) : atRisk.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No members currently at meaningful risk. Nice work.</p>
        ) : (
          <div className="space-y-3">
            {atRisk.map((s) => (
              <div key={s.member_id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{s.profiles?.full_name ?? "Member"}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${LEVEL_STYLE[s.risk_level]}`}>
                    {s.risk_level} risk · {s.risk_score}
                  </span>
                </div>
                <ul className="mt-2 space-y-0.5">
                  {s.factors.map((f, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {f.label} — {f.detail}</li>
                  ))}
                </ul>
                {s.ai_narrative && <p className="mt-2 text-xs italic text-primary">{s.ai_narrative}</p>}
              </div>
            ))}
          </div>
        )}
        {scores.length > 0 && (
          <p className="mt-3 text-right text-xs text-muted-foreground">Last analyzed {format(new Date(scores[0]?.computed_at ?? Date.now()), "dd MMM, h:mm a")}</p>
        )}
      </CardContent>
    </Card>
  );
}
