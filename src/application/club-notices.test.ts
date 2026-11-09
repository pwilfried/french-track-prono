import { describe, expect, it } from "vitest";

import { dismissClubNotice, getClubNotices, type ClubNotice } from "./club-notices";

// Application tests do not import the infra layer: a few lines of fake are enough here.
function fakeNotices() {
  const unseen: ClubNotice[] = [
    { id: "n1", kind: "validated", clubName: "Foulées de Sceaux", newName: null },
  ];
  return {
    async listUnseen() {
      return [...unseen];
    },
    async dismiss(id: string) {
      const index = unseen.findIndex((n) => n.id === id);
      if (index >= 0) unseen.splice(index, 1);
    },
  };
}

describe("a player learns what happened to their club", () => {
  it("sees the validation once, then closes it", async () => {
    // given the admin validated the club the player typed
    const notices = fakeNotices();
    // when the player opens the app, then closes the message
    expect(await getClubNotices({ notices }).execute()).toEqual([
      expect.objectContaining({ kind: "validated", clubName: "Foulées de Sceaux" }),
    ]);
    await dismissClubNotice({ notices }).execute({ id: "n1" });
    // then it is gone
    expect(await getClubNotices({ notices }).execute()).toEqual([]);
  });
});
