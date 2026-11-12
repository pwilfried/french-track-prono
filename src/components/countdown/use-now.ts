"use client";

import { useEffect, useState } from "react";

/**
 * The current time, ticking every `everyMs` (a second by default), or `fixed` when given
 * (stories, tests).
 */
export function useNow(fixed?: Date, everyMs = 1000): Date {
  const [tick, setTick] = useState(() => new Date());
  useEffect(() => {
    if (fixed) return;
    const id = setInterval(() => setTick(new Date()), everyMs);
    return () => clearInterval(id);
  }, [fixed, everyMs]);
  return fixed ?? tick;
}
