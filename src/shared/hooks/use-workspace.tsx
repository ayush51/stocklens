"use client";

import { createContext, useContext } from "react";

interface WorkspaceContextValue {
  workspaceId: string;
  workspaceName: string;
  userEmail: string;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * Read-only workspace/session info for Client Components. Populated once in
 * (app)/layout.tsx — see docs/phase-0/08-component-architecture.md §4. Not a
 * mutation channel; writes still go through Server Actions.
 */
export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceContextValue;
  children: React.ReactNode;
}) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
