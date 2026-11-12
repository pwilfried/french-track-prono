import type { MyBidsView } from "@/application/manager-bids";
import { messages } from "@/app/messages.fr";
import { CountdownBadge } from "@/components/countdown/countdown-badge";
import { ChipStatus } from "@/components/ui/chip-status";

import { CloseMercatoForm } from "./close-mercato-form";

const text = messages.catalogue;

/** One line of a list: an athlete's name and an amount of credits, with an optional note. */
function Line({ name, amount, note }: { name: string; amount: number; note?: string }) {
  return (
    <li className="flex justify-between gap-3 py-1.5">
      <span className="min-w-0 break-words font-semibold">
        {name}
        {note && <span className="font-normal text-muted-foreground"> · {note}</span>}
      </span>
      <span className="shrink-0 font-mono font-bold tabular-nums">{text.price(amount)}</span>
    </li>
  );
}

/** A titled list of the panel (athletes won, bids), with its count and its empty line. */
function Group({
  id,
  title,
  empty,
  lines,
}: {
  id: string;
  title: string;
  empty: string;
  lines: { athleteId: string; name: string; amount: number; note?: string }[];
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <h3 id={id} className="text-sm font-bold">
          {title}
        </h3>
        <ChipStatus>{lines.length}</ChipStatus>
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul aria-labelledby={id} className="flex flex-col divide-y divide-border text-sm">
          {lines.map((l) => (
            <Line key={l.athleteId} name={l.name} amount={l.amount} note={l.note} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** A label and its amount; the label and the figure stay side by side in the text (« Réservé40 cr. »). */
function Figure({ label, value, dot }: { label: string; value: number; dot?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {dot && <span aria-hidden className={`size-2.5 rounded-full ${dot}`} />}
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono font-bold tabular-nums">{text.price(value)}</dd>
    </div>
  );
}

const share = (part: number, whole: number) => `${whole > 0 ? (100 * part) / whole : 0}%`;

/**
 * What the player can still bid, big, with a bar of the budget split into spent, reserved and
 * left; the time left in the round; then the athletes won and the bids (#422, #423, #503). Once
 * the mercato is closed, a notice; to the last participant who can still recruit, the button that
 * closes it (#424).
 */
export function MyBidsPanel({ leagueId, bids }: { leagueId: string; bids: MyBidsView }) {
  return (
    <section
      aria-labelledby="my-budget"
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="my-budget"
          className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
        >
          {text.budgetTitle}
        </h2>
        {bids.roundEndsAt && (
          <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            {text.roundEndsIn}
            <CountdownBadge lockAt={bids.roundEndsAt} compact />
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <dl className="flex flex-col">
          <dt className="text-sm font-semibold text-muted-foreground">{text.left}</dt>
          <dd className="font-mono text-3xl font-extrabold leading-tight tabular-nums">
            {text.price(bids.available)}
          </dd>
        </dl>
        <div aria-hidden className="flex h-2.5 overflow-hidden rounded-full bg-success">
          <span className="bg-secondary" style={{ width: share(bids.spent, bids.budget) }} />
          <span className="bg-primary" style={{ width: share(bids.reserved, bids.budget) }} />
        </div>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Figure label={text.spent} value={bids.spent} dot="bg-secondary" />
          <Figure label={text.reserved} value={bids.reserved} dot="bg-primary" />
          <Figure label={text.budget} value={bids.budget} />
        </dl>
      </div>
      {bids.mercatoClosed && (
        <p role="status" className="rounded-xl bg-muted p-3 text-sm font-semibold">
          {text.mercatoOver}
        </p>
      )}
      {bids.mercatoOpen && (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <span aria-hidden>🔒</span>
          {text.secret}
        </p>
      )}
      <Group
        id="my-team"
        title={text.myTeam}
        empty={text.noTeam}
        lines={bids.team.map((a) => ({ ...a, note: text.wonIn(a.round) }))}
      />
      <Group id="my-bids" title={text.myBids} empty={text.noBids} lines={bids.bids} />
      {bids.canClose && <CloseMercatoForm leagueId={leagueId} />}
    </section>
  );
}
