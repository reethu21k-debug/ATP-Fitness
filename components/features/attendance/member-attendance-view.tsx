"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrScannerDialog } from "./qr-scanner-dialog";
import { checkOutMember } from "@/lib/actions/attendance.actions";
import type { AttendanceRecord } from "@/types/database";
import { ScanLine, LogOut, Clock, MapPin } from "lucide-react";

export function MemberAttendanceView({
  checkedIn,
  session,
  history,
}: {
  checkedIn: boolean;
  session: AttendanceRecord | null;
  history: AttendanceRecord[];
}) {
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleCheckOut() {
    startTransition(async () => {
      await checkOutMember();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className={checkedIn ? "border-success/40 bg-success/5" : ""}>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          {checkedIn && session ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                <Clock className="h-7 w-7" />
              </div>
              <div>
                <p className="font-semibold">You're checked in</p>
                <p className="text-sm text-muted-foreground">
                  Since {format(new Date(session.check_in_at), "h:mm a")}
                </p>
                {session.gps_verified && (
                  <p className="mt-1 flex items-center justify-center gap-1 text-xs text-success">
                    <MapPin className="h-3 w-3" /> Location verified
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleCheckOut}
                loading={isPending}
              >
                <LogOut className="h-4 w-4" /> Check out
              </Button>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ScanLine className="h-7 w-7" />
              </div>
              <div>
                <p className="font-semibold">Not checked in</p>
                <p className="text-sm text-muted-foreground">
                  Scan the QR code at the front desk to check in.
                </p>
              </div>
              <Button onClick={() => setScannerOpen(true)}>
                <ScanLine className="h-4 w-4" /> Scan to check in
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Recent visits</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No visits recorded yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Check in</th>
                    <th className="px-4 py-2.5">Check out</th>
                    <th className="px-4 py-2.5">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5">
                        {format(new Date(h.check_in_at), "dd MMM yyyy")}
                      </td>
                      <td className="px-4 py-2.5">
                        {format(new Date(h.check_in_at), "h:mm a")}
                      </td>
                      <td className="px-4 py-2.5">
                        {h.check_out_at
                          ? format(new Date(h.check_out_at), "h:mm a")
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {h.duration_minutes != null
                          ? `${h.duration_minutes} min`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
