"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, UserCheck, UserX, Loader2, CheckCircle2 } from "lucide-react";
import {
  searchMembersForCheckIn,
  manualCheckIn,
  manualCheckOut,
  type CheckInMemberOption,
} from "@/lib/actions/attendance.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ManualCheckInPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CheckInMemberOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [justChangedId, setJustChangedId] = useState<{ id: string; action: "in" | "out" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(() => {
      startTransition(async () => {
        const rows = await searchMembersForCheckIn(query);
        setResults(rows);
        setSearching(false);
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function handleCheckIn(member: CheckInMemberOption) {
    setError(null);
    setPendingId(member.memberId);
    const result = await manualCheckIn(member.memberId);
    setPendingId(null);

    if (!result.success) {
      setError(result.error);
      return;
    }
    setResults((prev) =>
      prev.map((m) => (m.memberId === member.memberId ? { ...m, alreadyCheckedIn: true } : m))
    );
    setJustChangedId({ id: member.memberId, action: "in" });
    setTimeout(() => setJustChangedId(null), 2000);
  }

  async function handleCheckOut(member: CheckInMemberOption) {
    setError(null);
    setPendingId(member.memberId);
    const result = await manualCheckOut(member.memberId);
    setPendingId(null);

    if (!result.success) {
      setError(result.error);
      return;
    }
    setResults((prev) =>
      prev.map((m) => (m.memberId === member.memberId ? { ...m, alreadyCheckedIn: false } : m))
    );
    setJustChangedId({ id: member.memberId, action: "out" });
    setTimeout(() => setJustChangedId(null), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="h-4 w-4" /> Manual check-in
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          For members without their phone — search by name or number to check them in or out directly.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search member by name or phone…"
            className="pl-9"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {(searching || isPending) && query.trim().length >= 2 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
          </div>
        )}

        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <p className="text-sm text-muted-foreground">No members found.</p>
        )}

        {results.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {results.map((member) => {
              const justChanged = justChangedId?.id === member.memberId ? justChangedId.action : null;
              return (
                <li key={member.memberId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.phone ?? "No phone on file"}</p>
                  </div>

                  {justChanged ? (
                    <Badge variant={justChanged === "in" ? "success" : "secondary"} className="shrink-0">
                      <CheckCircle2 className="h-3 w-3" /> {justChanged === "in" ? "Checked in" : "Checked out"}
                    </Badge>
                  ) : member.alreadyCheckedIn ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="success">
                        <CheckCircle2 className="h-3 w-3" /> Checked in
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingId === member.memberId}
                        onClick={() => handleCheckOut(member)}
                      >
                        {pendingId === member.memberId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <UserX className="h-3.5 w-3.5" /> Check out
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="shrink-0"
                      disabled={pendingId === member.memberId}
                      onClick={() => handleCheckIn(member)}
                    >
                      {pendingId === member.memberId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Check in"
                      )}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}