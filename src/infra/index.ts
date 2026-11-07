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
export {
  createInMemoryPredictionRepository,
  type PredictionEventFixture,
} from "./in-memory/prediction-repository";
export { createSupabasePredictionRepository } from "./supabase/prediction-repository";
export { createInMemoryResultStore, type ResultEventFixture } from "./in-memory/result-repository";
export { createSupabaseResultRepository } from "./supabase/result-repository";
export { createInMemoryLeagueStore } from "./in-memory/league-repository";
export { createSupabaseLeagueRepository } from "./supabase/league-repository";
export { createInMemoryRankingRepository } from "./in-memory/ranking-repository";
export { createSupabaseRankingRepository } from "./supabase/ranking-repository";
export { createInMemoryPointsStore } from "./in-memory/points-repository";
export { createSupabasePointsRepository } from "./supabase/points-repository";
