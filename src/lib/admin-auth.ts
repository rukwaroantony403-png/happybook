import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { authenticateStaffUser, getStaffIdentity, type StaffIdentity, type StaffRole } from "@/lib/booking-store";
import { ADMIN_COOKIE, getAdminSessionIdFromCookie } from "@/lib/admin-session-token";

export { ADMIN_COOKIE };
const SESSION_SECONDS = 8 * 60 * 60;

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export function adminIsConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && sessionSecret());
}

export function authenticateStaff(username: string, password: string): StaffIdentity | null {
  const staff = authenticateStaffUser(username, password);
  if (staff) return staff;
  const adminUsername = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || username.trim().toLowerCase() !== adminUsername || !sessionSecret()) return null;
  const actualBytes = Buffer.from(password);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
    ? { id: "bootstrap-admin", username: adminUsername, fullName: process.env.ADMIN_NAME?.trim() || "Hotel Administrator", role: "admin" }
    : null;
}

export function createAdminSession(staff: Pick<StaffIdentity, "id">) {
  const secret = sessionSecret();
  if (!secret) throw new Error("Admin session secret is not configured.");
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${staff.id}.${expires}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return { value: `${payload}.${signature}`, maxAge: SESSION_SECONDS };
}

export function getStaffSession(request: Request): StaffIdentity | null {
  const secret = sessionSecret();
  const id = getAdminSessionIdFromCookie(request.headers.get("cookie"), secret);
  if (!id) return null;
  if (id === "bootstrap-admin") {
    const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
    return process.env.ADMIN_PASSWORD ? { id, username, fullName: process.env.ADMIN_NAME?.trim() || "Hotel Administrator", role: "admin" } : null;
  }
  return getStaffIdentity(id);
}

export function isAdminRequest(request: Request) {
  return getStaffSession(request) !== null;
}

export function canVerifyPayments(role: StaffRole) {
  return role === "admin" || role === "manager" || role === "chief-accountant";
}

export function adminCookieOptions(maxAge: number) {
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
