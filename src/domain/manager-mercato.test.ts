import { describe, expect, it } from "vitest";

import { canRecruit, mercatoCloseReason, mayCloseMercato, type Recruiter } from "./manager-mercato";

const at = (iso: string) => `2027-01-0${iso}T12:00:00.000Z`;
const player = (userId: string, left: number, athletes = 0): Recruiter => ({
  userId,
  left,
  athletes,
});

describe("canRecruit", () => {
  it("is true while the credits left pay for the cheapest free athlete", () => {
    expect(canRecruit(player("u1", 10), { cheapestFree: 10 })).toBe(true);
  });

  it("stops recruiting when the budget pays for no free athlete", () => {
    expect(canRecruit(player("u1", 9, 3), { cheapestFree: 10 })).toBe(false);
  });

  it("is false when no athlete is free any more", () => {
    expect(canRecruit(player("u1", 100), { cheapestFree: null })).toBe(false);
  });

  it("recruits beyond the former maximum of 12 athletes when the budget allows it", () => {
    expect(canRecruit(player("u1", 100, 12), { cheapestFree: 10 })).toBe(true);
  });
});

describe("mercatoCloseReason", () => {
  const base = {
    modes: ["budgets_spent", "last_bidder", "scheduled"] as const,
    cheapestFree: 10,
    closesAt: null,
    now: at("5"),
  };

  it("closes when no participant can recruit any more", () => {
    expect(
      mercatoCloseReason({
        ...base,
        modes: [...base.modes],
        players: [player("u1", 5), player("u2", 0)],
      }),
    ).toBe("budgets_spent");
  });

  it("stays open while one participant can still recruit", () => {
    expect(
      mercatoCloseReason({
        ...base,
        modes: [...base.modes],
        players: [player("u1", 5), player("u2", 10)],
      }),
    ).toBeNull();
  });

  it("closes at the scheduled time, budgets left or not", () => {
    const players = [player("u1", 50), player("u2", 50)];
    expect(
      mercatoCloseReason({ ...base, modes: [...base.modes], players, closesAt: at("5") }),
    ).toBe("scheduled");
    expect(
      mercatoCloseReason({ ...base, modes: [...base.modes], players, closesAt: at("6") }),
    ).toBeNull();
  });

  it("closes only in the ways the rules of the league allow", () => {
    const spent = [player("u1", 0), player("u2", 0)];
    expect(mercatoCloseReason({ ...base, modes: ["scheduled"], players: spent })).toBeNull();
    expect(
      mercatoCloseReason({
        ...base,
        modes: ["budgets_spent"],
        players: [player("u1", 50)],
        closesAt: at("1"),
      }),
    ).toBeNull();
  });
});

describe("mayCloseMercato", () => {
  const rules = { modes: ["last_bidder" as const], cheapestFree: 10 };

  it("lets the last participant who can still recruit close the mercato", () => {
    expect(mayCloseMercato("u2", { ...rules, players: [player("u1", 5), player("u2", 40)] })).toBe(
      true,
    );
  });

  it("refuses while another participant can still recruit", () => {
    expect(mayCloseMercato("u2", { ...rules, players: [player("u1", 10), player("u2", 40)] })).toBe(
      false,
    );
  });

  it("refuses a participant who cannot recruit, and when the rules do not allow it", () => {
    expect(mayCloseMercato("u1", { ...rules, players: [player("u1", 5), player("u2", 40)] })).toBe(
      false,
    );
    expect(
      mayCloseMercato("u2", {
        ...rules,
        modes: ["budgets_spent"],
        players: [player("u1", 5), player("u2", 40)],
      }),
    ).toBe(false);
  });
});
