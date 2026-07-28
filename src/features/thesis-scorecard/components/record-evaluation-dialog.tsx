"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { recordEvaluation } from "@/features/thesis-scorecard/server/actions";
import {
  CRITERION_STATUSES,
  FISCAL_PERIODS,
  evaluationFormSchema,
  type EvaluationFormInput,
} from "@/features/thesis-scorecard/validation/criterion";
import {
  suggestCriterionStatus,
  type CriterionDirection,
  type CriterionRuleType,
} from "@/features/thesis-scorecard/lib/suggest-status";
import { statusBadgeClassName } from "@/features/thesis-scorecard/lib/status-style";
import type { CriterionSummary } from "@/features/thesis-scorecard/server/queries";

const currentYear = new Date().getFullYear();

export function RecordEvaluationDialog({
  criterion,
  ticker,
}: {
  criterion: CriterionSummary;
  ticker: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<EvaluationFormInput>({
    resolver: zodResolver(evaluationFormSchema),
    defaultValues: {
      criterionId: criterion.id,
      ticker,
      fiscalYear: currentYear,
      fiscalPeriod: "Q1",
      currentValue: "",
      previousValue: criterion.latestEvaluation?.currentValue ?? "",
      status: "INSUFFICIENT_DATA",
      explanation: "",
      source: "",
      overrideReason: "",
    },
  });

  const currentValue = watch("currentValue");
  const previousValue = watch("previousValue");
  const status = watch("status");

  const suggested = suggestCriterionStatus({
    ruleType: criterion.ruleType as CriterionRuleType,
    direction: criterion.direction as CriterionDirection,
    greenThreshold: criterion.greenThreshold ? Number(criterion.greenThreshold) : null,
    watchThreshold: criterion.watchThreshold ? Number(criterion.watchThreshold) : null,
    currentValue: currentValue && !Number.isNaN(Number(currentValue)) ? Number(currentValue) : null,
    previousValue: previousValue && !Number.isNaN(Number(previousValue)) ? Number(previousValue) : null,
  });

  async function onSubmit(data: EvaluationFormInput) {
    try {
      await recordEvaluation(data);
      toast.success(`Recorded evaluation for ${criterion.metricLabel}`);
      setOpen(false);
      reset();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this evaluation.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Record evaluation</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{criterion.metricLabel}</DialogTitle>
          <DialogDescription>
            Enter this period&apos;s value and confirm a status. A suggestion is computed from the
            criterion&apos;s rule, but you always confirm or override it — this never auto-saves without you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fiscalYear">Fiscal year</Label>
              <Input id="fiscalYear" type="number" {...register("fiscalYear", { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fiscalPeriod">Period</Label>
              <Select
                value={watch("fiscalPeriod")}
                onValueChange={(value) =>
                  setValue("fiscalPeriod", value as EvaluationFormInput["fiscalPeriod"])
                }
              >
                <SelectTrigger id="fiscalPeriod" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FISCAL_PERIODS.map((period) => (
                    <SelectItem key={period} value={period}>
                      {period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currentValue">Current value</Label>
              <Input id="currentValue" {...register("currentValue")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="previousValue">Previous value</Label>
              <Input id="previousValue" {...register("previousValue")} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="status">Status</Label>
              {suggested !== "INSUFFICIENT_DATA" ? (
                <span className="text-muted-foreground text-xs">
                  Suggested:{" "}
                  <Badge className={statusBadgeClassName(suggested)} variant="secondary">
                    {suggested}
                  </Badge>
                </span>
              ) : null}
            </div>
            <Select
              value={status}
              onValueChange={(value) => setValue("status", value as EvaluationFormInput["status"])}
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRITERION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="explanation">Explanation</Label>
            <Textarea id="explanation" rows={2} {...register("explanation")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Input id="source" placeholder="e.g. 10-Q filed 2026-06-15" {...register("source")} />
          </div>
          {status !== suggested && suggested !== "INSUFFICIENT_DATA" ? (
            <div className="space-y-2">
              <Label htmlFor="overrideReason">Why override the suggested status?</Label>
              <Textarea id="overrideReason" rows={2} {...register("overrideReason")} />
            </div>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
