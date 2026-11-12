import { cache } from "react";

import { seesManager } from "@/domain/manager-access";

import { isAdmin } from "./landing";
import { getCurrentUser, getSessionClient } from "./session";

/**
 * Whether the signed-in player sees French Track Manager (#615), read once per request: the tabs,
 * the home and the Manager pages ask the same question.
 */
export const canSeeManager = cache(async (userId: string): Promise<boolean> =>
  seesManager({ isAdmin: await isAdmin(await getSessionClient(), userId) }),
);

/** The same question for whoever opens the page; a visitor does not see the Manager. */
export async function viewerSeesManager(): Promise<boolean> {
  const user = await getCurrentUser();
  return user ? canSeeManager(user.userId) : false;
}
