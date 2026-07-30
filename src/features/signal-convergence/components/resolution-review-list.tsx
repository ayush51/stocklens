"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

/**
 * Confirm only offers the system's own suggestion, not a free-text
 * search across every company — a deliberate scope simplification given
 * this app's small company list; picking a different company than the
 * one suggested still works by rejecting here and adding a manual
 * CompanyAlias directly (see the Methodology tab).
 */
export function ResolutionReviewList({ reviews }: { reviews: ReviewItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleConfirm(review: ReviewItem) {
    if (!review.suggestedCompanyId || !review.suggestedCompany) return;
    setPendingId(review.id);
    try {
      await confirmEntityResolution(review.id, review.suggestedCompanyId);
      toast.success(`Linked "${review.rawName}" to ${review.suggestedCompany.ticker}`);
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
      {reviews.map((review) => (
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
            <div className="flex gap-2">
              {review.suggestedCompany ? (
                <Button size="sm" disabled={pendingId === review.id} onClick={() => handleConfirm(review)}>
                  Confirm
                </Button>
              ) : null}
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
      ))}
    </div>
  );
}
