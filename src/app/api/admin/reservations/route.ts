import { isAdminRequest } from "@/lib/admin-auth";
import { BookingError, createBooking } from "@/lib/booking-store";
import { validDate, validStay } from "@/lib/stay-dates";

export const runtime = "nodejs";

const allowedSources = ["Direct", "Website", "Airbnb", "Booking.com", "Expedia", "Walk-in", "Phone", "WhatsApp", "Travel Agent", "Corporate", "Other"];

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return Response.json({ error: "Admin authentication required." }, { status: 401 });

  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: "Invalid reservation details." }, { status: 400 });
  }

  const roomSlug = typeof data.roomSlug === "string" ? data.roomSlug.trim() : "";
  const checkIn = data.checkIn;
  const checkOut = data.checkOut;
  const guests = Number(data.guests);
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";
  const nationality = typeof data.nationality === "string" ? data.nationality.trim() : "";
  const idDocument = typeof data.idDocument === "string" ? data.idDocument.trim() : "";
  const preferences = typeof data.preferences === "string" ? data.preferences.trim() : "";
  const notes = typeof data.notes === "string" ? data.notes.trim() : "";
  const source = typeof data.source === "string" ? data.source.trim() : "Direct";

  if (
    !/^[a-z0-9-]{2,60}$/.test(roomSlug) ||
    !validDate(checkIn) ||
    !validDate(checkOut) ||
    !validStay(checkIn, checkOut) ||
    !Number.isInteger(guests) ||
    guests < 1 ||
    guests > 20 ||
    name.length < 2 ||
    name.length > 120 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    phone.length > 40 ||
    nationality.length > 100 ||
    idDocument.length > 200 ||
    preferences.length > 500 ||
    notes.length > 1000 ||
    !allowedSources.includes(source)
  ) {
    return Response.json({ error: "Check the stay dates and guest details, then try again." }, { status: 400 });
  }

  try {
    const booking = createBooking({ roomSlug, checkIn, checkOut, guests, name, email, phone, nationality, idDocument, preferences, notes, source });
    return Response.json({
      reservation: { ...booking, roomSlug, checkIn, checkOut, guests, name, email, phone, source },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BookingError) {
      const status = error.code === "NO_AVAILABILITY" ? 409 : 422;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    console.error("Reservation could not be saved", error);
    return Response.json({ error: "The reservation could not be saved. Please try again." }, { status: 500 });
  }
}
