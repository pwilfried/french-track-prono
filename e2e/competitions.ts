import { onPreprod, sql } from "../src/infra/contract/database";

/**
 * A coming competition of its own (SQL), with one 100 m locked in `days` days, for a test that
 * creates a league: a league is created only on a competition not finished (#614). Its event is
 * `${slug}-100m`. Returns its slug; delete it at the end with `deleteCompetition`.
 */
export function comingCompetition(slug: string, days = 340): string {
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${slug}', 'Test ${slug}', current_date + ${days}, current_date + ${days + 1})
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, '${slug}-100m', '100 m', 'F', now() + interval '${days} days',
           now() + interval '${days} days'
    from c`);
  return slug;
}

export function deleteCompetition(slug: string) {
  sql(`delete from competitions where slug = '${slug}'`);
}

/**
 * The competition the app follows by default. Locally and in the CI of a PR, COMPETITION_SLUG pins
 * the Ultimate Championship; pre-production pins nothing and also holds the demo set (#694, #830),
 * so it is the next one by date, as `nextCompetition` reads it (start day, then id).
 */
export function defaultCompetitionSlug(): string {
  if (!onPreprod()) return "ultimate-championship-2026";
  return sql(
    `select slug from competitions where ends_on >= (now() at time zone 'utc')::date
     order by starts_on, id limit 1`,
  );
}
