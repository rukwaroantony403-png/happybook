import { isAdminRequest } from "@/lib/admin-auth";
import { getPaymentReceipt } from "@/lib/booking-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/admin/payments/[reference]/receipt">) {
  if (!isAdminRequest(request)) return Response.json({ error: "Admin authentication required." }, { status: 401 });
  const { reference } = await context.params;
  try {
    const receipt = getPaymentReceipt(reference);
    if (!receipt) return Response.json({ error: "Payment receipt not found." }, { status: 404 });
    return Response.json({ receipt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load payment receipt", error);
    return Response.json({ error: "Payment receipt could not be loaded." }, { status: 500 });
  }
}
