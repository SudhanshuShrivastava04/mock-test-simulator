import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only: bounce visitors without a session cookie to the sign-in page before
// any rendering happens. The real role check runs on the server in lib/session.ts.
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.getAll().some((c) => /^(__Secure-)?authjs\.session-token/.test(c.name));
  if (hasSession) return NextResponse.next();
  const url = new URL("/login", req.url);
  url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/test/:path*"],
};
