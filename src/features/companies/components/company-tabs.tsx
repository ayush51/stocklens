"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/financials", label: "Financials" },
  { href: "/kpis", label: "KPIs" },
  { href: "/thesis", label: "Thesis" },
  { href: "/filings", label: "Filings" },
];

export function CompanyTabs({ ticker }: { ticker: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 border-b">
      {TABS.map((tab) => {
        const href = `/companies/${ticker}${tab.href}`;
        const isActive = pathname === href;
        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "-mb-px border-b-2 pb-2 text-sm font-medium",
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
