"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordMetricObservation } from "@/features/company-metrics/server/actions";
import {
  FISCAL_PERIODS,
  recordObservationSchema,
  type RecordObservationInput,
} from "@/features/company-metrics/validation/observation";

const currentYear = new Date().getFullYear();

export function RecordObservationDialog({
  templateItemId,
  ticker,
  metricLabel,
  unit,
}: {
  templateItemId: string;
  ticker: string;
  metricLabel: string;
  unit: string;
}) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecordObservationInput>({
    resolver: zodResolver(recordObservationSchema),
    defaultValues: {
      templateItemId,
      ticker,
      fiscalYear: currentYear,
      fiscalPeriod: "Q1",
      value: "",
      source: "",
    },
  });

  async function onSubmit(data: RecordObservationInput) {
    try {
      await recordMetricObservation(data);
      toast.success(`Recorded ${metricLabel} for ${data.fiscalPeriod} ${data.fiscalYear}`);
      setOpen(false);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this observation.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Record value</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{metricLabel}</DialogTitle>
          <DialogDescription>
            Enter the reported value for a specific period. Always cite a source — this is recorded as a
            manual, human-verified figure, not an automated extraction.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fiscalYear">Fiscal year</Label>
              <Input id="fiscalYear" type="number" {...register("fiscalYear", { valueAsNumber: true })} />
              {errors.fiscalYear ? (
                <p className="text-destructive text-sm">{errors.fiscalYear.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fiscalPeriod">Period</Label>
              <Select
                value={watch("fiscalPeriod")}
                onValueChange={(value) =>
                  setValue("fiscalPeriod", value as RecordObservationInput["fiscalPeriod"])
                }
              >
                <SelectTrigger id="fiscalPeriod" className="w-full">
                  <SelectValue placeholder="Period" />
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
          <div className="space-y-2">
            <Label htmlFor="value">Value ({unit})</Label>
            <Input
              id="value"
              placeholder={unit === "TEXT" ? "Commentary…" : `e.g. 12500000000`}
              {...register("value")}
            />
            {errors.value ? <p className="text-destructive text-sm">{errors.value.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="source">Source (URL or citation)</Label>
            <Input id="source" placeholder="e.g. 10-Q filed 2026-06-15, MD&A" {...register("source")} />
          </div>
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
