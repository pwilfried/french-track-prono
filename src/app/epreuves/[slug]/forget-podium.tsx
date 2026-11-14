"use client";

import { useEffect } from "react";

import { forgetPodium } from "./kept-podium";

/** On a locked event, drops the podium the player was building in this tab (#699). */
export function ForgetPodium({ eventId }: { eventId: string }) {
  useEffect(() => forgetPodium(eventId), [eventId]);
  return null;
}
