import { describe, expect, it } from "vitest";

import {
  missingPerformances,
  performanceProblem,
  tidyPerformances,
  type Performance,
} from "./performance";

const line = (over: Partial<Performance> = {}): Performance => ({
  athleteId: "a1",
  status: "ok",
  place: 1,
  mark: "10.62",
  records: [],
  ...over,
});

describe("tidyPerformances", () => {
  it("writes the mark like athletics does and drops empty marks", () => {
    expect(tidyPerformances([line({ mark: " 10,6 " })], "time")[0].mark).toBe("10.60");
    expect(tidyPerformances([line({ mark: "  " })], "time")[0].mark).toBeNull();
  });

  it("keeps a mark it cannot read as typed, so the check can reject it", () => {
    expect(tidyPerformances([line({ mark: "vite" })], "time")[0].mark).toBe("vite");
  });

  it("clears the place, the mark and the records of an athlete who did not finish", () => {
    for (const status of ["dns", "dnf", "dq"] as const) {
      expect(
        tidyPerformances([line({ status, place: 4, mark: "10.62", records: ["pb"] })], "time"),
      ).toEqual([{ athleteId: "a1", status, place: null, mark: null, records: [] }]);
    }
  });

  it("lists each record once, in a stable order", () => {
    expect(
      tidyPerformances([line({ records: ["wr", "pb", "wr", "sb"] })], "time")[0].records,
    ).toEqual(["pb", "sb", "wr"]);
  });
});

describe("performanceProblem", () => {
  it("accepts marks, places, ties, records and athletes who did not finish", () => {
    expect(
      performanceProblem(
        [
          line({ athleteId: "a1", place: 1, records: ["pb", "sb", "nr", "ar", "wr"] }),
          line({ athleteId: "a2", place: 1, mark: "10.62" }),
          line({ athleteId: "a3", place: null, mark: "10.80" }),
          line({ athleteId: "a4", status: "dnf", place: null, mark: null }),
        ],
        "time",
      ),
    ).toBeNull();
  });

  it("accepts an empty list: nothing entered yet", () => {
    expect(performanceProblem([], "distance")).toBeNull();
  });

  it("rejects an athlete entered twice", () => {
    expect(performanceProblem([line(), line({ place: 2 })], "time")).toBe("twice");
  });

  it("rejects a place that is not a whole number from 1", () => {
    for (const place of [0, -1, 1.5, Number.NaN]) {
      expect(performanceProblem([line({ place })], "time")).toBe("bad_place");
    }
  });

  it("rejects a finisher without a mark", () => {
    expect(performanceProblem([line({ mark: null })], "time")).toBe("mark_missing");
  });

  it("rejects a mark it cannot read in the unit of the discipline", () => {
    expect(performanceProblem([line({ mark: "8m12x" })], "distance")).toBe("bad_mark");
    expect(performanceProblem([line({ mark: "8.12" })], "distance")).toBeNull();
  });

  it("rejects a place, a mark or a record for an athlete who did not finish", () => {
    expect(performanceProblem([line({ status: "dq", mark: null })], "time")).toBe("not_finished");
    expect(performanceProblem([line({ status: "dns", place: null })], "time")).toBe("not_finished");
    expect(
      performanceProblem(
        [line({ status: "dnf", place: null, mark: null, records: ["sb"] })],
        "time",
      ),
    ).toBe("not_finished");
  });
});

describe("missingPerformances", () => {
  it("lists the lined-up athletes without a line, in the order given", () => {
    expect(missingPerformances(["a3", "a1", "a2"], [line({ athleteId: "a1" })])).toEqual([
      "a3",
      "a2",
    ]);
  });

  it("counts an athlete who did not finish as entered", () => {
    expect(missingPerformances(["a1"], [line({ status: "dns", place: null, mark: null })])).toEqual(
      [],
    );
  });
});
