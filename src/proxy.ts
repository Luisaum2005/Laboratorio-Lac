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
  if (!data?.claims && request.nextUrl.pathname.startsWith("/catalogo")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (data?.claims && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/catalogo", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/catalogo/:path*", "/login"],
};
