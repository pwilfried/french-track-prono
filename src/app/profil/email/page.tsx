import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountHero } from "@/components/account/account-hero";

import { messages } from "../../messages.fr";
import { getCurrentUser } from "../../session";
import { EmailForm } from "./email-form";

/** The player changes their sign-in address, confirmed by a code sent to the new one (#341). */
export default async function ChangeEmailPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/profil/email")}`);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <AccountHero
        title={messages.changeEmail.title}
        subtitle={messages.changeEmail.current(user.email)}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        <EmailForm />
        <Link
          href="/profil"
          className="flex min-h-11 items-center justify-center font-semibold text-primary underline underline-offset-4"
        >
          {messages.editProfile.cancel}
        </Link>
      </div>
    </main>
  );
}
