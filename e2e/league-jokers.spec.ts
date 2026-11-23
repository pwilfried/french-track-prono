import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { addFriendTo, newPlayer, signUp } from "./players";

test("a joker played on a podium of a league counts in that league only, and shows in « Mes jokers » (#1090)", async ({
  page,
}) => {
  // A competition of its own with two open finals, the same start list.
  const tag = `e2e-${Date.now() % 1000000}`;
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${tag}', 'Test jokers ${tag}', current_date + 5, current_date + 6) returning id
    ), e as (
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select id, '${tag}-' || d.slug, d.name, 'F', now() + d.days, now() + d.days
      from c, (values ('100m', '100 m', interval '5 days'),
                      ('200m', '200 m', interval '6 days')) as d(slug, name, days)
      returning id
    )
    insert into entries (event_id, athlete_id)
    select e.id, a.id from e, (select id from athletes where gender = 'F' order by name limit 4) a`);
  const event = `/epreuves/${tag}-100m`;
  const player = newPlayer("jokers");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(event);
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(new RegExp(`${event}$`));

  // A league of the player counting the competition, with a friend: its ranking shows.
  const league = `Jokers ${tag}`;
  const leagueId = sql(`with u as (select id from auth.users where email = '${player.email}'),
      l as (insert into leagues (name, owner_id) select '${league}', id from u returning id, owner_id),
      m as (insert into league_members (league_id, user_id, role) select id, owner_id, 'owner' from l),
      c as (insert into league_competitions (league_id, competition_id)
            select l.id, c.id from l, competitions c where c.slug = '${tag}')
      select id from l`);
  const friend = addFriendTo(`/ligues/${leagueId}`, tag);

  try {
    // The podium, saved and added to the league from the sheet.
    await page.reload();
    const athletes = page.locator("li > button[aria-pressed]");
    for (const index of [0, 1, 2]) await athletes.nth(index).click();
    await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
    const sheet = page.getByRole("dialog", { name: "Ajouter ce prono à mes ligues" });
    // A single league: a plain question, no list; the jokers follow without another tap.
    await sheet.getByRole("button", { name: `Ajouter à « ${league} »` }).click();
    await expect(sheet).toBeHidden();

    // Under the podium, one block: the league is on, its hand of cards. The Double is put down.
    const jokers = page.getByRole("region", { name: "🃏 Sors tes jokers" });
    await expect(jokers).toBeVisible();
    const double = jokers.getByRole("button", { name: /Double/ });
    await double.click();
    await expect(double).toHaveAttribute("aria-pressed", "true");
    await expect(jokers.getByText("Double posé !")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /Double/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Switching the league off asks first, and gives the card back; the league shows no card.
    const toggle = page.getByRole("switch", { name: `Compter ce prono dans ${league}` });
    await jokers.getByText(league, { exact: true }).click();
    await expect(page.getByText("🔥 Ton Double est posé ici.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "↩️ Reprendre la carte" }).click();
    await expect(toggle).not.toBeChecked();
    await expect(page.getByRole("button", { name: /Double/ })).toHaveCount(0);
    await expect(jokers.getByText(/Ligue éteinte/)).toBeVisible();

    // On again, the Double is back in the hand: put it down for the points.
    await jokers.getByText(league, { exact: true }).click();
    await expect(toggle).toBeChecked();
    const again = page.getByRole("button", { name: /Double/ });
    await expect(again).toHaveAttribute("aria-pressed", "false");
    await again.click();
    await expect(again).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("button", { name: /Double/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // The event locks and its points are computed: 12 in general, 24 with the Double.
    sql(`update events set lock_at = now() - interval '1 second' where slug = '${tag}-100m'`);
    sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
      select u.id, e.competition_id, e.id, 'prediction', 12, 'prediction',
             '{"reasons":[{"kind":"perfect_podium"}],"jokers":{"double":24,"all_or_nothing":36,"safety_net":12,"spy":12,"outsider":12}}'::jsonb
      from auth.users u, events e
      where u.email = '${player.email}' and e.slug = '${tag}-100m'`);

    // The league counts the joker, and « Mes jokers » says where it was played.
    await page.goto(`/ligues/${leagueId}`);
    await expect(
      page
        .getByRole("list", { name: "Classement" })
        .getByRole("listitem")
        .filter({ hasText: player.pseudo }),
    ).toContainText("24");
    const mine = page.getByRole("region", { name: "Mes jokers" });
    await expect(mine).toContainText("Double");
    await expect(mine.getByRole("link", { name: /sur 100 m/ })).toHaveAttribute("href", event);
    await expect(mine).toContainText("Tout ou rien");
  } finally {
    sql(`delete from score_events
         where user_id = (select id from auth.users where email = '${player.email}')`);
    sql(`delete from leagues where id = '${leagueId}'`);
    sql(`delete from auth.users where email = '${friend}'`);
    sql(`delete from competitions where slug = '${tag}'`);
  }
});
