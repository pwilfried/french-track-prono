import { cookies, headers } from "next/headers";
import { cache } from "react";

import type { Profile, ProfileRepository } from "@/application/create-profile";
import {
  createSessionClient,
  createSupabaseProfileRepository,
  readCurrentUser,
  type CurrentUser,
} from "@/infra";

import { readProxiedSession } from "./proxied-session";

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

/** What the proxy checked for this page load (#1021), or undefined outside a page load. */
const getProxiedSession = cache(async () => readProxiedSession(await headers()));

/**
 * The signed-in user, or null for a visitor, once per page render (#824). On a page load the
 * proxy has just checked it with the auth server and hands it over (#1021); elsewhere (a server
 * action) it is checked with the auth server here.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const proxied = await getProxiedSession();
  return proxied ? proxied.user : getVerifiedUser();
});

/** The signed-in user, always checked with the auth server here (route handlers, #1021). */
export const getVerifiedUser = cache(async (): Promise<CurrentUser | null> =>
  readCurrentUser(await getSessionClient()),
);

/**
 * The profiles read through the session, a player's profile read once per page render (#824): the
 * header (pseudo, bib) and the page (home, profile) ask the same row, and not at all when the
 * proxy already read it (#1021).
 */
export const getSessionProfiles = cache(async (): Promise<ProfileRepository> => {
  const profiles = createSupabaseProfileRepository(await getSessionClient());
  const found = new Map<string, Promise<Profile | null>>();
  // The proxy already read it on this page load (#1021).
  const proxied = await getProxiedSession();
  if (proxied?.user && proxied.profile !== undefined)
    found.set(proxied.user.userId, Promise.resolve(proxied.profile));
  return {
    ...profiles,
    find(userId) {
      if (!found.has(userId)) found.set(userId, profiles.find(userId));
      return found.get(userId)!;
    },
  };
});
