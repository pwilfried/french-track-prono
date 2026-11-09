import Link from "next/link";

import { getAdminTodo, type AdminTodo } from "@/application/admin-todo";
import {
  createPublicSupabaseClient,
  createSupabaseClubAdminRepository,
  createSupabaseEventReader,
  createSupabaseLeagueModerationRepository,
  createSupabasePointsRepository,
} from "@/infra";
import { cn } from "@/lib/utils";

import { currentCompetition } from "../../competition";
import { messages } from "../../messages.fr";
import { getSessionClient } from "../../session";

const text = messages.adminCompetitions;

export type AdminSection = keyof typeof text.section;

/** The sections of the back-office, in three groups, plus the history at the end. */
const GROUPS: { key: keyof typeof text.groups | null; items: [string, AdminSection][] }[] = [
  {
    key: "game",
    items: [
      ["/admin/competitions", "competitions"],
      ["/admin", "results"],
      ["/admin/bareme", "scale"],
    ],
  },
  {
    key: "data",
    items: [
      ["/admin/athletes", "athletes"],
      ["/admin/disciplines", "disciplines"],
      ["/admin/clubs", "clubs"],
    ],
  },
  {
    key: "community",
    items: [
      ["/admin/joueurs", "players"],
      ["/admin/ligues", "leagues"],
    ],
  },
  { key: null, items: [["/admin/historique", "history"]] },
];

const COUNTED: Partial<Record<AdminSection, keyof AdminTodo>> = {
  results: "results",
  clubs: "clubs",
  leagues: "leagues",
};

function Links({ section, todo }: { section: AdminSection; todo: AdminTodo | null }) {
  return GROUPS.map((group) => (
    <div
      key={group.key ?? "other"}
      className={cn("flex flex-col gap-1", !group.key && "mt-2 border-t border-border pt-2")}
    >
      {group.key && (
        <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {text.groups[group.key]}
        </p>
      )}
      {group.items.map(([href, key]) => {
        const field = COUNTED[key];
        const count = field && todo ? todo[field] : null;
        const current = key === section;
        return (
          <Link
            key={key}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 font-semibold",
              current ? "bg-brand text-brand-foreground" : "text-foreground hover:bg-brand-soft",
            )}
          >
            <span>
              {text.section[key]}
              {count ? <span className="sr-only">{text.todo(count)}</span> : null}
            </span>
            {count ? (
              <span
                aria-hidden="true"
                className="rounded-full bg-primary px-2 py-0.5 font-mono text-xs font-bold text-primary-foreground"
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  ));
}

/**
 * The back-office menu: a side column on a computer, a drop-down on a phone (no script needed).
 * The counters say what waits in Résultats, Clubs and Ligues.
 */
export function AdminMenu({ section, todo }: { section: AdminSection; todo: AdminTodo | null }) {
  return (
    <>
      <nav
        aria-label={text.sections}
        className="hidden w-60 shrink-0 flex-col border-r border-border px-3 py-6 lg:flex"
      >
        <Links section={section} todo={todo} />
      </nav>
      <nav aria-label={text.sections} className="px-4 pt-4 lg:hidden">
        {/* A new key on each section closes the drop-down after a navigation. */}
        <details key={section} className="group rounded-2xl border-2 border-border bg-card">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-bold [&::-webkit-details-marker]:hidden">
            {text.section[section]}
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <div className="flex flex-col gap-1 px-2 pb-3">
            <Links section={section} todo={todo} />
          </div>
        </details>
      </nav>
    </>
  );
}

/** The menu with its counters, read with the admin's session. */
export async function AdminMenuWithTodo({ section }: { section: AdminSection }) {
  let todo: AdminTodo | null = null;
  try {
    const client = await getSessionClient();
    const competition = await currentCompetition();
    todo = await getAdminTodo({
      events: createSupabaseEventReader(createPublicSupabaseClient()),
      points: createSupabasePointsRepository(client),
      clubs: createSupabaseClubAdminRepository(client),
      moderation: createSupabaseLeagueModerationRepository(client),
    }).execute({ competitionSlug: competition.slug, now: new Date() });
  } catch {
    // The menu still works without its counters.
  }
  return <AdminMenu section={section} todo={todo} />;
}
