"use client";

import { Button } from "@/components/ui/button";

export default function CompanyKpisError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="border-border flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
      <p className="font-medium">Couldn&apos;t load KPIs</p>
      <p className="text-muted-foreground max-w-sm text-sm">Something went wrong. Try again in a moment.</p>
      <Button onClick={reset} variant="outline" size="sm">
        Retry
      </Button>
    </div>
  );
}
