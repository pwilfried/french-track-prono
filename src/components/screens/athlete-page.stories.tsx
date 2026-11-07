import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AthleteHero } from "../athletes/athlete-hero";

/**
 * Composed screen for /athletes/[slug] (v0.5, issue #B2). Visual only: records and
 * recent races are inlined here; they will come from the athletes domain + reader
 * once the route is wired. Each occurrence of an athlete name on other screens
 * (startlist, podium, prediction form) links to this page.
 */
const meta: Meta = {
  title: "Screens/AthletePage",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

type Perf = { discipline: string; pr: string; prYear: string; sb: string; sbYear: string };
type Race = {
  month: string;
  day: string;
  title: string;
  context: string;
  rank: string;
  mark: string;
};

function PerfCard({ perf }: { perf: Perf }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-muted p-3">
      <div className="font-display text-[13px] font-bold tracking-tight text-foreground">
        {perf.discipline}
      </div>
      <div className="flex gap-3">
        {(
          [
            ["PR", perf.pr, perf.prYear],
            ["SB", perf.sb, perf.sbYear],
          ] as const
        ).map(([label, value, year]) => (
          <div key={label} className="flex min-w-0 flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </span>
            <span className="font-mono text-[15px] font-bold leading-tight tabular-nums text-foreground">
              {value}
            </span>
            <span className="font-mono text-[10.5px] text-muted-foreground">{year}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RaceRow({ race }: { race: Race }) {
  const isWin = race.rank.startsWith("1");
  return (
    <li className="grid grid-cols-[42px_1fr_auto] items-center gap-2.5 rounded-xl bg-muted p-2.5">
      <div className="flex flex-col items-center gap-0.5 text-center font-mono text-[11px] font-bold text-muted-foreground tabular-nums">
        <span>{race.month}</span>
        <span className="text-sm text-foreground">{race.day}</span>
      </div>
      <div className="min-w-0">
        <div className="font-display text-[13px] font-bold leading-tight tracking-tight text-foreground">
          {race.title}
        </div>
        <div className="text-[11px] text-muted-foreground">{race.context}</div>
      </div>
      <div className="flex flex-col items-end">
        <span
          className={
            isWin
              ? "rounded-md bg-gold-soft px-2 py-0.5 font-display text-[15px] font-extrabold text-gold-ink"
              : "font-display text-[15px] font-extrabold text-brand"
          }
          dangerouslySetInnerHTML={{ __html: race.rank }}
        />
        <span className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-foreground/70">
          {race.mark}
        </span>
      </div>
    </li>
  );
}

const richardsonPerfs: Perf[] = [
  { discipline: "100 m", pr: "10.65", prYear: "2023", sb: "10.72", sbYear: "2026" },
  { discipline: "200 m", pr: "21.92", prYear: "2023", sb: "22.14", sbYear: "2026" },
];

const richardsonRaces: Race[] = [
  {
    month: "SEPT",
    day: "11",
    title: "100 m — Ultimate",
    context: "Budapest · Finale",
    rank: "1<sup>er</sup>",
    mark: "10.78",
  },
  {
    month: "AOÛT",
    day: "29",
    title: "100 m — DL",
    context: "Zurich · Finale",
    rank: "2<sup>e</sup>",
    mark: "10.84",
  },
  {
    month: "AOÛT",
    day: "16",
    title: "200 m — DL",
    context: "Silésie · Finale",
    rank: "3<sup>e</sup>",
    mark: "22.18",
  },
  {
    month: "JUIL",
    day: "11",
    title: "100 m — DL",
    context: "Monaco · Finale",
    rank: "1<sup>er</sup>",
    mark: "10.72",
  },
];

function AthletePage({
  name,
  flag,
  country,
  gender,
  avatar,
  perfs,
  races,
}: {
  name: string;
  flag: string;
  country: string;
  gender: "F" | "M" | "X";
  avatar: string;
  perfs: Perf[];
  races: Race[];
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <button className="text-sm font-semibold text-brand">← Startlist</button>
        <div className="size-9" />
      </header>
      <AthleteHero name={name} flag={flag} country={country} gender={gender} avatar={avatar} />
      <h2 className="mt-3 px-4 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Records par discipline
      </h2>
      <section className="grid grid-cols-2 gap-2 px-4 pt-2">
        {perfs.map((p) => (
          <PerfCard key={p.discipline} perf={p} />
        ))}
      </section>
      <h2 className="mt-4 px-4 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Dernières courses
      </h2>
      <ul className="flex flex-col gap-2 px-4 py-2">
        {races.map((r) => (
          <RaceRow key={r.day + r.title} race={r} />
        ))}
      </ul>
    </div>
  );
}

export const Richardson: Story = {
  render: () => (
    <AthletePage
      name="Sha'Carri Richardson"
      flag="🇺🇸"
      country="États-Unis"
      gender="F"
      avatar="🏃‍♀️"
      perfs={richardsonPerfs}
      races={richardsonRaces}
    />
  ),
};

/** Minimal: a newcomer with only a season best, no personal history. */
export const Newcomer: Story = {
  render: () => (
    <AthletePage
      name="Jade Diop"
      flag="🇫🇷"
      country="France"
      gender="F"
      avatar="🏃"
      perfs={[{ discipline: "400 m", pr: "52.14", prYear: "2026", sb: "52.14", sbYear: "2026" }]}
      races={[
        {
          month: "AOÛT",
          day: "03",
          title: "400 m — Mtgs",
          context: "Monaco · Finale",
          rank: "6<sup>e</sup>",
          mark: "52.14",
        },
      ]}
    />
  ),
};
