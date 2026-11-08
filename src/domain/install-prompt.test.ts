import { describe, expect, it } from "vitest";

import { shouldOfferInstall } from "./install-prompt";

const base = { signedIn: true, hasPredicted: true, sessions: 2, dismissed: false };

describe("shouldOfferInstall", () => {
  it("offers the install to a player who predicted, from the second visit", () => {
    expect(shouldOfferInstall(base)).toBe(true);
    expect(shouldOfferInstall({ ...base, sessions: 7 })).toBe(true);
  });

  it("never offers it on the first visit", () => {
    expect(shouldOfferInstall({ ...base, sessions: 1 })).toBe(false);
  });

  it("never offers it to a visitor or to a player without a prediction", () => {
    expect(shouldOfferInstall({ ...base, signedIn: false })).toBe(false);
    expect(shouldOfferInstall({ ...base, hasPredicted: false })).toBe(false);
  });

  it("never offers it again once closed", () => {
    expect(shouldOfferInstall({ ...base, dismissed: true })).toBe(false);
  });
});
