import { extname, join } from "node:path";
import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { roomCategoryMediaDirectory, roomMediaRoot } from "@/lib/room-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const imageTypes: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif" };

export async function GET(_request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  let imagePath: string;
  let filename: string;
  if (path.length === 1) {
    [filename] = path;
    if (!/^[a-f0-9]{32}\.(jpg|png|webp|avif)$/.test(filename)) return new Response("Not found", { status: 404 });
    imagePath = join(/*turbopackIgnore: true*/ roomMediaRoot(), filename);
  } else if (path.length === 2) {
    const [category, categoryFilename] = path;
    filename = categoryFilename;
    if (!/^[a-z0-9-]{2,60}$/.test(category) || !/^[a-f0-9]{32}\.(jpg|png|webp|avif)$/.test(filename)) return new Response("Not found", { status: 404 });
    imagePath = join(/*turbopackIgnore: true*/ roomCategoryMediaDirectory(category), filename);
  } else return new Response("Not found", { status: 404 });

  const contentType = imageTypes[extname(filename)];
  if (!contentType) return new Response("Not found", { status: 404 });
  try {
    const image = await readFile(imagePath);
    return new Response(new Uint8Array(image), { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
