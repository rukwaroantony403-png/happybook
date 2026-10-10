import { adminIsConfigured, isAdminRequest } from "@/lib/admin-auth";
import { getAdminSnapshot } from "@/lib/booking-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!adminIsConfigured()) return Response.json({ error: "Admin access is not configured on this server." }, { status: 503 });
  if (!isAdminRequest(request)) return Response.json({ error: "Admin authentication required." }, { status: 401 });
  return Response.json(getAdminSnapshot(), { headers: { "Cache-Control": "no-store" } });
}
