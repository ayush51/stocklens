import Link from "next/link";
import { Bell } from "lucide-react";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { WorkspaceProvider } from "@/shared/hooks/use-workspace";
import { CompanySearchBox } from "@/features/companies/components/company-search-box";
import { ChatWidget } from "@/features/assistant/components/chat-widget";
import { DisclaimerFooter } from "@/shared/components/disclaimer-footer";
import { AppNav } from "@/shared/components/app-shell/app-nav";
import { BrandLogo } from "@/shared/components/app-shell/brand-logo";
import { MobileNav } from "@/shared/components/app-shell/mobile-nav";
import { ThemeToggle } from "@/shared/components/app-shell/theme-toggle";
import { UserMenu } from "@/shared/components/app-shell/user-menu";
import { Button } from "@/components/ui/button";

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
          <div className="mb-6">
            <BrandLogo />
          </div>
          <AppNav />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-border flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-2">
              <MobileNav />
              <span className="text-muted-foreground hidden shrink-0 truncate text-sm md:inline">
                {workspaceName}
              </span>
            </div>
            <CompanySearchBox />
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Alerts"
                render={<Link href="/alerts" />}
                nativeButton={false}
              >
                <Bell className="size-4" />
              </Button>
              <ThemeToggle />
              <UserMenu email={user.email ?? ""} workspaceName={workspaceName} />
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
          <DisclaimerFooter />
        </div>
      </div>
      <ChatWidget />
    </WorkspaceProvider>
  );
}
