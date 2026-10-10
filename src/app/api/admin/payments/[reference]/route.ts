import { canVerifyPayments, getStaffSession } from "@/lib/admin-auth";
import { deleteHotelPaymentRecord, verifyHotelPayment } from "@/lib/booking-store";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: RouteContext<"/api/admin/payments/[reference]">) {
  const staff = getStaffSession(request);
  if (!staff) return Response.json({ error: "Staff authentication required." }, { status: 401 });
  if (staff.role !== "admin") return Response.json({ error: "Only administrators can permanently delete payment records." }, { status: 403 });
  const { reference } = await context.params;
  try {
    if (!deleteHotelPaymentRecord(reference, staff.fullName)) return Response.json({ error: "Payment not found." }, { status: 404 });
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not delete payment record", error);
    return Response.json({ error: "Payment could not be deleted." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/admin/payments/[reference]">) {
  const staff = getStaffSession(request);
  if (!staff) return Response.json({ error: "Staff authentication required." }, { status: 401 });
  if (!canVerifyPayments(staff.role)) return Response.json({ error: "Receptionists cannot verify or reject payments." }, { status: 403 });
  const { reference } = await context.params;
  let body: { decision?: unknown; rejectionReason?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Provide the verifier." }, { status: 400 }); }
  const decision = body.decision === undefined ? "verify" : body.decision;
  if (decision !== "verify" && decision !== "reject") return Response.json({ error: "Choose whether to verify or reject this payment." }, { status: 400 });
  const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason : "";
  const result = verifyHotelPayment(reference, staff.fullName, decision, rejectionReason);
  return result.ok
    ? Response.json({ reviewed: decision }, { headers: { "Cache-Control": "no-store" } })
    : Response.json({ error: result.reason }, { status: 409 });
}
