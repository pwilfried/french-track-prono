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
export { createInMemoryLeagueStore } from "./in-memory/league-repository";
export { createSupabaseLeagueRepository } from "./supabase/league-repository";
export { createSupabaseLeagueModerationRepository } from "./supabase/league-moderation-repository";
export { createInMemoryRankingRepository } from "./in-memory/ranking-repository";
export { createSupabaseRankingRepository } from "./supabase/ranking-repository";
export { createInMemoryPointsStore } from "./in-memory/points-repository";
export { createSupabasePointsRepository } from "./supabase/points-repository";
export { createInMemoryRevealRepository } from "./in-memory/reveal-repository";
export { createSupabaseRevealRepository } from "./supabase/reveal-repository";
export { createInMemoryReactionRepository } from "./in-memory/reaction-repository";
export { createSupabaseReactionRepository } from "./supabase/reaction-repository";
export {
  createInMemoryPredictionRepository,
  type PredictionEventFixture,
} from "./in-memory/prediction-repository";
export { createSupabasePredictionRepository } from "./supabase/prediction-repository";
export {
  createInMemoryStartListStore,
  type StartListAthleteFixture,
} from "./in-memory/start-list-repository";
export { createSupabaseStartListRepository } from "./supabase/start-list-repository";
export { createInMemoryAdminLogStore } from "./in-memory/admin-log-repository";
export { createSupabaseAdminLogRepository } from "./supabase/admin-log-repository";
export { createInMemoryAthleteReader } from "./in-memory/athlete-reader";
export { createSupabaseAthleteReader } from "./supabase/athlete-reader";
export { createInMemoryDisciplineStore } from "./in-memory/discipline-repository";
export { createSupabaseDisciplineRepository } from "./supabase/discipline-repository";
export { createInMemoryAthleteAdminStore } from "./in-memory/athlete-admin-repository";
export { createSupabaseAthleteAdminRepository } from "./supabase/athlete-admin-repository";
export { createInMemoryCompetitionAdminStore } from "./in-memory/competition-admin-repository";
export { createSupabaseCompetitionAdminRepository } from "./supabase/competition-admin-repository";
export { createInMemoryOddsStore, type OddsEventFixture } from "./in-memory/odds-repository";
export { createSupabaseOddsRepository } from "./supabase/odds-repository";
export { createInMemoryScoringRuleStore } from "./in-memory/scoring-rule-repository";
export { createSupabaseScoringRuleRepository } from "./supabase/scoring-rule-repository";
export { createSupabaseCompetitionEditRepository } from "./supabase/competition-edit-repository";
export {
  createInMemoryClubDirectory,
  type ClubFixture,
  type InMemoryClubDirectory,
} from "./in-memory/club-directory";
export { createInMemoryPlayerDetailsRepository } from "./in-memory/player-details-repository";
export { createSupabasePlayerDetailsRepository } from "./supabase/player-details-repository";
export { createSupabaseClubDirectory } from "./supabase/club-directory";
