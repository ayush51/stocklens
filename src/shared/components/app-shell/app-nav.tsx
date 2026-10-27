"use client";

import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_GROUPS, isNavItemActive } from "./nav-items";

/** Spinner shown inside a Link while its navigation is in flight. */
function PendingSpinner() {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 aria-label="Loading" className="text-primary ml-auto size-3.5 animate-spin" />
  ) : null;
}

export function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="text-muted-foreground px-3 text-[11px] font-semibold tracking-wider uppercase">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = isNavItemActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
                {item.label}
                <PendingSpinner />
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
