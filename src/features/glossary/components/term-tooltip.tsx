"use client";

import { InfoIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GLOSSARY, type GlossaryTermKey } from "@/features/glossary/lib/glossary";

export function TermTooltip({ termKey, children }: { termKey: GlossaryTermKey; children: React.ReactNode }) {
  const entry = GLOSSARY[termKey];

  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2">
        {children}
        <InfoIcon className="h-3 w-3 shrink-0" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-1 text-left">
        <p className="font-medium">{entry.term}</p>
        <p>{entry.definition}</p>
        <p className="opacity-80">{entry.impact}</p>
      </TooltipContent>
    </Tooltip>
  );
}
