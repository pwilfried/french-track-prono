import { redirect } from "next/navigation";

import { AccountHero } from "@/components/account/account-hero";

import { messages } from "../../messages.fr";
import { getCurrentUser } from "../../session";
import { DeleteForm } from "./delete-form";

export default async function DeleteAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/profil/supprimer")}`);

  return (
    <main className="flex flex-1 flex-col">
      <AccountHero
        title={messages.deleteAccount.title}
        subtitle={messages.deleteAccount.subtitle}
      />
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <DeleteForm />
      </div>
    </main>
  );
}
