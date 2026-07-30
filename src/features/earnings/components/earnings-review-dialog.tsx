"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { submitEarningsReview } from "@/features/earnings/server/actions";
import { earningsReviewSchema, type EarningsReviewInput } from "@/features/earnings/validation/review";

export function EarningsReviewDialog({
  earningsEventId,
  companyId,
  ticker,
  label,
}: {
  earningsEventId: string;
  companyId: string;
  ticker: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EarningsReviewInput>({
    resolver: zodResolver(earningsReviewSchema),
    defaultValues: { earningsEventId, companyId, ticker, notes: "", affectsThesis: false },
  });

  async function onSubmit(data: EarningsReviewInput) {
    try {
      await submitEarningsReview(data);
      toast.success("Review saved");
      setOpen(false);
      reset({ earningsEventId, companyId, ticker, notes: "", affectsThesis: false });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this review.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>{label}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review {ticker} earnings</DialogTitle>
          <DialogDescription>
            A quick note on whether this report changes anything about your thesis — not a full re-write.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Textarea
            placeholder="What stood out — beat/miss drivers, guidance, anything that changes the thesis..."
            rows={5}
            {...register("notes")}
          />
          {errors.notes ? <p className="text-destructive text-sm">{errors.notes.message}</p> : null}
          <label htmlFor="affectsThesis" className="flex items-start gap-2 text-sm">
            <input
              id="affectsThesis"
              type="checkbox"
              className="mt-0.5"
              checked={watch("affectsThesis")}
              onChange={(e) => setValue("affectsThesis", e.target.checked)}
            />
            This report changes something about my thesis — mark it reviewed in the thesis&apos;s own history
            (no edit needed; if there&apos;s no thesis for this company yet, this just saves the note).
          </label>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save review"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
