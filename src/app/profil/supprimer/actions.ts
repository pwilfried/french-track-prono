"use server";

import { redirect } from "next/navigation";

import { deleteMyAccount } from "@/application/delete-my-account";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { createSupabaseProfileRepository, signOutSession } from "@/infra";

import { getCurrentUser, getSessionClient } from "../../session";

export type DeleteAccountState = { error?: ErrorCode };

export async function deleteAccountAction(
  _: DeleteAccountState,
  data: FormData,
): Promise<DeleteAccountState> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/profil/supprimer");

  const client = await getSessionClient();
  try {
    await deleteMyAccount({ profiles: createSupabaseProfileRepository(client) }).execute({
      userId: user.userId,
      confirmed: data.get("confirm") === "on",
    });
  } catch (error) {
    // Only known error codes are expected here; anything else is a bug and stays visible.
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  // The account is gone: drop the session cookies too.
  await signOutSession(client);
  redirect("/au-revoir");
}
