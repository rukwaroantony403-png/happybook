import { getPublicHotelSnapshot, getRoomAvailabilityStatus } from "@/lib/booking-store";
import { validDate, validStay } from "@/lib/stay-dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const hasDates = Boolean(checkIn || checkOut);
  const guests = Number(searchParams.get("guests") || "2");
  if (hasDates && (!validDate(checkIn) || !validDate(checkOut) || !validStay(checkIn, checkOut) || !Number.isInteger(guests) || guests < 1 || guests > 20)) {
    return Response.json({ error: "Provide valid future check-in and check-out dates and a guest count from 1 to 20." }, { status: 400 });
  }
  const snapshot = getPublicHotelSnapshot();
  const siteUrl = new URL(process.env.HOTEL_SITE_URL || "https://booking.happylandhoteldiani.co.ke");
  const absoluteAssetUrl = (asset: string) => asset.startsWith("/") && !asset.startsWith("//")
    ? new URL(asset, siteUrl).toString()
    : asset;
  // Keep room categories with no physical units in staff records for history,
  // but never publish them as bookable room types on the visitor website.
  const rooms = snapshot.rooms.filter((room) => room.inventory > 0).map((room) => ({
    ...room,
    image: room.image ? absoluteAssetUrl(room.image) : "",
    imageUrl: room.imageUrl ? absoluteAssetUrl(room.imageUrl) : "",
    images: room.images.map(absoluteAssetUrl),
  }));
  const property = {
    ...snapshot.property,
    logo: absoluteAssetUrl(snapshot.property.logo),
    heroImage: absoluteAssetUrl(snapshot.property.heroImage),
  };
  if (hasDates) {
    const availability = new Map(getRoomAvailabilityStatus(checkIn!, checkOut!, guests).map((room) => [room.slug, room] as const));
    const roomsWithAvailability = rooms.map((room) => {
      const result = availability.get(room.slug);
      return { ...room, availability: { status: !result?.guestLimitMet ? "guest-limit-exceeded" : result.availableUnits > 0 ? "available" : "unavailable", availableUnits: result?.availableUnits || 0, maxGuests: result?.maxGuests || room.maxGuests, checkIn, checkOut } };
    });
    return Response.json({ apiVersion: 1, updatedAt: new Date().toISOString(), ...snapshot, property, rooms: roomsWithAvailability }, {
      headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
    });
  }
  return Response.json({ apiVersion: 1, updatedAt: new Date().toISOString(), ...snapshot, property, rooms }, {
    headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
  });
}
