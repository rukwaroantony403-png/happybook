import { getStaffSession } from "@/lib/admin-auth";
import { cancelReservation, getReservationStatusEmail, updateReservationStatus } from "@/lib/booking-store";
import { sendReservationStatusEmail } from "@/lib/notifications";

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
  const staff = getStaffSession(request);
  if (!staff) return Response.json({ error: "Staff authentication required." }, { status: 401 });
  const { reference } = await context.params;
  let body: { status?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid status." }, { status: 400 }); }
  if (typeof body.status !== "string") return Response.json({ error: "Choose a valid next reservation status." }, { status: 400 });
  if (!updateReservationStatus(reference, body.status.toLowerCase().replaceAll(" ", "-"), staff.fullName)) {
    return Response.json({ error: "Reservation not found or this status change is not allowed from its current status." }, { status: 409 });
  }
  const reservation = getReservationStatusEmail(reference);
  let emailSent = false;
  if (reservation && ["confirmed", "cancelled"].includes(reservation.status)) {
    try {
      emailSent = await sendReservationStatusEmail(reservation);
    } catch (error) {
      console.error("Reservation updated; guest status email could not be sent", error);
    }
  }
  return Response.json({ updated: true, emailSent }, { headers: { "Cache-Control": "no-store" } });
}
