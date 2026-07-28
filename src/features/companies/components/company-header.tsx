import { Badge } from "@/components/ui/badge";

export function CompanyHeader({
  company,
}: {
  company: { ticker: string; name: string; exchange: string | null; sector: string | null };
}) {
  return (
    <div className="flex flex-col gap-2 border-b pb-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
        <Badge variant="secondary">{company.ticker}</Badge>
      </div>
      <p className="text-muted-foreground text-sm">
        {[company.exchange, company.sector].filter(Boolean).join(" · ") || "No exchange/sector data yet"}
      </p>
    </div>
  );
}
