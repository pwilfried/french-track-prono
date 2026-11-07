import Link from "next/link";

import { AccountHero } from "@/components/account/account-hero";
import { buttonVariants } from "@/components/ui/button";

import { messages } from "../messages.fr";

export default function GoodbyePage() {
  return (
    <main className="flex flex-1 flex-col">
      <AccountHero title={messages.deleteAccount.title} subtitle={messages.deleteAccount.done} />
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <Link href="/" className={`${buttonVariants()} w-full`}>
          {messages.deleteAccount.home}
        </Link>
      </div>
    </main>
  );
}
