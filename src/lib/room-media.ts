import { dirname, join, resolve } from "node:path";

export function roomMediaRoot() {
  return process.env.HOTEL_MEDIA_PATH
    ? resolve(/*turbopackIgnore: true*/ process.env.HOTEL_MEDIA_PATH)
    : resolve(process.env.HOTEL_DATABASE_PATH
      ? join(/*turbopackIgnore: true*/ dirname(resolve(/*turbopackIgnore: true*/ process.env.HOTEL_DATABASE_PATH)), "room-media")
      : join(/*turbopackIgnore: true*/ process.cwd(), "data", "room-media"));
}

export function roomCategoryMediaDirectory(category: string) {
  if (!/^[a-z0-9-]{2,60}$/.test(category)) throw new Error("Invalid room category.");
  return join(/*turbopackIgnore: true*/ roomMediaRoot(), category);
}
