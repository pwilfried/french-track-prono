import { readdirSync } from "node:fs";

import { expect, it } from "vitest";

// Supabase keys applied migrations by the number before the first « _ » (#514).
it("gives every migration its own version", () => {
  const versions = readdirSync("supabase/migrations").map((file) => file.split("_")[0]);
  const twice = versions.filter((version, index) => versions.indexOf(version) !== index);
  expect(twice).toEqual([]);
});
