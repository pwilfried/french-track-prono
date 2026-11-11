import type { MyBidsView } from "@/application/manager-bids";
import { messages } from "@/app/messages.fr";

const text = messages.catalogue;

/** The budget, the credits the bids reserve and those left, then the player's own bids (#422). */
export function MyBidsPanel({ bids }: { bids: MyBidsView }) {
  const figures = [
    [text.budget, bids.budget],
    [text.reserved, bids.reserved],
    [text.left, bids.available],
  ] as const;
  return (
    <section
      aria-labelledby="my-budget"
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-3.5"
    >
      <h2
        id="my-budget"
        className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
      >
        {text.budgetTitle}
      </h2>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {figures.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-muted px-2 py-2">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </dt>
            <dd className="font-mono text-lg font-extrabold tabular-nums">{text.price(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">{text.secret}</p>
      <h3 id="my-bids" className="text-sm font-bold">
        {text.myBids}
      </h3>
      {bids.bids.length === 0 ? (
        <p className="text-sm text-muted-foreground">{text.noBids}</p>
      ) : (
        <ul aria-labelledby="my-bids" className="flex flex-col gap-1 text-sm">
          {bids.bids.map((b) => (
            <li key={b.athleteId} className="flex justify-between gap-3">
              <span className="min-w-0 break-words font-semibold">{b.name}</span>
              <span className="shrink-0 font-mono font-bold tabular-nums">
                {text.price(b.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
