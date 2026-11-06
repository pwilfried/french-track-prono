import { redirect } from "next/navigation";

import { AccountHero } from "@/components/account/account-hero";
import { safeRedirectPath } from "@/domain/redirect";

import { messages } from "../messages.fr";
import { getCurrentUser } from "../session";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erreur?: string }>;
}) {
  const { next: rawNext, erreur } = await searchParams;
  const next = safeRedirectPath(rawNext);
  if (await getCurrentUser()) redirect(next);

  return (
    <main className="flex flex-1 flex-col">
      <AccountHero title={messages.signIn.title} subtitle={messages.signIn.subtitle} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        <SignInForm next={next} linkError={erreur === "lien"} />
      </div>
    </main>
  );
}
