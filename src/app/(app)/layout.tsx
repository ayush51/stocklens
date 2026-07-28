import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { signOut } from "@/lib/auth/actions";
import { WorkspaceProvider } from "@/shared/hooks/use-workspace";
import { Button } from "@/components/ui/button";

// Phase 2 features land under these paths (docs/phase-0/06-routes.md); the
// shell links to them now so the nav structure is visible, even though only
// /dashboard is a real page today.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/portfolios", label: "Portfolios" },
  { href: "/theses", label: "Theses" },
  { href: "/alerts", label: "Alerts" },
  { href: "/settings/workspace", label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { workspaceId, workspaceName } = await ensureWorkspaceForUser(user);

  return (
    <WorkspaceProvider value={{ workspaceId, workspaceName, userEmail: user.email ?? "" }}>
      <div className="flex min-h-screen">
        <aside className="border-border hidden w-56 shrink-0 border-r px-4 py-6 sm:block">
          <Link href="/dashboard" className="mb-6 block text-lg font-semibold">
            ThesisTrack
          </Link>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md px-3 py-2 text-sm font-medium"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex flex-1 flex-col">
          <header className="border-border flex items-center justify-between border-b px-6 py-4">
            <span className="text-muted-foreground text-sm">{workspaceName}</span>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-sm">{user.email}</span>
              <form action={signOut}>
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </div>
          </header>
          <main className="flex-1 px-6 py-8">{children}</main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
