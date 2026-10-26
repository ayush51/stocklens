import type { LucideIcon } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="border-border flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
      {Icon ? (
        <div className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-full">
          <Icon className="size-6" aria-hidden="true" />
        </div>
      ) : null}
      <p className="font-medium">{title}</p>
      {description ? <p className="text-muted-foreground max-w-sm text-sm">{description}</p> : null}
      {action}
    </div>
  );
}
