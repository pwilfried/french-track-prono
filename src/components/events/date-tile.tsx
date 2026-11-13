import { cn } from "@/lib/utils";

const day = (date: string) => String(Number(date.slice(8, 10)));
const month = (date: string) =>
  new Date(`${date}T12:00:00Z`)
    .toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" })
    .replace(".", "");

/** The first day of a competition as a small tile: the day, then the month (« 25 / juin »). */
export function DateTile({ date, className }: { date: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-soft leading-none text-brand-ink",
        className,
      )}
    >
      <span className="font-display text-lg font-extrabold tabular-nums">{day(date)}</span>
      <span className="text-[11px] font-bold uppercase">{month(date)}</span>
    </span>
  );
}
