// Public entry point of the infra layer: the app imports from "@/infra" only.
export { createInMemoryEventReader } from "./in-memory/event-reader";
export { createSupabaseEventReader } from "./supabase/event-reader";
export { createPublicSupabaseClient } from "./supabase/client";
export { createInMemoryAuthService } from "./in-memory/auth-service";
export { createSupabaseAuthService } from "./supabase/auth-service";
export {
  createSessionClient,
  readCurrentUser,
  exchangeEmailLink,
  signOutSession,
  type CookieAdapter,
  type CookieToSet,
  type CurrentUser,
} from "./supabase/session";
