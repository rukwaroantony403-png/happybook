import { getStaffSession } from "@/lib/admin-auth";
import { deleteReservationRecord } from "@/lib/booking-store";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: RouteContext<"/api/admin/reservations/[reference]/purge">) {
  const staff = getStaffSession(request);
  if (!staff) return Response.json({ error: "Staff authentication required." }, { status: 401 });
  if (staff.role !== "admin") return Response.json({ error: "Only administrators can permanently delete reservations." }, { status: 403 });
  const { reference } = await context.params;
  try {
    const deleted = deleteReservationRecord(reference, staff.fullName);
    if (!deleted) return Response.json({ error: "Reservation not found." }, { status: 404 });
    return Response.json({ deleted: true, ...deleted }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not delete reservation record", error);
    return Response.json({ error: "Reservation could not be deleted." }, { status: 500 });
  }
}
