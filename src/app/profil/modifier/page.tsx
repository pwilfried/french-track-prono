import Link from "next/link";
import { redirect } from "next/navigation";

import { listDisciplines } from "@/application/disciplines";
import { getProfile } from "@/application/get-profile";
import { getPlayerDetails } from "@/application/player-details";
import { AccountHero } from "@/components/account/account-hero";
import {
  createSupabaseDisciplineRepository,
  createSupabasePlayerDetailsRepository,
  createSupabaseProfileRepository,
} from "@/infra";

import { messages } from "../../messages.fr";
import { getCurrentUser, getSessionClient } from "../../session";
import { EditProfileForm } from "./edit-profile-form";

/** The player changes their pseudo, avatar, sex, disciplines and club (#341). */
export default async function EditProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/profil/modifier")}`);
  const client = await getSessionClient();
  const profile = await getProfile({ profiles: createSupabaseProfileRepository(client) }).execute({
    userId: user.userId,
  });
  if (!profile) redirect(`/bienvenue?next=${encodeURIComponent("/profil/modifier")}`);
  const [details, disciplines] = await Promise.all([
    getPlayerDetails({ details: createSupabasePlayerDetailsRepository(client) }).execute({
      userId: user.userId,
    }),
    listDisciplines({ disciplines: createSupabaseDisciplineRepository(client) }).execute(),
  ]);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <AccountHero title={messages.editProfile.title} subtitle={messages.editProfile.subtitle} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        <EditProfileForm
          disciplines={disciplines.map(({ name, family }) => ({ name, family }))}
          initial={{
            pseudo: profile.pseudo,
            avatar: profile.avatar,
            sex: details.sex ?? "",
            disciplines: details.disciplines,
            club: details.club,
            newClubName: "",
            newClubCity: "",
          }}
        />
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
