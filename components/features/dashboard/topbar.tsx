"use client";

import { Moon, Sun, LogOut, ChevronDown, Menu } from "lucide-react";
import { useTheme } from "@/components/shared/theme-provider";
import { signOut } from "@/lib/actions/auth.actions";
import { BranchSwitcher } from "@/components/features/branches/branch-switcher";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { AppRole } from "@/types/database";

const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  gym_owner: "Gym Owner",
  receptionist: "Receptionist",
  trainer: "Trainer",
  member: "Member",
};

export function DashboardTopbar({
  fullName,
  role,
  avatarUrl,
  onMenuClick,
}: {
  fullName: string;
  role: AppRole;
  avatarUrl?: string | null;
  onMenuClick?: () => void;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex h-16 items-center justify-between gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-4 lg:px-6 print-hide">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onMenuClick}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">{role === "gym_owner" && <BranchSwitcher />}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={avatarUrl ?? undefined} alt={fullName} />
              <AvatarFallback>{fullName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 text-left sm:block">
              <p className="truncate text-sm font-medium leading-tight">{fullName}</p>
              <p className="text-xs leading-tight text-muted-foreground">{ROLE_LABEL[role]}</p>
            </div>
            <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="sm:hidden">
              <p className="truncate font-medium text-foreground">{fullName}</p>
              <p className="text-muted-foreground">{ROLE_LABEL[role]}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="sm:hidden" />
            <form action={signOut}>
              <DropdownMenuItem asChild className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                <button type="submit" className="w-full">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
