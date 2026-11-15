import { cookies } from "next/headers";
import { cache } from "react";

import type { Profile, ProfileRepository } from "@/application/create-profile";
import {
  createSessionClient,
  createSupabaseProfileRepository,
  readCurrentUser,
  type CurrentUser,
} from "@/infra";

/**
 * Session client for Server Components, route handlers and server actions. One per page render
 * (#824): the header and the page share it. Outside a render (a server action, a route handler)
 * React's `cache` does not keep anything, so each call builds a new client, as before.
 */
export const getSessionClient = cache(async () => {
  const store = await cookies();
  return createSessionClient({
    getAll: () => store.getAll(),
    setAll: (toSet) => {
      for (const { name, value, options } of toSet) store.set(name, value, options);
    },
  });
});

/**
 * The signed-in user, or null for a visitor. Checked with the auth server once per page render
 * (#824): the header, the page and its loaders used to ask it three to five times.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> =>
  readCurrentUser(await getSessionClient()),
);

/**
 * The profiles read through the session, a player's profile read once per page render (#824): the
 * header (pseudo, bib) and the page (home, profile) ask the same row.
 */
export const getSessionProfiles = cache(async (): Promise<ProfileRepository> => {
  const profiles = createSupabaseProfileRepository(await getSessionClient());
  const found = new Map<string, Promise<Profile | null>>();
  return {
    ...profiles,
    find(userId) {
      if (!found.has(userId)) found.set(userId, profiles.find(userId));
      return found.get(userId)!;
    },
  };
});
