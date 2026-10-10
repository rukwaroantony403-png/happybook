import { BookingError, createBooking } from "@/lib/booking-store";
import { sendBookingEmails } from "@/lib/notifications";
import { validDate, validStay } from "@/lib/stay-dates";

export const runtime = "nodejs";
const publicHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

export async function OPTIONS() { return new Response(null, { status: 204, headers: publicHeaders }); }

export async function POST(request: Request) {
  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const roomSlug = typeof data.roomSlug === "string" ? data.roomSlug : "";
  const checkIn = data.checkIn;
  const checkOut = data.checkOut;
  const guests = Number(data.guests);
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";
  const source = typeof data.source === "string" ? data.source.trim() : "Website";
  const allowedSources = ["Direct", "Website", "Airbnb", "Booking.com", "Expedia", "Walk-in", "Phone", "WhatsApp", "Travel Agent", "Corporate", "Other"];
  if (!/^[a-z0-9-]{2,60}$/.test(roomSlug) || !validDate(checkIn) || !validDate(checkOut) || !validStay(checkIn, checkOut) || !Number.isInteger(guests) || guests < 1 || guests > 20 || name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || phone.length < 1 || phone.length > 40 || !allowedSources.includes(source)) {
    return Response.json({ error: "Check the dates and guest details, then try again." }, { status: 400 });
  }

  try {
    const booking = createBooking({ roomSlug, checkIn, checkOut, guests, name, email, phone, source });
    let emailSent = false;
    try {
      emailSent = await sendBookingEmails({ ...booking, checkIn, checkOut, guests, name, email });
    } catch (error) {
      console.error("Reservation saved; email delivery failed", error);
    }
    return Response.json({
      reservation: {
        reference: booking.reference,
        status: booking.status,
        roomName: booking.roomName,
        checkIn,
        checkOut,
        guests,
        nights: booking.nights,
        nightlyRateKsh: booking.nightlyRateKsh,
        totalKsh: booking.totalKsh,
        name,
        email,
        source,
      },
      emailSent,
    }, { status: 201, headers: { ...publicHeaders, "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BookingError) {
      const status = error.code === "NO_AVAILABILITY" ? 409 : 422;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    console.error("Booking could not be saved", error);
    return Response.json({ error: "We could not save this reservation. Please try again or contact the hotel." }, { status: 500 });
  }
}
