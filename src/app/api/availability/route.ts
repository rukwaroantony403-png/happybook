import { getRoomAvailability, isBookingConfigured } from "@/lib/booking-store";
import { validDate, validStay } from "@/lib/stay-dates";

export const runtime = "nodejs";
const publicHeaders = { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

export async function OPTIONS() { return new Response(null, { status: 204, headers: publicHeaders }); }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const guests = Number(searchParams.get("guests") || "2");
  if (!validDate(checkIn) || !validDate(checkOut) || !validStay(checkIn, checkOut) || !Number.isInteger(guests) || guests < 1 || guests > 20) {
    return Response.json({ error: "Choose future dates for a stay of 1 to 60 nights, and enter a valid guest count." }, { status: 400 });
  }
  const rooms = getRoomAvailability(checkIn!, checkOut!, guests);
  const configured = isBookingConfigured();
  return Response.json({
    apiVersion: 1,
    updatedAt: new Date().toISOString(),
    checkIn,
    checkOut,
    guests,
    configured,
    rooms: rooms.map((room) => ({ ...room, availability: { status: "available", availableUnits: room.availableUnits, checkIn, checkOut } })),
    message: !configured ? "The hotel has not configured room inventory and rates yet. Please contact the hotel directly." : rooms.length ? undefined : "No rooms are available for those dates and guest count.",
  }, { headers: publicHeaders });
}
