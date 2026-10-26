import {
  BookOpen,
  Bell,
  Briefcase,
  CalendarDays,
  FlaskConical,
  LayoutDashboard,
  Lightbulb,
  Radar,
  Settings,
  Upload,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Path prefix that marks this item active; defaults to href. */
  match?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/portfolios", label: "Portfolios", icon: Briefcase },
    ],
  },
  {
    label: "Research",
    items: [
      { href: "/theses", label: "Theses", icon: Lightbulb },
      { href: "/earnings", label: "Earnings", icon: CalendarDays },
      { href: "/signal-convergence", label: "Signal Convergence", icon: Radar },
      { href: "/scenarios", label: "Scenarios", icon: FlaskConical },
      { href: "/journal", label: "Journal", icon: BookOpen },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/imports", label: "Imports", icon: Upload },
      { href: "/alerts", label: "Alerts", icon: Bell },
      { href: "/settings/workspace", label: "Settings", icon: Settings, match: "/settings" },
    ],
  },
];

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  const match = item.match ?? item.href;
  return pathname === match || pathname.startsWith(`${match}/`);
}
