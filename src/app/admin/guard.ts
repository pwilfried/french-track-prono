import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { requireAdmin } from "@/application/require-admin";
import { createSupabaseProfileRepository } from "@/infra";

import { getCurrentUser, getSessionClient } from "../session";

/**
 * The back-office is invisible to anyone but an admin: a visitor or a player gets the not-found
 * page, so the address reveals nothing. Returns the admin's id and session client.
 */
export async function adminOnly() {
  const user = await getCurrentUser();
  if (!user) notFound();
  const client = await getSessionClient();
  try {
    await requireAdmin({ profiles: createSupabaseProfileRepository(client) }).execute({
      userId: user.userId,
    });
  } catch (error) {
    if (error instanceof UseCaseError) notFound();
    throw error;
  }
  return { userId: user.userId, client };
}
