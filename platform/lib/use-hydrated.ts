"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** Returns false during SSR and the initial client render (hydration), true
 * afterwards. The canonical React way to gate client-only behavior without a
 * setState-in-effect. Used to defer dnd-kit's non-SSR-safe drag attributes so
 * the server and first client render match (avoids a hydration mismatch). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  );
}
