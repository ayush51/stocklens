import { Badge } from "@/components/ui/badge";
import type { NewsItem } from "@/shared/contracts/market-data-provider";
import { formatRelativeTime } from "@/features/news/lib/format-relative-time";
import { NewsImpactPanel } from "@/features/news/components/news-impact-panel";

export function NewsList({
  items,
  companyId,
  ticker,
  companyName,
}: {
  items: NewsItem[];
  companyId: string;
  ticker: string;
  companyName: string;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="border-border rounded-lg border p-4">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-accent -m-1 block rounded-md p-1 transition-colors"
          >
            <p className="font-medium">{item.headline}</p>
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{item.summary}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline">{item.source}</Badge>
              <span className="text-muted-foreground text-xs">{formatRelativeTime(item.publishedAt)}</span>
            </div>
          </a>
          <NewsImpactPanel
            companyId={companyId}
            ticker={ticker}
            companyName={companyName}
            headline={item.headline}
            summary={item.summary}
          />
        </div>
      ))}
    </div>
  );
}
