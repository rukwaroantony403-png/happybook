import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "happyland_admin";

export function getAdminSessionId(value: string | null | undefined, secret: string | null | undefined): string | null {
  if (!value || !secret || secret.length < 32) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const [id, expiresText, signature, ...extra] = decoded.split(".");
  const expires = Number(expiresText);
  if (!id || !/^[a-zA-Z0-9-]{1,100}$/.test(id) || extra.length ||
    !Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000) ||
    !signature || !/^[a-f0-9]{64}$/i.test(signature)) return null;
  const expected = createHmac("sha256", secret).update(`${id}.${expires}`).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) ? id : null;
}

export function getAdminSessionIdFromCookie(cookieHeader: string | null, secret: string | null | undefined): string | null {
  const value = cookieHeader?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);
  return getAdminSessionId(value, secret);
}
