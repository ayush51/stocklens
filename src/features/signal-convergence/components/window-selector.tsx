"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { SignalWindow } from "@/features/signal-convergence/server/queries";

const OPTIONS: { value: SignalWindow; label: string }[] = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

export function WindowSelector({ current }: { current: SignalWindow }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setWindow(value: SignalWindow) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("window", String(value));
    params.delete("category"); // a new window invalidates the previous Venn selection's counts
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="border-border inline-flex rounded-md border p-0.5 text-sm">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setWindow(opt.value)}
          className={`rounded px-3 py-1.5 ${current === opt.value ? "bg-accent font-medium" : "text-muted-foreground"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
