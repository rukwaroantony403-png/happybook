import { ADMIN_COOKIE, adminCookieOptions, adminIsConfigured, authenticateStaff, createAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!adminIsConfigured()) return Response.json({ error: "Admin access is not configured on this server." }, { status: 503 });
  let username = "admin";
  let password = "";
  try {
    const body = await request.json();
    username = typeof body.username === "string" ? body.username.trim() : username;
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return Response.json({ error: "Enter your username and password." }, { status: 400 });
  }
  if (username.length < 1 || username.length > 80 || password.length < 1 || password.length > 128) return Response.json({ error: "Enter a valid username and password." }, { status: 400 });
  const staff = authenticateStaff(username, password);
  if (!staff) return Response.json({ error: "Username or password is incorrect." }, { status: 401 });
  const session = createAdminSession(staff);
  return Response.json({ authenticated: true, staff }, { headers: { "Set-Cookie": `${ADMIN_COOKIE}=${session.value}; ${adminCookieOptions(session.maxAge)}`, "Cache-Control": "no-store" } });
}

export async function DELETE() {
  return Response.json({ authenticated: false }, { headers: { "Set-Cookie": `${ADMIN_COOKIE}=; ${adminCookieOptions(0)}`, "Cache-Control": "no-store" } });
}
