"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAlertRule } from "@/features/alerts/server/actions";
import { CREATABLE_ALERT_TYPES } from "@/features/alerts/validation/alert-rule";

const TYPE_LABEL: Record<(typeof CREATABLE_ALERT_TYPES)[number], string> = {
  PRICE_ABOVE: "Price rises above",
  PRICE_BELOW: "Price falls below",
  UPCOMING_EARNINGS: "Earnings coming up within",
  THESIS_STALE: "Thesis review is overdue",
};

export interface HeldCompanyOption {
  companyId: string;
  ticker: string;
  name: string;
  thesisId: string | null;
}

export function CreateRuleForm({ companies }: { companies: HeldCompanyOption[] }) {
  const [type, setType] = useState<(typeof CREATABLE_ALERT_TYPES)[number]>("PRICE_ABOVE");
  const [companyId, setCompanyId] = useState<string>(companies[0]?.companyId ?? "");
  const [threshold, setThreshold] = useState("");
  const [daysBefore, setDaysBefore] = useState("7");
  const [saving, setSaving] = useState(false);

  const companiesWithThesis = companies.filter((c) => c.thesisId);

  async function handleCreate() {
    setSaving(true);
    try {
      if (type === "THESIS_STALE") {
        const company = companiesWithThesis.find((c) => c.companyId === companyId) ?? companiesWithThesis[0];
        if (!company?.thesisId) {
          toast.error("No held company with a thesis to watch.");
          return;
        }
        await createAlertRule({ type, thesisId: company.thesisId });
      } else if (type === "UPCOMING_EARNINGS") {
        await createAlertRule({ type, companyId, daysBefore: Number(daysBefore) });
      } else {
        await createAlertRule({ type, companyId, threshold: Number(threshold) });
      }
      toast.success("Alert rule created");
      setThreshold("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create alert rule.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit =
    type === "THESIS_STALE"
      ? companiesWithThesis.length > 0
      : type === "UPCOMING_EARNINGS"
        ? !!companyId && !!daysBefore
        : !!companyId && !!threshold;

  return (
    <Card>
      <CardHeader>
        <CardTitle>New alert</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as (typeof CREATABLE_ALERT_TYPES)[number])}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CREATABLE_ALERT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {type === "THESIS_STALE" ? (
          <div className="space-y-2">
            <Label>Company (must have a thesis)</Label>
            <Select value={companyId} onValueChange={(v) => v && setCompanyId(v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companiesWithThesis.map((c) => (
                  <SelectItem key={c.companyId} value={c.companyId}>
                    {c.ticker}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Company</Label>
            <Select value={companyId} onValueChange={(v) => v && setCompanyId(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.companyId} value={c.companyId}>
                    {c.ticker}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {type === "PRICE_ABOVE" || type === "PRICE_BELOW" ? (
          <div className="space-y-2">
            <Label>Price ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-28"
            />
          </div>
        ) : null}

        {type === "UPCOMING_EARNINGS" ? (
          <div className="space-y-2">
            <Label>Days before</Label>
            <Input
              type="number"
              value={daysBefore}
              onChange={(e) => setDaysBefore(e.target.value)}
              className="w-24"
            />
          </div>
        ) : null}

        <Button onClick={handleCreate} disabled={saving || !canSubmit}>
          {saving ? "Creating…" : "Create alert"}
        </Button>
      </CardContent>
    </Card>
  );
}
