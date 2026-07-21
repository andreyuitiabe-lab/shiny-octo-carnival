// A single fixed reference instant, shared by the mock data and every relative-time
// label (wait.ts, Thread's ageLabel). Using a constant instead of Date.now() keeps
// server-rendered and client-hydrated timestamps identical, which avoids React
// hydration mismatches (relative times computed at render otherwise differ between
// the server's "now" and the client's "now" a few ms later).
//
// This is correct precisely because the data is mock. When the real backend lands,
// timestamps become live and relative-time rendering must move to client-only
// (render after mount) — swap this constant for Date.now() then, not before.
export const REFERENCE_NOW = new Date("2026-07-21T12:00:00Z").getTime();
