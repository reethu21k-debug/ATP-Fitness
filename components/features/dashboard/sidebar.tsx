"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Dumbbell, Wallet, QrCode, Boxes, Megaphone,
  FileBarChart, Settings, Building2, ShieldCheck, MessagesSquare, Calendar,
  Salad, TrendingUp, Ticket, Sparkles, Calculator, X, UserPlus, Clock, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { AppRole } from "@/types/database";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  super_admin: [
    { href: "/dashboard/platform", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/platform/tenants", label: "Tenants", icon: Building2 },
    { href: "/dashboard/platform/billing", label: "Billing", icon: Wallet },
    { href: "/dashboard/platform/tickets", label: "Support Tickets", icon: Ticket },
    { href: "/dashboard/platform/settings", label: "Platform Settings", icon: ShieldCheck },
  ],
  gym_owner: [
    { href: "/dashboard/owner", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/owner/branches", label: "Branches", icon: Building2 },
    { href: "/dashboard/owner/members", label: "Members", icon: Users },
    { href: "/dashboard/owner/renewals", label: "Renewals", icon: Clock },
    { href: "/dashboard/owner/plans", label: "Membership Plans", icon: CreditCard },
    { href: "/dashboard/owner/crm", label: "Leads & CRM", icon: Ticket },
    { href: "/dashboard/owner/payments", label: "Payments", icon: Wallet },
    { href: "/dashboard/owner/trainers", label: "Trainers", icon: Dumbbell },
    { href: "/dashboard/owner/attendance", label: "Attendance", icon: QrCode },
    { href: "/dashboard/owner/revenue", label: "Revenue", icon: TrendingUp },
    { href: "/dashboard/owner/inventory", label: "Inventory", icon: Boxes },
    { href: "/dashboard/owner/payroll", label: "Payroll", icon: Wallet },
    { href: "/dashboard/owner/marketing", label: "Marketing", icon: Megaphone },
    { href: "/dashboard/owner/chat", label: "Chat", icon: MessagesSquare },
    { href: "/dashboard/owner/insights", label: "AI Insights", icon: Sparkles },
    { href: "/dashboard/owner/reports", label: "Reports", icon: FileBarChart },
    { href: "/dashboard/owner/settings", label: "Settings", icon: Settings },
  ],
  receptionist: [
    { href: "/dashboard/reception", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/reception/members", label: "Members", icon: Users },
    { href: "/dashboard/reception/crm", label: "Leads & CRM", icon: Ticket },
    { href: "/dashboard/reception/payments", label: "Payments", icon: Wallet },
    { href: "/dashboard/reception/attendance", label: "Attendance", icon: QrCode },
    { href: "/dashboard/reception/inventory", label: "Inventory", icon: Boxes },
    { href: "/dashboard/reception/marketing", label: "Marketing", icon: Megaphone },
    { href: "/dashboard/reception/appointments", label: "Appointments", icon: Calendar },
  ],
  trainer: [
    { href: "/dashboard/trainer", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/trainer/clients", label: "My Clients", icon: Users },
    { href: "/dashboard/trainer/members/new", label: "Add Member", icon: UserPlus },
    { href: "/dashboard/trainer/renewals", label: "Renewals", icon: Clock },
    { href: "/dashboard/trainer/attendance", label: "Attendance", icon: QrCode },
    { href: "/dashboard/trainer/chat", label: "Chat", icon: MessagesSquare },
  ],
  member: [
    { href: "/dashboard/member", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/member/membership", label: "Membership", icon: Wallet },
    { href: "/dashboard/member/workout", label: "Workout", icon: Dumbbell },
    { href: "/dashboard/member/diet", label: "Nutrition", icon: Salad },
    { href: "/dashboard/member/fitness-calculator", label: "Fitness Calculator", icon: Calculator },
    { href: "/dashboard/member/attendance", label: "QR Attendance", icon: QrCode },
    { href: "/dashboard/member/ai-assistant", label: "AI Assistant", icon: Sparkles },
    { href: "/dashboard/member/chat", label: "Chat", icon: MessagesSquare },
  ],
};

function NavLinks({ role, onNavigate }: { role: AppRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role];

  return (
    <nav className="flex flex-col gap-1 p-4">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardSidebar({ role }: { role: AppRole }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card/50 lg:block print-hide">
      <NavLinks role={role} />
    </aside>
  );
}

// Mobile drawer -- rendered from DashboardTopbar's hamburger trigger. Slides
// in from the left over a dimming backdrop; both the backdrop and the close
// button dismiss it. Only mounted below `lg`, matching the breakpoint where
// the static `DashboardSidebar` above disappears, so there's always exactly
// one way to navigate visible on screen.
export function DashboardMobileNav({ role, open, onClose }: { role: AppRole; open: boolean; onClose: () => void }) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 lg:hidden print-hide",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
      />
      <aside
        className={cn(
          "absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r bg-card shadow-soft transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <span className="text-sm font-semibold">Menu</span>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <NavLinks role={role} onNavigate={onClose} />
      </aside>
    </div>
  );
}