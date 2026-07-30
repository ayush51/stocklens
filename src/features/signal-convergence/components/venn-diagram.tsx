"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { VennOverlapCounts } from "@/features/signal-convergence/server/queries";

export type VennCategory =
  | "insiderOnly"
  | "contractsOnly"
  | "congressOnly"
  | "insiderAndContracts"
  | "insiderAndCongress"
  | "contractsAndCongress"
  | "allThree";

const SEGMENTS: { key: VennCategory; label: string }[] = [
  { key: "insiderOnly", label: "Insider only" },
  { key: "contractsOnly", label: "Contracts only" },
  { key: "congressOnly", label: "Congress only" },
  { key: "insiderAndContracts", label: "Insider + Contracts" },
  { key: "insiderAndCongress", label: "Insider + Congress" },
  { key: "contractsAndCongress", label: "Contracts + Congress" },
  { key: "allThree", label: "All three" },
];

/**
 * A hand-rolled 3-circle SVG rather than a new charting dependency —
 * recharts (already in this app) has no Venn primitive, and this feature
 * doesn't need one for anything else. Clicking a region sets ?category=
 * in the URL, which the server page reads to filter the table below —
 * shareable/bookmarkable state, not client-only.
 *
 * Below sm breakpoint the SVG's small overlap regions become unreadable
 * (per the spec's own explicit fallback requirement) — a plain 7-row
 * list takes over instead.
 */
export function SignalVennDiagram({ counts }: { counts: VennOverlapCounts }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");

  function setCategory(category: VennCategory | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (category && activeCategory === category) {
      params.delete("category");
    } else if (category) {
      params.set("category", category);
    } else {
      params.delete("category");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const regionClass = (key: VennCategory) =>
    `cursor-pointer transition-opacity hover:opacity-80 ${activeCategory && activeCategory !== key ? "opacity-40" : "opacity-100"}`;

  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 260 220"
        className="hidden max-h-72 w-full sm:block"
        role="img"
        aria-label="Signal overlap diagram"
      >
        <g className={regionClass("insiderOnly")} onClick={() => setCategory("insiderOnly")}>
          <circle cx="100" cy="80" r="70" fill="var(--chart-1)" fillOpacity="0.35" />
        </g>
        <g className={regionClass("contractsOnly")} onClick={() => setCategory("contractsOnly")}>
          <circle cx="140" cy="140" r="70" fill="var(--chart-2)" fillOpacity="0.35" />
        </g>
        <g className={regionClass("congressOnly")} onClick={() => setCategory("congressOnly")}>
          <circle cx="60" cy="140" r="70" fill="var(--chart-3)" fillOpacity="0.35" />
        </g>

        <text x="70" y="60" textAnchor="middle" className="fill-foreground text-[11px] font-medium">
          Insider
        </text>
        <text
          x="70"
          y="50"
          textAnchor="middle"
          className="fill-foreground text-base font-semibold tabular-nums"
        >
          {counts.insiderOnly}
        </text>

        <text x="185" y="150" textAnchor="middle" className="fill-foreground text-[11px] font-medium">
          Contracts
        </text>
        <text
          x="185"
          y="140"
          textAnchor="middle"
          className="fill-foreground text-base font-semibold tabular-nums"
        >
          {counts.contractsOnly}
        </text>

        <text x="15" y="150" textAnchor="middle" className="fill-foreground text-[11px] font-medium">
          Congress
        </text>
        <text
          x="15"
          y="140"
          textAnchor="middle"
          className="fill-foreground text-base font-semibold tabular-nums"
        >
          {counts.congressOnly}
        </text>

        <text
          x="120"
          y="105"
          textAnchor="middle"
          className="fill-foreground text-sm font-semibold tabular-nums"
        >
          {counts.insiderAndContracts}
        </text>
        <text
          x="80"
          y="105"
          textAnchor="middle"
          className="fill-foreground text-sm font-semibold tabular-nums"
        >
          {counts.insiderAndCongress}
        </text>
        <text
          x="100"
          y="180"
          textAnchor="middle"
          className="fill-foreground text-sm font-semibold tabular-nums"
        >
          {counts.contractsAndCongress}
        </text>
        <text
          x="100"
          y="140"
          textAnchor="middle"
          className="fill-foreground text-base font-bold tabular-nums"
        >
          {counts.allThree}
        </text>
      </svg>

      <div className="grid grid-cols-2 gap-2 sm:hidden">
        {SEGMENTS.map((seg) => (
          <button
            key={seg.key}
            onClick={() => setCategory(seg.key)}
            className={`rounded-md border px-3 py-2 text-left text-sm ${activeCategory === seg.key ? "border-primary bg-accent" : "border-border"}`}
          >
            <p className="text-muted-foreground text-xs">{seg.label}</p>
            <p className="font-semibold tabular-nums">{counts[seg.key]}</p>
          </button>
        ))}
      </div>

      {activeCategory ? (
        <button onClick={() => setCategory(null)} className="text-primary text-xs underline">
          Clear filter
        </button>
      ) : null}
    </div>
  );
}
