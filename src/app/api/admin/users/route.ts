import { getStaffSession } from "@/lib/admin-auth";
import { AdminAccountLimitError, createStaffUser, listStaffUsers, type StaffRole } from "@/lib/booking-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roles: StaffRole[] = ["admin", "manager", "receptionist", "controller", "chief-accountant"];

export async function GET(request: Request) {
  const staff = getStaffSession(request);
  if (!staff) return Response.json({ error: "Staff authentication required." }, { status: 401 });
  if (staff.role !== "admin") return Response.json({ error: "Only administrators can manage staff accounts." }, { status: 403 });
  const users = listStaffUsers();
  if (staff.id === "development-admin") {
    users.unshift({ id: "development-admin", username: "admin", fullName: "Local Administrator", role: "admin" });
  } else if (process.env.ADMIN_PASSWORD && !users.some((user) => user.username.toLowerCase() === (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase())) {
    users.unshift({ id: "bootstrap-admin", username: (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase(), fullName: process.env.ADMIN_NAME?.trim() || "Hotel Administrator", role: "admin" });
  }
  return Response.json({ users }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const staff = getStaffSession(request);
  if (!staff) return Response.json({ error: "Staff authentication required." }, { status: 401 });
  if (staff.role !== "admin") return Response.json({ error: "Only administrators can create staff accounts." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Enter valid staff account details." }, { status: 400 }); }
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role;
  if (!/^[a-z0-9._-]{3,40}$/.test(username) || fullName.length < 2 || fullName.length > 100 || typeof role !== "string" || !roles.includes(role as StaffRole) || password.length < 12 || password.length > 128 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
    return Response.json({ error: "Use a valid username and name, choose a role, and set a password with at least 12 characters including a number." }, { status: 400 });
  }
  if (username === (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase()) {
    return Response.json({ error: "That username is reserved for the server-configured administrator." }, { status: 409 });
  }
  try {
    const user = createStaffUser({ username, fullName, role: role as StaffRole, password }, staff.fullName);
    return Response.json({ user }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminAccountLimitError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed: staff_users.username")) {
      return Response.json({ error: "That username is already in use." }, { status: 409 });
    }
    console.error("Could not create staff account", error);
    return Response.json({ error: "Staff account could not be created." }, { status: 500 });
  }
}
