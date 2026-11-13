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
export {
  createInMemoryPerformanceStore,
  type PerformanceEventFixture,
} from "./in-memory/performance-repository";
export { createSupabasePerformanceRepository } from "./supabase/performance-repository";
export {
  createInMemoryManagerScoreStore,
  type ManagerScoreFixture,
} from "./in-memory/manager-score-repository";
export { createSupabaseManagerScoreRepository } from "./supabase/manager-score-repository";
export {
  createInMemoryManagerSeasonStore,
  type ManagerSeasonFixture,
} from "./in-memory/manager-season-repository";
export { createSupabaseManagerSeasonRepository } from "./supabase/manager-season-repository";
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
export { createInMemoryProfileReminderRepository } from "./in-memory/profile-reminder-repository";
export { createSupabaseProfileReminderRepository } from "./supabase/profile-reminder-repository";
export { createSupabaseClubDirectory } from "./supabase/club-directory";
export { createInMemoryEmailChangeService } from "./in-memory/email-change-service";
export { createSupabaseEmailChangeService } from "./supabase/email-change-service";
export { createInMemoryPlayerStore } from "./in-memory/player-moderation-repository";
export { createSupabasePlayerModerationRepository } from "./supabase/player-moderation-repository";
export { createInMemoryClubAdminStore } from "./in-memory/club-admin-repository";
export { createSupabaseClubAdminRepository } from "./supabase/club-admin-repository";
export { createInMemoryClubNoticeStore } from "./in-memory/club-notice-repository";
export { createSupabaseClubNoticeRepository } from "./supabase/club-notice-repository";
export { createInMemoryPushSubscriptionStore } from "./in-memory/push-subscription-repository";
export { createSupabasePushSubscriptionRepository } from "./supabase/push-subscription-repository";
export { createInMemoryReadinessStore } from "./in-memory/readiness-reader";
export { createSupabaseReadinessReader } from "./supabase/readiness-reader";
export { createInMemoryManagerRuleStore } from "./in-memory/manager-rule-repository";
export { createSupabaseManagerRuleRepository } from "./supabase/manager-rule-repository";
export { createInMemoryManagerLeagueStore } from "./in-memory/manager-league-repository";
export { createSupabaseManagerLeagueRepository } from "./supabase/manager-league-repository";
export { createInMemoryManagerCatalogue } from "./in-memory/manager-catalogue-repository";
export { createSupabaseManagerCatalogue } from "./supabase/manager-catalogue-repository";
export { createInMemoryManagerBidStore } from "./in-memory/manager-bid-repository";
export { createSupabaseManagerBids } from "./supabase/manager-bid-repository";
export { createSupabaseManagerReveals } from "./supabase/manager-reveal-repository";
export { createInMemoryManagerLineupStore } from "./in-memory/manager-lineup-repository";
export { createSupabaseManagerLineups } from "./supabase/manager-lineup-repository";
