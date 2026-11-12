"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { messages } from "@/app/messages.fr";

import { NavIcon } from "./nav-icon";
import { isActive, mobileNav } from "./nav-items";

/**
 * Bottom bar on phones (hidden from md): the sections, the current one in red. Five tabs with the
 * Manager, four for a player who does not see it (#615).
 */
export function BottomNav({ showManager }: { showManager: boolean }) {
  const pathname = usePathname();
  const items = mobileNav(showManager);
  return (
    <nav
      aria-label={messages.nav.label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className={`mx-auto grid max-w-md ${showManager ? "grid-cols-5" : "grid-cols-4"}`}>
        {items.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                  active ? "text-accent-text" : "text-muted-foreground"
                }`}
              >
                <NavIcon icon={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
