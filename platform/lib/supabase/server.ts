import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Server Component / Route Handler client — still the anon key + RLS, but reads
// the user's session from cookies (set by proxy.ts) so `auth.getUser()` reflects
// who's actually logged in server-side. NOT the service role — see admin.ts for
// the one that bypasses RLS.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component (not a Route Handler/Server Action) —
            // cookies can't be set here. Harmless as long as proxy.ts is also
            // refreshing the session, which it is (see proxy.ts).
          }
        },
      },
    },
  );
}
