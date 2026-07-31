"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SignalWindow } from "@/features/signal-convergence/server/queries";

const OPTIONS: { value: SignalWindow; label: string }[] = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

export function WindowSelector({
  current,
  customRange,
}: {
  current: SignalWindow;
  customRange: { from: string; to: string } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showCustom, setShowCustom] = useState(!!customRange);
  const [from, setFrom] = useState(customRange?.from ?? "");
  const [to, setTo] = useState(customRange?.to ?? "");

  function setWindow(value: SignalWindow) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("window", String(value));
    params.delete("from");
    params.delete("to");
    params.delete("category"); // a new window invalidates the previous Venn selection's counts
    setShowCustom(false);
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyCustomRange() {
    if (!from || !to || from > to) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", from);
    params.set("to", to);
    params.delete("window");
    params.delete("category");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="border-border inline-flex rounded-md border p-0.5 text-sm">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setWindow(opt.value)}
            className={`rounded px-3 py-1.5 ${!customRange && current === opt.value ? "bg-accent font-medium" : "text-muted-foreground"}`}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom((v) => !v)}
          className={`rounded px-3 py-1.5 ${customRange ? "bg-accent font-medium" : "text-muted-foreground"}`}
        >
          Custom range
        </button>
      </div>
      {showCustom ? (
        <div className="flex items-center gap-2 text-sm">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
          <Button size="sm" disabled={!from || !to || from > to} onClick={applyCustomRange}>
            Apply
          </Button>
        </div>
      ) : null}
    </div>
  );
}
