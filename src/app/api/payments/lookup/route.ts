import { getGuestPaymentSummary, GuestPaymentError } from "@/lib/booking-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid booking lookup." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid booking lookup." }, { status: 400 });
  }
  try {
    const booking = getGuestPaymentSummary(body);
    return Response.json({ booking }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GuestPaymentError) return Response.json({ error: error.message }, { status: 422 });
    console.error("Could not look up guest payment balance", error);
    return Response.json({ error: "Booking balance could not be loaded. Please try again." }, { status: 500 });
  }
}
