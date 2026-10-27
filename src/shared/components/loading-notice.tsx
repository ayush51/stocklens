import { Loader2 } from "lucide-react";

/** Visible "something is happening" line for loading skeletons. */
export function LoadingNotice({ children = "Loading…" }: { children?: React.ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="text-muted-foreground flex items-center gap-2 text-sm">
      <Loader2 className="text-primary size-4 animate-spin" aria-hidden="true" />
      {children}
    </p>
  );
}
