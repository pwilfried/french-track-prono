import { describe, expect, it } from "vitest";

import { checkLayers, type SourceFile } from "./layers";

const file = (path: string, ...imports: string[]): SourceFile => ({
  path,
  content: imports.map((spec) => `import x from "${spec}";`).join("\n"),
});

describe("checkLayers", () => {
  it("accepts a domain file that imports only other domain files", () => {
    const violations = checkLayers([file("src/domain/scoring.ts", "./rules", "@/domain/rules")]);

    expect(violations).toEqual([]);
  });

  it("rejects a domain file that imports the application layer", () => {
    const violations = checkLayers([file("src/domain/scoring.ts", "@/application/score-event")]);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: "src/domain/scoring.ts", layer: "domain" });
  });

  it("rejects a domain file that imports an npm package or a node builtin", () => {
    const violations = checkLayers([
      file("src/domain/scoring.ts", "zod", "node:fs", "@supabase/supabase-js"),
    ]);

    expect(violations).toHaveLength(3);
  });

  it("rejects a relative import that escapes the layer", () => {
    const violations = checkLayers([file("src/domain/scoring.ts", "../infra/supabase")]);

    expect(violations).toHaveLength(1);
  });

  it("accepts an application file that imports the domain", () => {
    const violations = checkLayers([file("src/application/score-event.ts", "@/domain/scoring")]);

    expect(violations).toEqual([]);
  });

  it("rejects an application file that imports infra, app or an npm package", () => {
    const violations = checkLayers([
      file("src/application/score-event.ts", "@/infra/supabase", "@/app/page", "react"),
    ]);

    expect(violations).toHaveLength(3);
  });

  it("accepts an infra file that imports domain, application and npm packages", () => {
    const violations = checkLayers([
      file(
        "src/infra/supabase/events.ts",
        "@/domain/scoring",
        "@/application/list-events",
        "@supabase/supabase-js",
      ),
    ]);

    expect(violations).toEqual([]);
  });

  it("rejects an infra file that imports the app layer", () => {
    const violations = checkLayers([file("src/infra/supabase/events.ts", "@/app/page")]);

    expect(violations).toHaveLength(1);
  });

  it("accepts an app file that imports the infra public entry point", () => {
    const violations = checkLayers([
      file("src/app/page.tsx", "@/infra", "@/application/list-events", "react"),
    ]);

    expect(violations).toEqual([]);
  });

  it("rejects an app file that imports infra internals", () => {
    const violations = checkLayers([file("src/app/page.tsx", "@/infra/supabase/events")]);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ layer: "app" });
  });

  it("sees dynamic imports, re-exports and side-effect imports", () => {
    const violations = checkLayers([
      {
        path: "src/domain/scoring.ts",
        content: [
          'export * from "@/infra/supabase";',
          'const m = await import("@/app/page");',
          'import "react";',
        ].join("\n"),
      },
    ]);

    expect(violations).toHaveLength(3);
  });

  it("ignores files outside the four layers and test-only files in tools", () => {
    const violations = checkLayers([
      file("src/lib/utils.ts", "clsx"),
      file("tools/layers.ts", "node:fs"),
    ]);

    expect(violations).toEqual([]);
  });
});
