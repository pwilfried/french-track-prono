import { AccountMenu } from "@/components/account/account-menu";
import { BrandLink } from "@/components/brand/brand-link";

import { DesktopNav } from "./desktop-nav";

/** Top bar of every page: logo, menu (from md), and the player's avatar or the sign-in link. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <BrandLink />
          <DesktopNav />
        </div>
        <AccountMenu returnTo="/epreuves" />
      </div>
    </header>
  );
}
