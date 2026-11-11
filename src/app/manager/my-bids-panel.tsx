import type { MyBidsView } from "@/application/manager-bids";
import { messages } from "@/app/messages.fr";

import { CloseMercatoForm } from "./close-mercato-form";

const text = messages.catalogue;

const roundEnd = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** One line of a list: an athlete's name and an amount of credits, with an optional note. */
function Line({ name, amount, note }: { name: string; amount: number; note?: string }) {
  return (
    <li className="flex justify-between gap-3">
      <span className="min-w-0 break-words font-semibold">
        {name}
        {note && <span className="font-normal text-muted-foreground"> · {note}</span>}
      </span>
      <span className="shrink-0 font-mono font-bold tabular-nums">{text.price(amount)}</span>
    </li>
  );
}

/**
 * The budget, the credits spent on the athletes won, reserved by the bids and left; when the open
 * round ends; then the athletes won and the player's own bids (#422, #423). Once the mercato is
 * closed, a notice; to the last participant who can still recruit, the button that closes it
 * (#424).
 */
export function MyBidsPanel({ leagueId, bids }: { leagueId: string; bids: MyBidsView }) {
  const figures = [
    [text.budget, bids.budget],
    [text.spent, bids.spent],
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
      <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {figures.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-muted px-2 py-2">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </dt>
            <dd className="font-mono text-lg font-extrabold tabular-nums">{text.price(value)}</dd>
          </div>
        ))}
      </dl>
      {bids.mercatoClosed && (
        <p role="status" className="rounded-xl bg-muted p-3 text-sm font-semibold">
          {text.mercatoOver}
        </p>
      )}
      {bids.roundEndsAt && (
        <p className="text-sm font-semibold">
          {text.roundEnds(roundEnd.format(new Date(bids.roundEndsAt)))}
        </p>
      )}
      {bids.mercatoOpen && <p className="text-sm text-muted-foreground">{text.secret}</p>}
      <h3 id="my-team" className="text-sm font-bold">
        {text.myTeam}
      </h3>
      {bids.team.length === 0 ? (
        <p className="text-sm text-muted-foreground">{text.noTeam}</p>
      ) : (
        <ul aria-labelledby="my-team" className="flex flex-col gap-1 text-sm">
          {bids.team.map((a) => (
            <Line key={a.athleteId} name={a.name} amount={a.amount} note={text.wonIn(a.round)} />
          ))}
        </ul>
      )}
      <h3 id="my-bids" className="text-sm font-bold">
        {text.myBids}
      </h3>
      {bids.bids.length === 0 ? (
        <p className="text-sm text-muted-foreground">{text.noBids}</p>
      ) : (
        <ul aria-labelledby="my-bids" className="flex flex-col gap-1 text-sm">
          {bids.bids.map((b) => (
            <Line key={b.athleteId} name={b.name} amount={b.amount} />
          ))}
        </ul>
      )}
      {bids.canClose && <CloseMercatoForm leagueId={leagueId} />}
    </section>
  );
}
