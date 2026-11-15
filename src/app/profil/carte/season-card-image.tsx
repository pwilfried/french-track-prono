import { ImageResponse } from "next/og";

import { animalImage } from "@/components/band/animal-image";
import { SEASON_CARD_PALETTE } from "@/components/band/season-card-palette";
import type { SeasonCard } from "@/domain/season-card";

import { messages } from "../../messages.fr";

const text = messages.seasonCard;

/** The pseudo's size: up to 24 characters fit on two lines at most, never past the edges. */
const pseudoSize = (pseudo: string) => (pseudo.length <= 12 ? 92 : pseudo.length <= 18 ? 76 : 64);

/**
 * The season card as a story image (1080 × 1920, #388), in the colours of the player's animal
 * (#900): brand, medallion, pseudo, points and rank, best shot, call to play, the track.
 */
export function seasonCardImage(card: SeasonCard) {
  const event = card.best ? messages.events.name(card.best.discipline, card.best.gender) : null;
  // Before the first animal, the card wears the hare, the mascot (#900).
  const animal = card.animal ?? "lievre";
  const { background, text: ink } = SEASON_CARD_PALETTE[animal];
  const family = card.animal ? messages.band.families[card.animal] : text.mascot;
  const lanes = 4;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background,
        color: ink,
        fontSize: 44,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "110px 90px 70px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 8 }}>{text.brand}</div>
          <div style={{ fontSize: 60, fontWeight: 700 }}>{text.title}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
          {/* A white ring keeps the medallion apart from a background of the same tint. */}
          <div
            style={{
              display: "flex",
              padding: 14,
              borderRadius: 999,
              background: "#FFFFFF",
            }}
          >
            {animalImage(animal, 340)}
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 4, textAlign: "center" }}>
            {text.animal(messages.band.animals[animal], family)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: pseudoSize(card.pseudo),
              fontWeight: 700,
              textAlign: "center",
              maxWidth: "100%",
              wordBreak: "break-word",
            }}
          >
            {card.pseudo}
          </div>
          {card.club && (
            <div style={{ fontSize: 40, textAlign: "center", maxWidth: "100%" }}>{card.club}</div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            {/* A string: satori refuses a number as the only child of an element. */}
            <span style={{ fontSize: 260, fontWeight: 700, lineHeight: 1 }}>
              {String(card.points)}
            </span>
            <span style={{ fontSize: 68, fontWeight: 700 }}>{text.points(card.points)}</span>
          </div>
          <div style={{ fontSize: 52 }}>
            {card.rank ? text.rank(card.rank, card.players) : text.notRanked}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "36px 40px",
            borderRadius: 40,
            border: `4px solid ${ink}`,
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 4 }}>{text.bestShot}</div>
          <div
            style={{
              fontSize: 50,
              fontWeight: 700,
              textAlign: "center",
              maxWidth: "100%",
              wordBreak: "break-word",
            }}
          >
            {event
              ? card.best?.perfect
                ? messages.profile.bestPerfect(event)
                : event
              : text.noBestShot}
          </div>
          {card.best && (
            <div style={{ fontSize: 56, fontWeight: 700 }}>
              {messages.profile.bestPoints(card.best.points)}
            </div>
          )}
        </div>

        <div style={{ fontSize: 36, fontWeight: 700, textAlign: "center" }}>{text.footer}</div>
      </div>

      {/* The track at the bottom: a red-brown band and its white lane lines. */}
      <div style={{ display: "flex", flexDirection: "column", background: "#C8553D" }}>
        {Array.from({ length: lanes }, (_, i) => (
          <div key={i} style={{ display: "flex", height: 36, borderTop: "5px solid #FFFFFF" }} />
        ))}
      </div>
    </div>,
    {
      width: 1080,
      height: 1920,
      // A pseudo may hold an emoji.
      emoji: "twemoji",
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
