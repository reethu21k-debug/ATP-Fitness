"use client";

import { useState } from "react";
import { DashboardSidebar, DashboardMobileNav } from "@/components/features/dashboard/sidebar";
import { DashboardTopbar } from "@/components/features/dashboard/topbar";
import type { AppRole } from "@/types/database";

// Thin client wrapper around the (server) profile fetch in
// app/dashboard/layout.tsx -- holds the one bit of state the whole shell
// needs (is the mobile nav drawer open), and wires it between the topbar's
// hamburger button and the sidebar's mobile drawer.
export function DashboardShell({
  role,
  fullName,
  avatarUrl,
  children,
}: {
  role: AppRole;
  fullName: string;
  avatarUrl?: string | null;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar role={role} />
      <DashboardMobileNav role={role} open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          fullName={fullName}
          role={role}
          avatarUrl={avatarUrl}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-y-auto bg-secondary/20 p-3 sm:p-4 lg:p-8 print-area">{children}</main>
      </div>
    </div>
  );
}
