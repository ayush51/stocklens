import type { CriterionStatus } from "./suggest-status";
import type { ThesisTrend } from "./thesis-trend";

export function statusBadgeClassName(status: CriterionStatus): string {
  switch (status) {
    case "GREEN":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "WATCH":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "RED":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "INSUFFICIENT_DATA":
      return "bg-muted text-muted-foreground";
  }
}

export function trendLabel(trend: ThesisTrend): string {
  switch (trend) {
    case "STRENGTHENING":
      return "Thesis strengthening";
    case "WEAKENING":
      return "Thesis weakening";
    case "UNCHANGED":
      return "Thesis unchanged";
    case "INSUFFICIENT_DATA":
      return "Insufficient data";
  }
}

export function trendBadgeClassName(trend: ThesisTrend): string {
  switch (trend) {
    case "STRENGTHENING":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "WEAKENING":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "UNCHANGED":
      return "bg-muted text-muted-foreground";
    case "INSUFFICIENT_DATA":
      return "bg-muted text-muted-foreground";
  }
}
