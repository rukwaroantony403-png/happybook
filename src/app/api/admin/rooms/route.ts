import { getStaffSession, isAdminRequest } from "@/lib/admin-auth";
import { deleteRoomCombination, deleteRoomUnit, getAdminSnapshot, RoomUnitDeleteError, saveRoomCombination, saveRoomConfig, saveRoomGallery, saveRoomUnit } from "@/lib/booking-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return Response.json({ error: "Admin authentication required." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid room details." }, { status: 400 }); }
  if (body.action === "update-gallery") {
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const images = Array.isArray(body.images) ? body.images : [];
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    const validImage = (image: unknown) => typeof image === "string" && image.length <= 1000 && (image.startsWith("/") && !image.startsWith("//") || /^https:\/\//i.test(image));
    if (!/^[a-z0-9-]{2,60}$/.test(slug) || images.length > 12 || !images.every(validImage) || (imageUrl && (!validImage(imageUrl) || !images.includes(imageUrl))) || (!imageUrl && images.length > 0)) {
      return Response.json({ error: "Choose up to 12 valid photo URLs and select one of them as the main image." }, { status: 400 });
    }
    try {
      saveRoomGallery(slug, images as string[], imageUrl);
      return Response.json({ saved: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof Error && error.message === "Room category not found.") return Response.json({ error: error.message }, { status: 404 });
      console.error("Could not save shared room photo gallery", error);
      return Response.json({ error: "Shared room photo gallery could not be saved." }, { status: 500 });
    }
  }
  if (body.action === "save-combination") {
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const unitIds = Array.isArray(body.unitIds) ? body.unitIds.map(Number) : [];
    const maxGuests = Number(body.maxGuests);
    const nightlyRateKsh = Number(body.nightlyRateKsh);
    const weeklyRatesKsh = Array.isArray(body.weeklyRatesKsh) ? body.weeklyRatesKsh.map(Number) : [];
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const bedCount = Number(body.bedCount || 0);
    const bedConfiguration = typeof body.bedConfiguration === "string" ? body.bedConfiguration.trim() : "";
    const amenities = Array.isArray(body.amenities) ? body.amenities : [];
    if (!/^[a-z0-9-]{2,60}$/.test(slug) || name.length < 2 || name.length > 100 ||
        displayName.length < 2 || displayName.length > 120 ||
        unitIds.length < 2 || unitIds.length > 10 || !unitIds.every((id) => Number.isSafeInteger(id) && id > 0) ||
        !Number.isInteger(maxGuests) || maxGuests < 1 || maxGuests > 20 ||
        !Number.isSafeInteger(nightlyRateKsh) || nightlyRateKsh < 1 || nightlyRateKsh > 100000000 ||
        weeklyRatesKsh.length !== 7 || !weeklyRatesKsh.every((rate) => Number.isSafeInteger(rate) && rate > 0 && rate <= 100000000) ||
        description.length > 3000 || !Number.isInteger(bedCount) || bedCount < 0 || bedCount > 20 ||
        bedConfiguration.length > 160 || amenities.length > 24 ||
        !amenities.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 60)) {
      return Response.json({ error: "Enter a valid combination with two or more physical rooms, guest capacity, rates, and details." }, { status: 400 });
    }
    try {
      const combination = saveRoomCombination({
        slug, name, displayName, unitIds, maxGuests, nightlyRateKsh, weeklyRatesKsh,
        description, bedCount, bedConfiguration, amenities: amenities.map((item) => String(item).trim()),
      });
      return Response.json({ saved: true, combination }, { status: 200, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Combination could not be saved." }, { status: 400 });
    }
  }
  if (body.action === "update-unit") {
    const id = Number(body.id);
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const maxGuests = Number(body.maxGuests);
    const nightlyRateKsh = Number(body.nightlyRateKsh);
    const bedCount = Number(body.bedCount);
    const bedConfiguration = typeof body.bedConfiguration === "string" ? body.bedConfiguration.trim() : "";
    const weeklyRatesKsh = Array.isArray(body.weeklyRatesKsh) ? body.weeklyRatesKsh.map(Number) : [];
    const shortDescription = typeof body.shortDescription === "string" ? body.shortDescription.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const amenities = Array.isArray(body.amenities) ? body.amenities : [];
    const operationalStatus = body.operationalStatus;
    const validStatuses = ["available", "dirty", "maintenance", "out-of-service", "blocked"];
    if (!Number.isSafeInteger(id) || id < 1 || !/^[A-Za-z0-9][A-Za-z0-9 -]{0,99}$/.test(code) || !Number.isInteger(maxGuests) || maxGuests < 1 || maxGuests > 20 || !Number.isSafeInteger(nightlyRateKsh) || nightlyRateKsh < 1 || nightlyRateKsh > 100000000 || !Number.isInteger(bedCount) || bedCount < 0 || bedCount > 20 || bedConfiguration.length > 160 || !validStatuses.includes(String(operationalStatus)) || weeklyRatesKsh.length !== 7 || !weeklyRatesKsh.every((rate) => Number.isSafeInteger(rate) && rate >= 1 && rate <= 100000000) || shortDescription.length > 240 || description.length > 3000 || amenities.length > 24 || !amenities.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 60)) {
      return Response.json({ error: "Enter a valid room number, capacity, rate, beds, and details." }, { status: 400 });
    }
    try {
      const room = saveRoomUnit({ id, code, maxGuests, nightlyRateKsh, weeklyRatesKsh, bedCount, bedConfiguration, shortDescription, description, amenities: amenities.map((item) => String(item).trim()), operationalStatus: operationalStatus as "available" | "dirty" | "maintenance" | "out-of-service" | "blocked" });
      return Response.json({ saved: true, room }, { status: 200, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Room could not be saved." }, { status: 400 });
    }
  }
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const inventory = Number(body.inventory);
  const maxGuests = Number(body.maxGuests);
  const nightlyRateKsh = Number(body.nightlyRateKsh);
  const abbreviation = typeof body.abbreviation === "string" ? body.abbreviation.trim() : "";
  const weeklyRatesKsh = Array.isArray(body.weeklyRatesKsh) ? body.weeklyRatesKsh.map(Number) : Array(7).fill(nightlyRateKsh);
  const bedCount = Number(body.bedCount);
  const bedConfiguration = typeof body.bedConfiguration === "string" ? body.bedConfiguration.trim() : "";
  const shortDescription = typeof body.shortDescription === "string" ? body.shortDescription.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const images = Array.isArray(body.images) ? body.images : [];
  const amenities = Array.isArray(body.amenities) ? body.amenities : [];
  const validImage = (image: unknown) => typeof image === "string" && image.length <= 1000 && (!image || image.startsWith("/") && !image.startsWith("//") || /^https:\/\//i.test(image));
  const invalidFields: string[] = [];
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) invalidFields.push("room category");
  if (name.length < 2 || name.length > 100) invalidFields.push("name");
  if (abbreviation.length > 40) invalidFields.push("short name");
  if (!Number.isInteger(inventory) || inventory < 0 || inventory > 10000) invalidFields.push("inventory");
  if (!Number.isInteger(maxGuests) || maxGuests < 1 || maxGuests > 20) invalidFields.push("guest capacity");
  if (!Number.isSafeInteger(nightlyRateKsh) || nightlyRateKsh < 1 || nightlyRateKsh > 100000000) invalidFields.push("nightly rate");
  if (weeklyRatesKsh.length !== 7 || !weeklyRatesKsh.every((rate) => Number.isSafeInteger(rate) && rate >= 1 && rate <= 100000000)) invalidFields.push("rates for each day");
  if (!Number.isInteger(bedCount) || bedCount < 0 || bedCount > 20) invalidFields.push("number of beds");
  if (bedConfiguration.length > 160) invalidFields.push("bed layout");
  if (shortDescription.length > 240) invalidFields.push("short description");
  if (description.length > 3000) invalidFields.push("description");
  if (!validImage(imageUrl)) invalidFields.push("main image URL");
  if (images.length > 12 || !images.every(validImage)) invalidFields.push("gallery image URLs (up to 12)");
  if (amenities.length > 24 || !amenities.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 60)) invalidFields.push("amenities");
  if (invalidFields.length) {
    return Response.json({ error: `Check these room fields: ${invalidFields.join(", ")}.` }, { status: 400 });
  }
  try {
    saveRoomConfig({ slug, name, abbreviation, inventory, maxGuests, nightlyRateKsh, weeklyRatesKsh, bedCount, bedConfiguration, shortDescription, description, imageUrl, images: images as string[], amenities: amenities.map((item) => String(item).trim()) });
    return Response.json({ saved: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not save room settings", error);
    return Response.json({ error: "Room settings could not be saved." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return Response.json({ error: "Admin authentication required." }, { status: 401 });
  const { rooms, roomUnits, combinations } = getAdminSnapshot();
  return Response.json({ rooms, roomUnits, combinations }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const staff = getStaffSession(request);
  if (!staff) return Response.json({ error: "Staff authentication required." }, { status: 401 });
  if (staff.role === "manager") return Response.json({ error: "Managers cannot remove rooms or combinations." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const combination = searchParams.get("combination");
  if (combination) {
    try {
      deleteRoomCombination(combination);
      return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const status = error instanceof RoomUnitDeleteError ? error.status : 500;
      if (status === 500) console.error("Could not remove room combination", error);
      return Response.json({ error: error instanceof Error ? error.message : "Combination could not be removed." }, { status });
    }
  }
  const id = Number(searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Choose a valid physical room." }, { status: 400 });
  try {
    const room = deleteRoomUnit(id);
    return Response.json({ deleted: true, room }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RoomUnitDeleteError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Could not remove room", error);
    return Response.json({ error: "Room could not be removed." }, { status: 500 });
  }
}
