import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed `middleware.ts`/`export function middleware` to
// `proxy.ts`/`export function proxy` — see AGENTS.md, this is NOT the
// pre-16 convention. Runs on every request (matcher below): refreshes the
// Supabase session cookie, and gates every route except /login behind auth —
// this is a 2-operator internal tool, not a public app, so there's no
// "logged out" experience to design beyond "go log in".
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  if (!user && !isLoginRoute && !isApiRoute) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLoginRoute) {
    return NextResponse.redirect(new URL("/kanban", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and image optimization files.
     * API routes are included (so the session cookie stays fresh for them)
     * but not auth-gated here — /api/webhooks/ghl authenticates via webhook
     * signature, not a user session, and the send route checks auth itself.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
