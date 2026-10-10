import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, getAdminSessionId } from "@/lib/admin-session-token";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const hasSession = getAdminSessionId(
    request.cookies.get(ADMIN_COOKIE)?.value,
    process.env.ADMIN_SESSION_SECRET,
  ) !== null;
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (isLoginPage && hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (!isLoginPage && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images/).*)"],
};
