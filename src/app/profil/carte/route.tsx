import { ImageResponse } from "next/og";

import { UseCaseError } from "@/application/errors";
import { getMySeason } from "@/application/get-my-season";
import { getProfile } from "@/application/get-profile";
import { getPlayerDetails } from "@/application/player-details";
import { seasonCardOf } from "@/domain/season-card";
import {
  createPublicSupabaseClient,
  createSupabaseDisciplineRepository,
  createSupabaseEventReader,
  createSupabasePlayerDetailsRepository,
  createSupabasePredictionRepository,
  createSupabaseProfileRepository,
  createSupabaseRankingRepository,
} from "@/infra";

import { currentCompetition, loadCompetitions } from "../../competition";
import { messages } from "../../messages.fr";
import { getCurrentUser, getSessionClient } from "../../session";

const text = messages.seasonCard;
const ink = "#082e66";
const gold = "#ffc857";

/** « Ma carte de saison » (#388): the signed-in player's season as a story image (1080 × 1920). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const client = await getSessionClient();
  const profile = await getProfile({
    profiles: createSupabaseProfileRepository(client),
  }).execute({ userId: user.userId });
  if (!profile) return new Response(null, { status: 404 });

  const competition = await currentCompetition();
  const { coming, past } = await loadCompetitions();
  const slugs = [...coming, ...past].map((c) => c.slug);
  let card;
  try {
    const [season, details] = await Promise.all([
      getMySeason({
        ranking: createSupabaseRankingRepository(client),
        predictions: createSupabasePredictionRepository(client),
        events: createSupabaseEventReader(createPublicSupabaseClient()),
        disciplines: createSupabaseDisciplineRepository(createPublicSupabaseClient()),
      }).execute({
        userId: user.userId,
        competitionSlugs: slugs.length ? slugs : [competition.slug],
      }),
      getPlayerDetails({ details: createSupabasePlayerDetailsRepository(client) }).execute({
        userId: user.userId,
      }),
    ]);
    card = seasonCardOf({
      profile,
      club: details.club,
      season: { ...season, bestShot: season.stats.bestShot },
    });
  } catch (error) {
    if (error instanceof UseCaseError) return new Response(null, { status: 503 });
    throw error;
  }

  const event = card.best
    ? `${card.best.discipline} ${messages.events.gender[card.best.gender].toLowerCase()}`
    : null;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "140px 90px 120px",
        background: ink,
        color: "#f8f8f8",
        fontSize: 44,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 36, letterSpacing: 8, color: gold }}>{text.brand}</div>
        <div style={{ fontSize: 72, fontWeight: 700 }}>{text.title}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <div
          style={{
            display: "flex",
            width: 260,
            height: 260,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            border: `8px solid ${gold}`,
            background: "#ffffff",
            fontSize: 150,
          }}
        >
          {card.avatar}
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, textAlign: "center" }}>{card.pseudo}</div>
        {card.club && <div style={{ opacity: 0.8, textAlign: "center" }}>{card.club}</div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
          <span style={{ fontSize: 240, fontWeight: 700, color: gold, lineHeight: 1 }}>
            {card.points}
          </span>
          <span style={{ fontSize: 64 }}>{text.points}</span>
        </div>
        <div style={{ fontSize: 56 }}>
          {card.rank ? text.rank(card.rank, card.players) : text.notRanked}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          width: "100%",
          padding: "48px 40px",
          borderRadius: 48,
          background: "rgba(255, 255, 255, 0.1)",
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 4, opacity: 0.8 }}>{text.bestShot}</div>
        <div style={{ fontSize: 54, fontWeight: 700, textAlign: "center" }}>
          {event ? (card.best?.perfect ? text.bestPerfect(event) : event) : text.noBestShot}
        </div>
        {card.best && (
          <div style={{ fontSize: 60, fontWeight: 700, color: gold }}>
            {text.bestPoints(card.best.points)}
          </div>
        )}
      </div>

      <div style={{ fontSize: 36, opacity: 0.8 }}>{text.footer}</div>
    </div>,
    {
      width: 1080,
      height: 1920,
      emoji: "twemoji",
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
