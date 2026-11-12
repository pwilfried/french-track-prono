"use client";

import { useEffect, useState } from "react";

/** The current time, ticking every second, or `fixed` when given (stories, tests). */
export function useNow(fixed?: Date): Date {
  const [tick, setTick] = useState(() => new Date());
  useEffect(() => {
    if (fixed) return;
    const id = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(id);
  }, [fixed]);
  return fixed ?? tick;
}
