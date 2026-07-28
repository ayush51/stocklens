"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createDecisionEntry } from "@/features/decision-journal/server/actions";
import {
  ADD_LIKE_ACTIONS,
  CONFIDENCE_LEVELS,
  DECISION_ACTIONS,
  DECISION_EMOTIONS,
  decisionEntrySchema,
  type DecisionEntryInput,
} from "@/features/decision-journal/validation/entry";

const today = new Date().toISOString().slice(0, 10);

function CheckboxField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5"
        checked={value ?? false}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function DecisionEntryForm({ defaultTicker }: { defaultTicker?: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DecisionEntryInput>({
    resolver: zodResolver(decisionEntrySchema),
    defaultValues: {
      ticker: defaultTicker ?? "",
      decisionDate: today,
      action: "HOLD",
      proposedAmount: "",
      evidenceSupporting: "",
      evidenceOpposing: "",
      thesisImpact: "",
      positionSizeImpact: "",
      taxConsiderationNotes: "",
      whatWouldChangeDecision: "",
      newEvidenceForPurchase: "",
      evidenceThatWouldProveWrong: "",
      reviewDate: "",
    },
  });

  const action = watch("action");
  const showChecklist = ADD_LIKE_ACTIONS.has(action);

  async function onSubmit(data: DecisionEntryInput) {
    try {
      await createDecisionEntry(data);
      toast.success("Decision recorded");
      reset();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this entry.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>New decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker</Label>
              <Input id="ticker" placeholder="e.g. NVDA" {...register("ticker")} />
              {errors.ticker ? <p className="text-destructive text-sm">{errors.ticker.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="decisionDate">Date</Label>
              <Input id="decisionDate" type="date" {...register("decisionDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action">Action being considered</Label>
              <Select
                value={action}
                onValueChange={(value) => setValue("action", value as DecisionEntryInput["action"])}
              >
                <SelectTrigger id="action" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECISION_ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="proposedAmount">Proposed amount ($)</Label>
              <Input id="proposedAmount" placeholder="e.g. 2000" {...register("proposedAmount")} />
              {errors.proposedAmount ? (
                <p className="text-destructive text-sm">{errors.proposedAmount.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentEmotion">Current emotion</Label>
              <Select
                value={watch("currentEmotion")}
                onValueChange={(value) =>
                  setValue("currentEmotion", value as DecisionEntryInput["currentEmotion"])
                }
              >
                <SelectTrigger id="currentEmotion" className="w-full">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {DECISION_EMOTIONS.map((emotion) => (
                    <SelectItem key={emotion} value={emotion}>
                      {emotion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confidence">Confidence</Label>
              <Select
                value={watch("confidence")}
                onValueChange={(value) => setValue("confidence", value as DecisionEntryInput["confidence"])}
              >
                <SelectTrigger id="confidence" className="w-full">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {CONFIDENCE_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="evidenceSupporting">Evidence supporting</Label>
              <Textarea id="evidenceSupporting" rows={2} {...register("evidenceSupporting")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidenceOpposing">Evidence opposing</Label>
              <Textarea id="evidenceOpposing" rows={2} {...register("evidenceOpposing")} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="thesisImpact">Thesis impact</Label>
              <Textarea id="thesisImpact" rows={2} {...register("thesisImpact")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="positionSizeImpact">Position-size impact</Label>
              <Textarea id="positionSizeImpact" rows={2} {...register("positionSizeImpact")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxConsiderationNotes">Tax consideration notes</Label>
            <Textarea id="taxConsiderationNotes" rows={2} {...register("taxConsiderationNotes")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatWouldChangeDecision">What would change this decision?</Label>
            <Textarea id="whatWouldChangeDecision" rows={2} {...register("whatWouldChangeDecision")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reviewDate">Review date</Label>
            <Input id="reviewDate" type="date" {...register("reviewDate")} />
          </div>
        </CardContent>
      </Card>

      {showChecklist ? (
        <Card>
          <CardHeader>
            <CardTitle>Before you add — answer honestly</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CheckboxField
              id="wouldBuyIfOwnedNone"
              label="Would I buy this security today if I owned none?"
              value={watch("wouldBuyIfOwnedNone")}
              onChange={(v) => setValue("wouldBuyIfOwnedNone", v)}
            />
            <CheckboxField
              id="buyingBecauseThesisImprovedNotPriceDrop"
              label="Am I buying because the thesis improved — not merely because the price fell?"
              value={watch("buyingBecauseThesisImprovedNotPriceDrop")}
              onChange={(v) => setValue("buyingBecauseThesisImprovedNotPriceDrop", v)}
            />
            <CheckboxField
              id="belowAllocationCeiling"
              label="Is the position below my allocation ceiling?"
              value={watch("belowAllocationCeiling")}
              onChange={(v) => setValue("belowAllocationCeiling", v)}
            />
            <CheckboxField
              id="portfolioAdequatelyDiversified"
              label="Is the portfolio adequately diversified?"
              value={watch("portfolioAdequatelyDiversified")}
              onChange={(v) => setValue("portfolioAdequatelyDiversified", v)}
            />
            <div className="space-y-2">
              <Label htmlFor="newEvidenceForPurchase">What new evidence supports the purchase?</Label>
              <Textarea id="newEvidenceForPurchase" rows={2} {...register("newEvidenceForPurchase")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidenceThatWouldProveWrong">What evidence could prove me wrong?</Label>
              <Textarea
                id="evidenceThatWouldProveWrong"
                rows={2}
                {...register("evidenceThatWouldProveWrong")}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Record decision"}
        </Button>
      </div>
    </form>
  );
}
