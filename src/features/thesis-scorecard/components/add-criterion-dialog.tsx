"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
import { createCriterion } from "@/features/thesis-scorecard/server/actions";
import {
  CRITERION_DIRECTIONS,
  CRITERION_RULE_TYPES,
  criterionFormSchema,
  type CriterionFormInput,
} from "@/features/thesis-scorecard/validation/criterion";

const RULE_TYPE_LABELS: Record<(typeof CRITERION_RULE_TYPES)[number], string> = {
  NUMERIC_THRESHOLD: "Numeric threshold",
  PERCENT_GROWTH_THRESHOLD: "Percentage growth threshold",
  SEQUENTIAL_CHANGE: "Sequential (quarter-over-quarter) change",
  YEAR_OVER_YEAR_CHANGE: "Year-over-year change",
  CONSECUTIVE_DETERIORATION: "Consecutive-period deterioration",
  BOOLEAN_EVENT: "Boolean event",
  QUALITATIVE_MANUAL: "Qualitative manual review",
};

const NUMERIC_RULE_TYPES = new Set<(typeof CRITERION_RULE_TYPES)[number]>([
  "NUMERIC_THRESHOLD",
  "PERCENT_GROWTH_THRESHOLD",
  "SEQUENTIAL_CHANGE",
  "YEAR_OVER_YEAR_CHANGE",
]);

export function AddCriterionDialog({ thesisId, ticker }: { thesisId: string; ticker: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CriterionFormInput>({
    resolver: zodResolver(criterionFormSchema),
    defaultValues: {
      thesisId,
      ticker,
      metricLabel: "",
      direction: "HIGHER_IS_BETTER",
      ruleType: "NUMERIC_THRESHOLD",
      greenRule: "",
      watchRule: "",
      redRule: "",
      greenThreshold: "",
      watchThreshold: "",
      evaluationPeriod: "Quarterly",
      consecutivePeriodRequirement: 1,
    },
  });

  const ruleType = watch("ruleType");
  const showThresholds = NUMERIC_RULE_TYPES.has(ruleType) || ruleType === "CONSECUTIVE_DETERIORATION";

  async function onSubmit(data: CriterionFormInput) {
    try {
      await createCriterion(data);
      toast.success(`Added criterion: ${data.metricLabel}`);
      setOpen(false);
      reset();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add this criterion.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Add criterion</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add scorecard criterion</DialogTitle>
          <DialogDescription>
            Define what would make you more or less confident in this thesis — not a buy/sell rule, a health
            check.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="metricLabel">Metric</Label>
            <Input id="metricLabel" placeholder="e.g. RPO growth" {...register("metricLabel")} />
            {errors.metricLabel ? (
              <p className="text-destructive text-sm">{errors.metricLabel.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="direction">Direction</Label>
              <Select
                value={watch("direction")}
                onValueChange={(value) => setValue("direction", value as CriterionFormInput["direction"])}
              >
                <SelectTrigger id="direction" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRITERION_DIRECTIONS.map((direction) => (
                    <SelectItem key={direction} value={direction}>
                      {direction === "HIGHER_IS_BETTER" ? "Higher is better" : "Lower is better"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="evaluationPeriod">Evaluation period</Label>
              <Input id="evaluationPeriod" placeholder="e.g. Quarterly" {...register("evaluationPeriod")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ruleType">Rule type</Label>
            <Select
              value={ruleType}
              onValueChange={(value) => setValue("ruleType", value as CriterionFormInput["ruleType"])}
            >
              <SelectTrigger id="ruleType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRITERION_RULE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {RULE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showThresholds ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="greenThreshold">Green threshold</Label>
                <Input id="greenThreshold" placeholder="e.g. 20" {...register("greenThreshold")} />
                {errors.greenThreshold ? (
                  <p className="text-destructive text-sm">{errors.greenThreshold.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="watchThreshold">Watch threshold</Label>
                <Input id="watchThreshold" placeholder="e.g. 5" {...register("watchThreshold")} />
                {errors.watchThreshold ? (
                  <p className="text-destructive text-sm">{errors.watchThreshold.message}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {ruleType === "CONSECUTIVE_DETERIORATION" ? (
            <div className="space-y-2">
              <Label htmlFor="consecutivePeriodRequirement">Consecutive periods required</Label>
              <Input
                id="consecutivePeriodRequirement"
                type="number"
                min={1}
                {...register("consecutivePeriodRequirement", { valueAsNumber: true })}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="greenRule">Green rule (description)</Label>
            <Textarea id="greenRule" rows={2} {...register("greenRule")} />
            {errors.greenRule ? <p className="text-destructive text-sm">{errors.greenRule.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="watchRule">Watch rule (description)</Label>
            <Textarea id="watchRule" rows={2} {...register("watchRule")} />
            {errors.watchRule ? <p className="text-destructive text-sm">{errors.watchRule.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="redRule">Red rule (description)</Label>
            <Textarea id="redRule" rows={2} {...register("redRule")} />
            {errors.redRule ? <p className="text-destructive text-sm">{errors.redRule.message}</p> : null}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Add criterion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
