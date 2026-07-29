import { Badge } from "@/components/ui/badge";
import type { NewsItem } from "@/shared/contracts/market-data-provider";
import { formatRelativeTime } from "@/features/news/lib/format-relative-time";

export function NewsList({ items }: { items: NewsItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="border-border hover:bg-accent block rounded-lg border p-4 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium">{item.headline}</p>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{item.summary}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline">{item.source}</Badge>
                <span className="text-muted-foreground text-xs">{formatRelativeTime(item.publishedAt)}</span>
              </div>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
