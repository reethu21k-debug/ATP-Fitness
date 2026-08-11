import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

// Wraps the native <select> instead of building a custom Radix listbox.
// On touch devices the native element opens the OS picker (full-screen on
// iOS, bottom sheet on Android) which is more reliable on small screens
// than a custom-positioned popover, while still letting us fully control
// the closed-state appearance to match Input/Button.
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "flex h-10 appearance-none rounded-lg border bg-background px-3.5 py-2 pr-9 text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-destructive focus-visible:ring-destructive" : "border-input",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
