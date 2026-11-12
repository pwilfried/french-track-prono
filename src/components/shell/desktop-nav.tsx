"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { messages } from "@/app/messages.fr";

import { desktopNav, isActive } from "./nav-items";

/**
 * Horizontal menu of the top bar from md; the current section is underlined in red. The Manager
 * only for who sees it (#615).
 */
export function DesktopNav({ showManager }: { showManager: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label={messages.nav.label} className="hidden md:block">
      <ul className="flex items-center gap-1">
        {desktopNav(showManager).map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
