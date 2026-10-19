import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth", "/f/", "/embed", "/privacidade", "/api/forms", "/api/dsar", "/setup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!configured) {
    if (pathname === "/setup" || pathname.startsWith("/privacidade")) return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() valida o token com o Auth server (não confie apenas no cookie).
  const { data } = await supabase.auth.getUser();
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
  const isAuthPage = ["/login", "/signup", "/forgot-password"].includes(pathname);

  if (!data.user && !isPublic) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (data.user && isAuthPage) return NextResponse.redirect(new URL("/dashboard", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|embed.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
