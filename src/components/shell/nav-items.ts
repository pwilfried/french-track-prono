import { messages } from "@/app/messages.fr";

export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "events" | "ranking" | "league" | "manager";
};

/** The Manager is its own game, with its own entry next to the leagues (#471). */
const MANAGER: NavItem = { href: "/manager", label: messages.nav.manager, icon: "manager" };

/** Desktop menu: Accueil, Épreuves, Classement, Ma ligue, Manager. */
export const DESKTOP_NAV: NavItem[] = [
  { href: "/", label: messages.nav.home, icon: "home" },
  { href: "/epreuves", label: messages.nav.events, icon: "events" },
  { href: "/classement", label: messages.nav.ranking, icon: "ranking" },
  { href: "/ligues", label: messages.nav.league, icon: "league" },
  MANAGER,
];

/**
 * Mobile bottom bar: Accueil, Épreuves, Classement, Ligues, Manager. The leagues got their tab once
 * they became the way to predict (#351); the Manager took the profile's place, which opens from
 * the pseudo and bib of the header (#471).
 */
export const MOBILE_NAV: NavItem[] = [
  { href: "/", label: messages.nav.home, icon: "home" },
  { href: "/epreuves", label: messages.nav.events, icon: "events" },
  { href: "/classement", label: messages.nav.ranking, icon: "ranking" },
  { href: "/ligues", label: messages.nav.leagues, icon: "league" },
  MANAGER,
];

/** A section is active on its own page and on the pages below it ("/" only on itself). */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
