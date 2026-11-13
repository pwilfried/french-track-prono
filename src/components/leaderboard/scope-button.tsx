import { messages } from "@/app/messages.fr";
import { cn } from "@/lib/utils";

const text = messages.ranking.scope;

/**
 * The scope of the rankings tab (#661), under the views: « Ligue · <nom> · N joueurs » or
 * « Portée · Toute la saison » (or a competition), with « Changer », which opens the scope sheet.
 * Without `onChange` it is a plain card (nothing else to choose).
 */
export function ScopeButton({
  label,
  value,
  detail,
  onChange,
  expanded = false,
  status = "ready",
}: {
  label: string;
  value: string;
  detail?: string;
  onChange?: () => void;
  expanded?: boolean;
  status?: "ready" | "loading" | "error";
}) {
  if (status === "loading") {
    return (
      <div
        role="status"
        aria-label={text.loading}
        className="h-[66px] animate-pulse rounded-card bg-muted motion-reduce:animate-none"
      />
    );
  }
  if (status === "error") {
    return (
      <p role="alert" className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
        {text.error}
      </p>
    );
  }
  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-card border border-border bg-card p-3",
        onChange && "relative",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="font-bold leading-tight [overflow-wrap:anywhere]">
          {value}
          {detail && <span className="font-semibold text-muted-foreground"> · {detail}</span>}
        </span>
      </span>
      {onChange && (
        <button
          type="button"
          onClick={onChange}
          aria-haspopup="dialog"
          aria-expanded={expanded}
          aria-label={text.changeLabel(value)}
          className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-bold text-brand-ink after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {text.change} ›
        </button>
      )}
    </div>
  );
}
