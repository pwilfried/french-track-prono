"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** True on the back-office, which shows only the admin interface. */
export const isBackOffice = (pathname: string | null) =>
  pathname === "/admin" || (pathname ?? "").startsWith("/admin/");

/** The player's navigation (header, bottom bar), left out of the back-office. */
export function PlayerOnly({ children }: { children: ReactNode }) {
  return isBackOffice(usePathname()) ? null : children;
}
