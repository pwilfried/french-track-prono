import { messages } from "@/app/messages.fr";
import type { SeasonStats } from "@/domain/player-season";

const text = messages.profile;
const eventName = (line: { discipline: string; gender: "F" | "M" | "X" }) =>
  `${line.discipline} ${messages.events.gender[line.gender].toLowerCase()}`;
const heading = "text-xs font-bold uppercase tracking-wider text-muted-foreground";

/** « Mes stats »: six figures of the season (#384). */
export function SeasonTiles({ stats }: { stats: SeasonStats }) {
  const tiles = [
    [String(stats.predictions), text.stat.predictions],
    [String(stats.perfectPodiums), text.stat.perfect],
    [String(stats.winners), text.stat.winners],
    [`${stats.successRate} %`, text.stat.success],
    [String(stats.bestStreak), text.stat.streak],
    [stats.jokerPlayed ? text.jokerYes : text.jokerNo, text.stat.joker],
  ];
  return (
    <section aria-labelledby="my-stats" className="flex flex-col gap-2">
      <h2 id="my-stats" className={heading}>
        {text.myStats}
      </h2>
      <dl className="grid grid-cols-3 gap-2">
        {tiles.map(([value, label]) => (
          <div
            key={label}
            className="flex flex-col items-center gap-0.5 rounded-card border border-border bg-card px-2 py-3 text-center"
          >
            <dd className="font-mono text-2xl font-bold tabular-nums">{value}</dd>
            <dt className="text-[11px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">
              {label}
            </dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** « Ma saison »: the cumulative points, one step per computed event. */
export function SeasonCurve({ curve }: { curve: number[] }) {
  const total = curve.at(-1) ?? 0;
  const top = Math.max(1, total);
  const points = [0, ...curve].map((value, i, all) => {
    const x = all.length === 1 ? 0 : (i / (all.length - 1)) * 350;
    const y = 115 - (value / top) * 105;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return (
    <section
      aria-labelledby="my-season"
      className="flex flex-col gap-2 rounded-card bg-brand-ink p-4 text-brand-foreground dark:bg-card dark:text-foreground"
    >
      <h2 id="my-season" className="font-display text-lg font-extrabold">
        {text.mySeason}
      </h2>
      {curve.length === 0 ? (
        <p className="text-sm opacity-80">{text.curveEmpty}</p>
      ) : (
        <svg
          role="img"
          aria-label={text.curve(curve.length, total)}
          viewBox="0 0 350 120"
          preserveAspectRatio="none"
          className="h-28 w-full"
        >
          <path
            d={`M${points.join(" L")} L350 120 L0 120 Z`}
            className="fill-secondary"
            opacity="0.15"
          />
          <path
            d={`M${points.join(" L")}`}
            fill="none"
            strokeWidth="3"
            strokeLinejoin="round"
            className="stroke-secondary"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </section>
  );
}

/** « Mon meilleur coup »: the prediction that gave the most points. */
export function BestShot({ best }: { best: SeasonStats["bestShot"] }) {
  return (
    <section
      aria-labelledby="best-shot"
      className="flex flex-col gap-1 rounded-card border border-border bg-card p-4"
    >
      <h2 id="best-shot" className={heading}>
        {text.bestShot}
      </h2>
      {best ? (
        <>
          <p className="font-display text-lg font-extrabold">
            {best.perfect ? text.bestPerfect(eventName(best)) : text.bestEvent(eventName(best))}
          </p>
          <p className="text-sm text-muted-foreground">
            {best.odds ? `${text.bestOdds(best.odds.toFixed(2).replace(".", ","))} · ` : ""}
            <strong className="font-mono text-success-text">{text.bestPoints(best.points)}</strong>
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{text.noBestShot}</p>
      )}
    </section>
  );
}

/** « Mes disciplines fortes »: success by family, the best three. */
export function StrongFamilies({ families }: { families: SeasonStats["families"] }) {
  return (
    <section aria-labelledby="strong" className="flex flex-col gap-2">
      <h2 id="strong" className={heading}>
        {text.strong}
      </h2>
      {families.length === 0 ? (
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.noStrong}</p>
      ) : (
        <ul className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-4">
          {families.map((f) => (
            <li key={f.family} className="flex flex-col gap-1">
              <span className="flex justify-between text-sm">
                <span>{messages.disciplines.family[f.family]}</span>
                <strong className="font-mono">{f.rate} %</strong>
              </span>
              <span aria-hidden="true" className="h-2 rounded-full bg-muted">
                <span
                  className="block h-2 rounded-full bg-brand dark:bg-secondary"
                  style={{ width: `${f.rate}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
