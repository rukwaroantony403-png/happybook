import { GuestPaymentError, recordGuestMpesaPayment } from "@/lib/booking-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid payment submission." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid payment submission." }, { status: 400 });
  }
  try {
    const payment = recordGuestMpesaPayment(body);
    return Response.json({ payment }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GuestPaymentError) return Response.json({ error: error.message }, { status: 422 });
    console.error("Could not save guest-submitted payment", error);
    return Response.json({ error: "Your payment could not be submitted. Please contact the hotel." }, { status: 500 });
  }
}
