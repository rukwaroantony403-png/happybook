import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { isAdminRequest } from "@/lib/admin-auth";
import { roomCategoryMediaDirectory } from "@/lib/room-media";
import { getAdminSnapshot, saveRoomConfig } from "@/lib/booking-store";

export const runtime = "nodejs";

const mimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return Response.json({ error: "Admin authentication required." }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: "Choose an image to upload." }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose an image to upload." }, { status: 400 });
  const category = String(form.get("category") || "");
  const supportedCategories: Record<string, { name: string; abbreviation: string }> = { studio: { name: "Studio", abbreviation: "STD" }, "1-bedroom": { name: "1-bedroom", abbreviation: "1BR" }, "2-bedroom": { name: "2-bedroom", abbreviation: "2BR" }, "3-bedroom": { name: "3-bedroom", abbreviation: "3BR" } };
  if (!/^[a-z0-9-]{2,60}$/.test(category)) return Response.json({ error: "Choose a valid room category for this photo." }, { status: 400 });
  const existing = (getAdminSnapshot().rooms as Record<string, unknown>[]).find((room) => room.slug === category);
  if (!existing && !supportedCategories[category]) return Response.json({ error: "Choose one of the supported room categories." }, { status: 400 });
  const categoryConfig = existing as Parameters<typeof saveRoomConfig>[0] | undefined;
  const categoryName = String(existing?.name || supportedCategories[category].name);
  const currentImages = Array.isArray(existing?.images) ? existing.images as string[] : [];
  if (currentImages.length >= 12) return Response.json({ error: "A room category can have up to 12 shared photos." }, { status: 409 });

  const extension = mimeExtensions[file.type];
  if (!extension) return Response.json({ error: "Use a JPEG, PNG, WebP, or AVIF image." }, { status: 400 });
  if (file.size < 1 || file.size > 8 * 1024 * 1024) return Response.json({ error: "Room photos must be 8 MB or smaller." }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const signatureValid = extension === "jpg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : extension === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : extension === "webp" ? bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
        : bytes.toString("ascii", 4, 12).includes("ftypavif");
  if (!signatureValid) return Response.json({ error: "The image file could not be verified. Try another image." }, { status: 400 });

  const filename = `${randomBytes(16).toString("hex")}.${extension}`;
  const uploadDir = roomCategoryMediaDirectory(category);
  await mkdir(uploadDir, { recursive: true });
  const fullPath = join(/*turbopackIgnore: true*/ uploadDir, filename);
  await writeFile(fullPath, bytes, { flag: "wx" });
  const url = `/api/room-photos/${category}/${filename}`;
  const indexPath = join(/*turbopackIgnore: true*/ uploadDir, "index.json");
  let index: Record<string, string> = {};
  try { index = JSON.parse(await readFile(indexPath, "utf8")) as Record<string, string>; } catch { /* start a new media index */ }
  index[filename] = file.type;
  await writeFile(indexPath, JSON.stringify(index), "utf8");
  const images = [...currentImages, url];
  const imageUrl = currentImages.includes(String(existing?.imageUrl || "")) ? String(existing?.imageUrl) : images[0];
  saveRoomConfig({
    ...(categoryConfig || { slug: category, name: categoryName, inventory: 0, maxGuests: 2, nightlyRateKsh: 1, bedCount: 1, bedConfiguration: "1 double bed", weeklyRatesKsh: Array(7).fill(1), shortDescription: "", description: "", amenities: [] }),
    images,
    imageUrl,
  });
  return Response.json({ url }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
