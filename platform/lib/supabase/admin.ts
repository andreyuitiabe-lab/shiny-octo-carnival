import { createClient } from "@supabase/supabase-js";

// Service-role client — BYPASSES ROW LEVEL SECURITY ENTIRELY. Only ever import
// this from server-only code: the GHL webhook handler and the send-SMS route.
// Never import from a Client Component, never let SUPABASE_SERVICE_ROLE_KEY
// leak into a NEXT_PUBLIC_* var or the client bundle.
//
// No cookie/session handling here on purpose — this client acts as the system,
// not as a logged-in user, which is exactly what a webhook (no browser session)
// needs.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
