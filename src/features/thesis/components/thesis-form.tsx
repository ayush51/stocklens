"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { saveThesis, draftThesisWithAi } from "@/features/thesis/server/actions";
import {
  CONVICTION_LEVELS,
  THESIS_STATUSES,
  thesisFormSchema,
  type ThesisFormInput,
} from "@/features/thesis/validation/thesis";
import type { Thesis } from "@/generated/prisma/client";

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function ThesisForm({
  companyId,
  cik,
  companyName,
  ticker,
  existing,
}: {
  companyId: string;
  cik: string | null;
  companyName: string;
  ticker: string;
  existing?: Thesis | null;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ThesisFormInput>({
    resolver: zodResolver(thesisFormSchema),
    defaultValues: {
      companyId,
      ticker,
      title: existing?.title ?? "",
      summary: existing?.summary ?? "",
      whyMispriced: existing?.whyMispriced ?? "",
      expectedDrivers: existing?.expectedDrivers ?? "",
      risks: existing?.risks ?? "",
      keyAssumptions: existing?.keyAssumptions ?? "",
      timeHorizon: existing?.timeHorizon ?? "",
      valuationNotes: existing?.valuationNotes ?? "",
      positionSizingRationale: existing?.positionSizingRationale ?? "",
      reasonsToAdd: existing?.reasonsToAdd ?? "",
      reasonsToHold: existing?.reasonsToHold ?? "",
      reasonsToTrim: existing?.reasonsToTrim ?? "",
      reasonsToExit: existing?.reasonsToExit ?? "",
      invalidationConditions: existing?.invalidationConditions ?? "",
      nextReviewDate: toDateInputValue(existing?.nextReviewDate ?? null),
      sources: existing?.sources ?? [],
      conviction: existing?.conviction ?? "MEDIUM",
      targetPrice: existing?.targetPrice?.toString() ?? "",
      status: existing?.status ?? "ACTIVE",
    },
  });

  async function onSubmit(data: ThesisFormInput) {
    try {
      await saveThesis(data);
      toast.success(existing ? "Thesis updated" : "Thesis created");
      router.push(`/companies/${ticker}/thesis`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this thesis.");
    }
  }

  const [draftLoading, setDraftLoading] = useState(false);
  const [draftApplied, setDraftApplied] = useState(false);

  async function handleDraftWithAi() {
    setDraftLoading(true);
    try {
      const draft = await draftThesisWithAi(companyId, cik, ticker, companyName);
      setValue("summary", draft.summary);
      setValue("whyMispriced", draft.whyMispriced);
      setValue("expectedDrivers", draft.expectedDrivers);
      setValue("risks", draft.risks);
      setValue("keyAssumptions", draft.keyAssumptions);
      setDraftApplied(true);
      toast.success("Draft applied — review and edit every field before saving.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate a draft.");
    } finally {
      setDraftLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {!existing ? (
        <div className="border-border bg-muted/30 flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="text-sm">
            <p className="font-medium">Not sure where to start?</p>
            <p className="text-muted-foreground">
              Draft a skeleton from this company&apos;s real financial data — you review, edit, and decide
              everything before it saves.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDraftWithAi}
            disabled={draftLoading}
          >
            <SparklesIcon className="size-3.5" /> {draftLoading ? "Drafting…" : "Draft with AI"}
          </Button>
        </div>
      ) : null}
      {draftApplied ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Badge variant="outline">AI draft</Badge>
          <span>
            Summary, mispricing hypothesis, drivers, risks, and assumptions below are an unreviewed AI draft —
            read and edit each one before saving. Nothing is saved until you click Save.
          </span>
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} />
            {errors.title ? <p className="text-destructive text-sm">{errors.title.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary">Summary</Label>
            <Textarea id="summary" rows={3} {...register("summary")} />
            {errors.summary ? <p className="text-destructive text-sm">{errors.summary.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="whyMispriced">Why the market may be mispricing it</Label>
            <Textarea id="whyMispriced" rows={3} {...register("whyMispriced")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="conviction">Conviction</Label>
              <Select
                value={watch("conviction")}
                onValueChange={(value) => setValue("conviction", value as ThesisFormInput["conviction"])}
              >
                <SelectTrigger id="conviction" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONVICTION_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(value) => setValue("status", value as ThesisFormInput["status"])}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THESIS_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetPrice">Target price</Label>
              <Input id="targetPrice" placeholder="e.g. 220" {...register("targetPrice")} />
              {errors.targetPrice ? (
                <p className="text-destructive text-sm">{errors.targetPrice.message}</p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bull case</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="expectedDrivers">Expected business drivers</Label>
            <Textarea id="expectedDrivers" rows={3} {...register("expectedDrivers")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keyAssumptions">Key assumptions</Label>
            <Textarea id="keyAssumptions" rows={3} {...register("keyAssumptions")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="valuationNotes">Valuation notes</Label>
            <Textarea id="valuationNotes" rows={3} {...register("valuationNotes")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeHorizon">Time horizon</Label>
            <Input id="timeHorizon" placeholder="e.g. 12-24 months" {...register("timeHorizon")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risks & invalidation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="risks">Risks</Label>
            <Textarea id="risks" rows={3} {...register("risks")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invalidationConditions">Thesis invalidation conditions</Label>
            <Textarea id="invalidationConditions" rows={3} {...register("invalidationConditions")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Position management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="positionSizingRationale">Position-sizing rationale</Label>
            <Textarea id="positionSizingRationale" rows={2} {...register("positionSizingRationale")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reasonsToAdd">Reasons to add</Label>
              <Textarea id="reasonsToAdd" rows={2} {...register("reasonsToAdd")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reasonsToHold">Reasons to hold</Label>
              <Textarea id="reasonsToHold" rows={2} {...register("reasonsToHold")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reasonsToTrim">Reasons to trim</Label>
              <Textarea id="reasonsToTrim" rows={2} {...register("reasonsToTrim")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reasonsToExit">Reasons to exit</Label>
              <Textarea id="reasonsToExit" rows={2} {...register("reasonsToExit")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nextReviewDate">Next review date</Label>
            <Input id="nextReviewDate" type="date" {...register("nextReviewDate")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sourcesText">Sources (one per line)</Label>
            <Textarea
              id="sourcesText"
              rows={3}
              defaultValue={(existing?.sources ?? []).join("\n")}
              onChange={(e) =>
                setValue(
                  "sources",
                  e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : existing ? "Save changes" : "Create thesis"}
        </Button>
      </div>
    </form>
  );
}
