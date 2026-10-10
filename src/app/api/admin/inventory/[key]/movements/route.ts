import { getStaffSession } from "@/lib/admin-auth";
import { moveInventoryStock } from "@/lib/booking-store";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/admin/inventory/[key]/movements">) {
  const staff = getStaffSession(request);
  if (!staff) return Response.json({ error: "Staff authentication required." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid stock movement." }, { status: 400 });
  }

  const movementType = body.movementType;
  const quantity = Number(body.quantity);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";
  if (!["receive", "issue", "adjustment"].includes(String(movementType)) ||
    !Number.isSafeInteger(quantity) || quantity === 0 || Math.abs(quantity) > 1000000 ||
    reason.length < 2 || reason.length > 500 || reference.length > 120) {
    return Response.json({ error: "Enter a movement type, valid quantity and reason." }, { status: 400 });
  }

  try {
    const updated = moveInventoryStock(
      (await context.params).key,
      movementType as "receive" | "issue" | "adjustment",
      quantity,
      reason,
      staff.fullName,
      reference,
    );
    return Response.json({ updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stock movement could not be saved.";
    return Response.json({ error: message }, { status: message === "Inventory item not found." ? 404 : 422 });
  }
}
