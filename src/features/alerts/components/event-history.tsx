import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AlertEventSummary } from "@/features/alerts/server/queries";

export function EventHistory({ events }: { events: AlertEventSummary[] }) {
  if (events.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.map((event) => (
          <div key={event.id} className="flex items-center justify-between gap-4 text-sm">
            <span>{event.message}</span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {new Date(event.firedAt).toLocaleString()}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
