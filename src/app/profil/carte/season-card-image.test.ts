import { describe, expect, it } from "vitest";

import { ANIMALS } from "@/domain/band";
import type { SeasonCard } from "@/domain/season-card";

import { seasonCardImage } from "./season-card-image";

const card: SeasonCard = {
  pseudo: "Démo Gazelle",
  animal: "guepard",
  club: null,
  points: 42,
  rank: 12,
  players: 480,
  best: { discipline: "100 m", gender: "F", points: 12, perfect: true },
};

/** Width and height read from the PNG header. */
async function sizeOf(response: Response) {
  const png = Buffer.from(await response.arrayBuffer());
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe("seasonCardImage", () => {
  it.each([...ANIMALS, null])("draws a 1080 × 1920 PNG for the %s", async (animal) => {
    const response = seasonCardImage({ ...card, animal });
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(await sizeOf(response)).toEqual({ width: 1080, height: 1920 });
  });

  it("draws a long pseudo, a long club and no best shot yet", async () => {
    const response = seasonCardImage({
      ...card,
      pseudo: "Wwwwwwwwwwwwwwwwwwwwwwww",
      club: "Association sportive démo de la vallée",
      rank: null,
      best: null,
    });
    expect(await sizeOf(response)).toEqual({ width: 1080, height: 1920 });
  });
});
