import { messages } from "@/app/messages.fr";

export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "events" | "ranking" | "league" | "manager";
  /** Other sections the tab stays active on: an event page belongs to « Compétitions » (#659). */
  also?: string[];
};

const COMPETITIONS: NavItem = {
  href: "/competitions",
  label: messages.nav.events,
  icon: "events",
  also: ["/epreuves"],
};

/** The Manager is its own game, with its own entry next to the leagues (#471). */
const MANAGER: NavItem = { href: "/manager", label: messages.nav.manager, icon: "manager" };

/** Desktop menu: Accueil, Compétitions, Classement, Ma ligue, Manager. */
export const DESKTOP_NAV: NavItem[] = [
  { href: "/", label: messages.nav.home, icon: "home" },
  COMPETITIONS,
  { href: "/classement", label: messages.nav.ranking, icon: "ranking" },
  { href: "/ligues", label: messages.nav.league, icon: "league" },
  MANAGER,
];

/**
 * Mobile bottom bar: Accueil, Compétitions, Classement, Ligues, Manager. The leagues got their tab once
 * they became the way to predict (#351); the Manager took the profile's place, which opens from
 * the pseudo and bib of the header (#471).
 */
export const MOBILE_NAV: NavItem[] = [
  { href: "/", label: messages.nav.home, icon: "home" },
  COMPETITIONS,
  { href: "/classement", label: messages.nav.ranking, icon: "ranking" },
  { href: "/ligues", label: messages.nav.leagues, icon: "league" },
  MANAGER,
];

/** A section is active on its own page and on the pages below it ("/" only on itself). */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A tab is active on its section and on the other sections it holds. */
export function isItemActive(item: NavItem, pathname: string): boolean {
  return [item.href, ...(item.also ?? [])].some((href) => isActive(href, pathname));
}
