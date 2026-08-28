import Link from "next/link";
import { getMyClients } from "@/lib/actions/trainer.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MemberStatusBadge } from "@/components/features/members/status-badge";
import { UserPlus } from "lucide-react";

export const metadata = { title: "My Clients — ATP Fitness" };

export default async function TrainerClientsPage() {
  const clients = await getMyClients();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">Members assigned to you — plans, diet, and progress.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/trainer/members/new">
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Link>
        </Button>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No members are assigned to you yet. Ask the gym owner or front desk to assign clients from a member's profile.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link key={c.profile_id} href={`/dashboard/trainer/clients/${c.profile_id}`}>
              <Card className="transition-shadow hover:shadow-lg">
                <CardContent className="flex items-center gap-3 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {c.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatar_url} alt={c.full_name} className="h-full w-full object-cover" />
                    ) : (
                      c.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.plan_name ?? "No active plan"}</p>
                  </div>
                  <MemberStatusBadge status={c.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}