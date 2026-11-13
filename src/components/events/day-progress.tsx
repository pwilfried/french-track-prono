import { messages } from "@/app/messages.fr";

const text = messages.competitions.progress;

/**
 * Where the player stands, on one line (#659): the events left to predict on the day shown, the
 * podiums posed in the whole competition, the points won.
 */
export function DayProgress({
  todo,
  posed,
  total,
  points,
}: {
  todo: number;
  posed: number;
  total: number;
  points: number;
}) {
  const items = [
    { short: text.todo(todo), label: text.todoLabel(todo), strong: todo > 0 },
    { short: text.posed(posed, total), label: text.posedLabel(posed, total), strong: false },
    { short: text.points(points), label: text.pointsLabel(points), strong: false },
  ];
  return (
    <section
      aria-label={text.label}
      className="flex items-center justify-between gap-2 rounded-card bg-brand px-3 py-2.5 text-sm text-brand-foreground"
    >
      {items.map((item, i) => (
        <p
          key={i}
          className={`whitespace-nowrap font-mono tabular-nums ${item.strong ? "font-extrabold" : "font-semibold"}`}
        >
          <span aria-hidden="true">{item.short}</span>
          <span className="sr-only">{item.label}</span>
        </p>
      ))}
    </section>
  );
}
