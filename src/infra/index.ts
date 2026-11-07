// Public entry point of the infra layer: the app imports from "@/infra" only.
export { createInMemoryEventReader } from "./in-memory/event-reader";
export { createSupabaseEventReader } from "./supabase/event-reader";
export { createPublicSupabaseClient } from "./supabase/client";
export { createInMemoryAuthService } from "./in-memory/auth-service";
export { createSupabaseAuthService } from "./supabase/auth-service";
export { createInMemoryProfileRepository } from "./in-memory/profile-repository";
export { createSupabaseProfileRepository } from "./supabase/profile-repository";
export {
  createSessionClient,
  readCurrentUser,
  exchangeEmailLink,
  signOutSession,
  type CookieAdapter,
  type CookieToSet,
  type CurrentUser,
} from "./supabase/session";
export { createInMemoryResultStore, type ResultEventFixture } from "./in-memory/result-repository";
export { createSupabaseResultRepository } from "./supabase/result-repository";
