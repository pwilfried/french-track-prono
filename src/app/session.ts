import { cookies } from "next/headers";

import { createSessionClient, readCurrentUser, type CurrentUser } from "@/infra";

/** Session client for Server Components, route handlers and server actions. */
export async function getSessionClient() {
  const store = await cookies();
  return createSessionClient({
    getAll: () => store.getAll(),
    setAll: (toSet) => {
      for (const { name, value, options } of toSet) store.set(name, value, options);
    },
  });
}

/** The signed-in user, or null for a visitor. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return readCurrentUser(await getSessionClient());
}
