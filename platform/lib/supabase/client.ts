"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser client — uses the anon key, constrained by RLS (see
// platform/supabase/schema.sql: "authenticated full access" policies). Safe to
// bundle to the client; the anon key alone can't read/write anything without a
// logged-in session.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
