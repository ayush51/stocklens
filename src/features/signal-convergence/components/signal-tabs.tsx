"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/signal-convergence", label: "Overview" },
  { href: "/signal-convergence/government-contracts", label: "Government Contracts" },
  { href: "/signal-convergence/congressional-trades", label: "Congressional Trades" },
  { href: "/signal-convergence/insider-trades", label: "Insider Trades" },
  { href: "/signal-convergence/data-health", label: "Data Health" },
  { href: "/signal-convergence/methodology", label: "Methodology" },
];

export function SignalTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 overflow-x-auto border-b">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px shrink-0 border-b-2 pb-2 text-sm font-medium",
              isActive
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
