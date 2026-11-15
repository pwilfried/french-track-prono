import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { flagOf } from "@/domain/flag";

// Every country code of the public seed and of the demo data sets must show a flag (#948): in
// those SQL files, a quoted three-capital-letter string is always a country code.
const files = [
  "supabase/seed.sql",
  ...["supabase/dev", "supabase/data", "supabase/preprod"].flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => join(dir, name)),
  ),
];

const codes = new Set(
  files.flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/'([A-Z]{3})'/g)].map((match) => match[1]),
  ),
);

describe("country codes of the seed and demo data", () => {
  it("finds the codes in the data files", () => {
    expect(codes.has("GHA")).toBe(true);
  });

  it("gives every code used a flag", () => {
    expect([...codes].filter((code) => flagOf(code) === null)).toEqual([]);
  });
});
