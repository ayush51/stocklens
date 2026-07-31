"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  confirmEntityResolution,
  rejectEntityResolution,
} from "@/features/signal-convergence/server/entity-resolution-actions";

export interface ReviewItem {
  id: string;
  sourceType: string;
  rawName: string;
  suggestedCompanyId: string | null;
  suggestedCompany: { ticker: string; name: string } | null;
  suggestedConfidence: number | null;
}

export interface CompanyOption {
  id: string;
  ticker: string;
  name: string;
}

export function ResolutionReviewList({
  reviews,
  companies,
}: {
  reviews: ReviewItem[];
  companies: CompanyOption[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Per-review manual override — starts unset so "Confirm" defaults to the
  // system's own suggestion until the reviewer explicitly picks something
  // else from the full company list.
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  async function handleConfirm(review: ReviewItem) {
    const companyId = overrides[review.id] ?? review.suggestedCompanyId;
    if (!companyId) return;
    setPendingId(review.id);
    try {
      await confirmEntityResolution(review.id, companyId);
      const linkedTo = companies.find((c) => c.id === companyId)?.ticker ?? review.suggestedCompany?.ticker;
      toast.success(`Linked "${review.rawName}" to ${linkedTo}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not confirm this mapping.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleReject(review: ReviewItem) {
    setPendingId(review.id);
    try {
      await rejectEntityResolution(review.id);
      toast.success("Marked as rejected");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reject this mapping.");
    } finally {
      setPendingId(null);
    }
  }

  if (reviews.length === 0) {
    return <p className="text-muted-foreground text-sm">Nothing pending review right now.</p>;
  }

  return (
    <div className="space-y-2">
      {reviews.map((review) => {
        const overrideId = overrides[review.id];
        const canConfirm = !!(overrideId ?? review.suggestedCompanyId);
        return (
          <Card key={review.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{review.sourceType.replace(/_/g, " ")}</Badge>
                  <span className="text-sm font-medium">{review.rawName}</span>
                </div>
                {review.suggestedCompany ? (
                  <p className="text-muted-foreground text-xs">
                    Suggested: {review.suggestedCompany.ticker} — {review.suggestedCompany.name}
                    {review.suggestedConfidence !== null
                      ? ` (${Math.round(review.suggestedConfidence * 100)}% confidence)`
                      : ""}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">No candidate match found.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={overrideId ?? "__suggested__"}
                  onValueChange={(v) => {
                    if (!v) return;
                    setOverrides((prev) => {
                      if (v === "__suggested__") {
                        const next = { ...prev };
                        delete next[review.id];
                        return next;
                      }
                      return { ...prev, [review.id]: v };
                    });
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Link to a company…" />
                  </SelectTrigger>
                  <SelectContent>
                    {review.suggestedCompany ? (
                      <SelectItem value="__suggested__">
                        Use suggestion ({review.suggestedCompany.ticker})
                      </SelectItem>
                    ) : null}
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.ticker} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={pendingId === review.id || !canConfirm}
                  onClick={() => handleConfirm(review)}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pendingId === review.id}
                  onClick={() => handleReject(review)}
                >
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
