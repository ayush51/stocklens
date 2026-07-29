"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { deleteAlertRule, toggleAlertRule } from "@/features/alerts/server/actions";
import type { AlertRuleSummary } from "@/features/alerts/server/queries";

const TYPE_LABEL: Record<string, string> = {
  PRICE_ABOVE: "Price above",
  PRICE_BELOW: "Price below",
  UPCOMING_EARNINGS: "Earnings within",
  THESIS_STALE: "Thesis review overdue",
  NEW_FILING: "New filing",
};

function describeRule(rule: AlertRuleSummary): string {
  if (rule.type === "PRICE_ABOVE" || rule.type === "PRICE_BELOW") {
    return `$${rule.config.threshold}`;
  }
  if (rule.type === "UPCOMING_EARNINGS") {
    return `${rule.config.daysBefore} days`;
  }
  return "";
}

export function RuleList({ rules }: { rules: AlertRuleSummary[] }) {
  const [pending, setPending] = useState<string | null>(null);

  async function handleToggle(rule: AlertRuleSummary) {
    setPending(rule.id);
    try {
      await toggleAlertRule(rule.id, !rule.active);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update rule.");
    } finally {
      setPending(null);
    }
  }

  async function handleDelete(rule: AlertRuleSummary) {
    setPending(rule.id);
    try {
      await deleteAlertRule(rule.id);
      toast.success("Alert rule deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete rule.");
    } finally {
      setPending(null);
    }
  }

  if (rules.length === 0) {
    return <p className="text-muted-foreground text-sm">No alert rules yet — create one above.</p>;
  }

  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <Card key={rule.id}>
          <CardContent className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              <Switch
                checked={rule.active}
                disabled={pending === rule.id}
                onCheckedChange={() => handleToggle(rule)}
              />
              {rule.ticker ? <span className="font-medium">{rule.ticker}</span> : null}
              <Badge variant="outline">{TYPE_LABEL[rule.type] ?? rule.type}</Badge>
              <span className="text-muted-foreground text-sm">{describeRule(rule)}</span>
              {!rule.active ? <Badge variant="outline">paused</Badge> : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending === rule.id}
              onClick={() => handleDelete(rule)}
            >
              Delete
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
