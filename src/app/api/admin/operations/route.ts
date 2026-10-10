import { getAdminSnapshot, getAuditTrail, getDashboardSnapshot, getFinancialRecords, getInventoryMovements, getStaffNotifications, listOperationalRecords, saveOperationalRecord } from "@/lib/booking-store";
import { getStaffSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const kinds = ["room", "guest", "payment", "housekeeping", "maintenance", "service", "expense", "supplier", "inventory", "settings"] as const;
type Kind = typeof kinds[number];

export async function GET(request: Request) {
  const staff = getStaffSession(request);
  if (!staff) return Response.json({ error: "Staff authentication required." }, { status: 401 });
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind === "settings" && staff.role !== "admin") return Response.json({ error: "Only administrators can access settings." }, { status: 403 });
  if (kind === "all") {
    const visibleKinds = kinds.filter((key) => key !== "settings" || staff.role === "admin");
    return Response.json({ ...getAdminSnapshot(), ...getStaffNotifications(), staff, dashboard: getDashboardSnapshot(), records: Object.fromEntries(visibleKinds.map((key) => [key, listOperationalRecords(key)])), inventoryMovements: getInventoryMovements(), financial: getFinancialRecords(), audit: getAuditTrail() }, { headers: { "Cache-Control": "no-store" } });
  }
  if (kind === "financial") return Response.json(getFinancialRecords(), { headers: { "Cache-Control": "no-store" } });
  if (kind === "audit") return Response.json({ records: getAuditTrail() }, { headers: { "Cache-Control": "no-store" } });
  if (!kind || !kinds.includes(kind as Kind)) return Response.json({ error: "Choose a valid operations record type." }, { status: 400 });
  return Response.json({ records: listOperationalRecords(kind as Kind) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const staff = getStaffSession(request);
  if (!staff) return Response.json({ error: "Staff authentication required." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid record." }, { status: 400 }); }
  const kind = body.kind;
  if (typeof kind !== "string" || !kinds.includes(kind as Kind) || !body.record || typeof body.record !== "object" || Array.isArray(body.record)) return Response.json({ error: "Choose a record type and provide a record." }, { status: 400 });
  if (kind === "settings" && staff.role !== "admin") return Response.json({ error: "Only administrators can change settings." }, { status: 403 });
  const record = body.record as Record<string, unknown>;
  if (Object.keys(record).length > 60 || JSON.stringify(record).length > 30000) return Response.json({ error: "Record is too large." }, { status: 413 });
  const name = String(record.name || "").trim();
  const required = (field: string) => typeof record[field] === "string" && String(record[field]).trim().length > 0;
  const amount = Number(record.amountKsh);
  const quantity = Number(record.quantity);
  const reorderAt = Number(record.reorderAt);
  const unitCost = Number(record.unitCostKsh);
  if (kind === "room") return Response.json({ error: "Save room inventory through the room setup endpoint." }, { status: 400 });
  if (kind === "guest" && (!name || name.length > 120 || !required("email") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(record.email).trim()) || String(record.email).trim().length > 254 || String(record.phone || "").length > 40 || String(record.nationality || "").length > 100 || String(record.idDocument || "").length > 200 || String(record.preferences || "").length > 500 || String(record.notes || "").length > 1000)) return Response.json({ error: "Enter a valid guest name, email and profile details." }, { status: 400 });
  if (kind === "expense" && (!name || name.length > 200 || !Number.isSafeInteger(amount) || amount < 1 || amount > 100000000 || !required("category"))) return Response.json({ error: "Enter an expense description, category and valid KSh amount." }, { status: 400 });
  if (kind === "inventory" && (!name || name.length > 200 || !required("category") || !required("unit") || String(record.unit).length > 40 || String(record.sku || "").length > 80 || String(record.description || "").length > 500 || String(record.supplier || "").length > 200 || !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 1000000 || !Number.isSafeInteger(reorderAt) || reorderAt < 0 || reorderAt > 1000000 || !Number.isSafeInteger(unitCost) || unitCost < 0 || unitCost > 100000000)) return Response.json({ error: "Enter a valid item name, category, unit, quantity, reorder level and unit cost." }, { status: 400 });
  if (kind === "supplier" && (!name || name.length > 200)) return Response.json({ error: "Enter a supplier name." }, { status: 400 });
  if (kind === "housekeeping" && (
    !required("room") ||
    !required("task") ||
    String(record.task).trim().length > 160 ||
    String(record.assignedTo || "").length > 120 ||
    String(record.description || "").length > 1000 ||
    (record.dueDate !== undefined && record.dueDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(String(record.dueDate))) ||
    (record.priority !== undefined && !["normal", "high", "urgent"].includes(String(record.priority)))
  )) return Response.json({ error: "Enter a valid room number, task, priority, and assignment." }, { status: 400 });
  if (kind === "maintenance" && (!required("room") || (!required("issue") && !required("description")))) return Response.json({ error: "Enter a room and maintenance issue." }, { status: 400 });
  try {
    const saved = saveOperationalRecord(kind as Kind, record, staff.fullName);
    return Response.json({ saved }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not save operations record", error);
    return Response.json({ error: error instanceof Error ? error.message : "Record could not be saved." }, { status: error instanceof Error ? 422 : 500 });
  }
}
