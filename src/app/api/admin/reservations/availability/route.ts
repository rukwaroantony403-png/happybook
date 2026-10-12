import { getStaffSession } from "@/lib/admin-auth";
import { getRoomAvailabilityStatus } from "@/lib/booking-store";
import { validDate, validStay } from "@/lib/stay-dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const staff = getStaffSession(request);
  if (!staff) return Response.json({ error: "Staff authentication required." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const guests = Number(searchParams.get("guests") || "2");
  if (!validDate(checkIn) || !validDate(checkOut) || !validStay(checkIn, checkOut) ||
    !Number.isInteger(guests) || guests < 1 || guests > 20) {
    return Response.json({ error: "Choose valid future check-in and check-out dates and a guest count from 1 to 20." }, { status: 400 });
  }

  try {
    const rooms = getRoomAvailabilityStatus(checkIn, checkOut, guests);
    return Response.json({ rooms }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not check staff room availability", error);
    return Response.json({ error: "Room availability could not be checked." }, { status: 500 });
  }
}
