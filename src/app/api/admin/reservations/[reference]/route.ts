import { getStaffSession, isAdminRequest } from "@/lib/admin-auth";
import { cancelReservation, updateReservationStatus } from "@/lib/booking-store";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: RouteContext<"/api/admin/reservations/[reference]">) {
  const staff = getStaffSession(request);
  if (!staff) return Response.json({ error: "Staff authentication required." }, { status: 401 });
  if (staff.role === "manager") return Response.json({ error: "Managers cannot delete reservations." }, { status: 403 });
  const { reference } = await context.params;
  const cancelled = cancelReservation(reference);
  if (!cancelled) return Response.json({ error: "Reservation not found or is no longer active." }, { status: 404 });
  return Response.json({ cancelled: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: RouteContext<"/api/admin/reservations/[reference]">) {
  if (!isAdminRequest(request)) return Response.json({ error: "Admin authentication required." }, { status: 401 });
  const { reference } = await context.params;
  let body: { status?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid status." }, { status: 400 }); }
  if (typeof body.status !== "string" || !updateReservationStatus(reference, body.status.toLowerCase().replaceAll(" ", "-"))) return Response.json({ error: "Reservation not found or status is not supported." }, { status: 404 });
  return Response.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
}
