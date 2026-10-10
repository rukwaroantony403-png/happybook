import { isAdminRequest } from "@/lib/admin-auth";
import { clearStaffNotifications, getStaffNotifications, markAllStaffNotificationsRead, markStaffNotificationRead } from "@/lib/booking-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return Response.json({ error: "Admin authentication required." }, { status: 401 });
  return Response.json(getStaffNotifications(), { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) return Response.json({ error: "Admin authentication required." }, { status: 401 });
  let body: { id?: unknown; action?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid notification action." }, { status: 400 }); }
  if (body.action === "clear") {
    clearStaffNotifications();
    return Response.json({ cleared: true, ...getStaffNotifications() }, { headers: { "Cache-Control": "no-store" } });
  }
  if (body.action === "read-all") {
    markAllStaffNotificationsRead();
    return Response.json({ markedRead: true, ...getStaffNotifications() }, { headers: { "Cache-Control": "no-store" } });
  }
  const id = Number(body.id);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Choose a valid notification." }, { status: 400 });
  if (!markStaffNotificationRead(id)) return Response.json({ error: "Notification not found." }, { status: 404 });
  return Response.json({ markedRead: true, ...getStaffNotifications() }, { headers: { "Cache-Control": "no-store" } });
}
