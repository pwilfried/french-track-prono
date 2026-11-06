import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { checkLayers, type SourceFile } from "./layers";

function sourceFiles(dir: string): SourceFile[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.(ts|tsx)$/.test(name)) return [];
    return [
      {
        path: path.relative(process.cwd(), full).split(path.sep).join("/"),
        content: readFileSync(full, "utf8"),
      },
    ];
  });
}

describe("repository layers", () => {
  it("has no import that breaks the layer rule", () => {
    const violations = checkLayers(sourceFiles(path.join(process.cwd(), "src")));

    expect(violations.map((v) => `${v.file}: ${v.message}`)).toEqual([]);
  });
});
