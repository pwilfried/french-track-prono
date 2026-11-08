"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { messages } from "@/app/messages.fr";

import { NavIcon } from "./nav-icon";
import { isActive, MOBILE_NAV } from "./nav-items";

/** Bottom bar on phones (hidden from md): the four sections, the current one in red. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label={messages.nav.label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {MOBILE_NAV.map((item) => {
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
