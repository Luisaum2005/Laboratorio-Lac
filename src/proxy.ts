import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnvironment } from "@/lib/supabase/environment";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseEnvironment();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isProtectedRoute = request.nextUrl.pathname.startsWith("/catalogo")
    || request.nextUrl.pathname.startsWith("/acessos")
    || request.nextUrl.pathname.startsWith("/conferencias");
  const userId = data?.claims?.sub;
  let hasActiveProfile = false;

  if (userId) {
    const { data: profile } = await supabase.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
    hasActiveProfile = Boolean(profile);
  }

  if (isProtectedRoute && (!data?.claims || !hasActiveProfile)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (data?.claims && hasActiveProfile && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/catalogo", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/catalogo/:path*", "/acessos/:path*", "/conferencias/:path*", "/login"],
};
