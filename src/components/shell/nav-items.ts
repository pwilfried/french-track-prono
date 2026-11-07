import { messages } from "@/app/messages.fr";

export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "events" | "ranking" | "league" | "profile";
};

/** Desktop menu (boards V1): Accueil, Épreuves, Classement, Ma ligue. */
export const DESKTOP_NAV: NavItem[] = [
  { href: "/", label: messages.nav.home, icon: "home" },
  { href: "/epreuves", label: messages.nav.events, icon: "events" },
  { href: "/classement", label: messages.nav.ranking, icon: "ranking" },
  { href: "/ligues", label: messages.nav.league, icon: "league" },
];

/** Mobile bottom bar (boards V1): Accueil, Épreuves, Classement, Profil. */
export const MOBILE_NAV: NavItem[] = [
  { href: "/", label: messages.nav.home, icon: "home" },
  { href: "/epreuves", label: messages.nav.events, icon: "events" },
  { href: "/classement", label: messages.nav.ranking, icon: "ranking" },
  { href: "/profil", label: messages.nav.profile, icon: "profile" },
];

/** A section is active on its own page and on the pages below it ("/" only on itself). */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
