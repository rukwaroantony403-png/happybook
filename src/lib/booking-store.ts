import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { initialPhysicalRooms, initialRoomAmenities, initialRoomCategories, initialRoomCombinations } from "@/lib/initial-inventory";

type RoomConfig = {
  slug: string;
  name: string;
  inventory: number;
  maxGuests: number;
  nightlyRateKsh: number;
  abbreviation?: string;
  weeklyRatesKsh?: number[];
  bedCount?: number;
  bedConfiguration?: string;
  shortDescription?: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  amenities?: string[];
};

type RoomUnitDetails = Omit<RoomConfig, "slug" | "inventory" | "images" | "imageUrl"> & { operationalStatus?: RoomOperationalStatus };
type RoomUnitInput = { id: number; code: string; maxGuests: number; nightlyRateKsh: number; weeklyRatesKsh: number[]; bedCount: number; bedConfiguration: string; shortDescription: string; description: string; amenities: string[]; operationalStatus: RoomOperationalStatus };
type RoomOperationalStatus = "available" | "dirty" | "maintenance" | "out-of-service" | "blocked";
type RoomCombination = {
  slug: string;
  name: string;
  displayName: string;
  unitIds: number[];
  units: { id: number; code: string; slug: string; category: string }[];
  maxGuests: number;
  nightlyRateKsh: number;
  weeklyRatesKsh: number[];
  description: string;
  amenities: string[];
  bedCount: number;
  bedConfiguration: string;
  active: boolean;
};
type RoomCombinationInput = Omit<RoomCombination, "active" | "units">;

type BookingInput = {
  roomSlug: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  name: string;
  email: string;
  phone?: string;
  nationality?: string;
  idDocument?: string;
  preferences?: string;
  notes?: string;
  source?: string;
};

export type StaffRole = "admin" | "manager" | "receptionist" | "chief-accountant";
export type StaffIdentity = { id: string; username: string; fullName: string; role: StaffRole };

const databasePath = process.env.HOTEL_DATABASE_PATH
  ? resolve(/*turbopackIgnore: true*/ process.env.HOTEL_DATABASE_PATH)
  : resolve(process.cwd(), "data", "happyland.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec("PRAGMA journal_mode = WAL");
database.exec("PRAGMA foreign_keys = ON");
database.exec("PRAGMA busy_timeout = 5000");
database.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    inventory INTEGER NOT NULL CHECK (inventory >= 0),
    max_guests INTEGER NOT NULL CHECK (max_guests > 0),
    nightly_rate_ksh INTEGER NOT NULL CHECK (nightly_rate_ksh > 0),
    room_details TEXT NOT NULL DEFAULT '{}',
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
  );
  CREATE TABLE IF NOT EXISTS room_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_slug TEXT NOT NULL REFERENCES rooms(slug) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    unit_details TEXT NOT NULL DEFAULT '{}',
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT NOT NULL UNIQUE,
    room_slug TEXT NOT NULL REFERENCES rooms(slug),
    room_unit_id INTEGER REFERENCES room_units(id),
    accommodation_slug TEXT NOT NULL DEFAULT '',
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    guests INTEGER NOT NULL,
    guest_name TEXT NOT NULL,
    guest_email TEXT NOT NULL,
    guest_phone TEXT,
    nightly_rate_ksh INTEGER NOT NULL,
    total_ksh INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    source TEXT NOT NULL DEFAULT 'Website',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS reservations_dates ON reservations(room_slug, check_in, check_out, status);
  CREATE TABLE IF NOT EXISTS room_combinations (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    max_guests INTEGER NOT NULL CHECK (max_guests > 0),
    nightly_rate_ksh INTEGER NOT NULL CHECK (nightly_rate_ksh > 0),
    details TEXT NOT NULL DEFAULT '{}',
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
  );
  CREATE TABLE IF NOT EXISTS room_combination_units (
    combination_slug TEXT NOT NULL REFERENCES room_combinations(slug) ON DELETE CASCADE,
    room_unit_id INTEGER NOT NULL REFERENCES room_units(id),
    PRIMARY KEY (combination_slug, room_unit_id)
  );
  CREATE TABLE IF NOT EXISTS reservation_room_units (
    reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    room_unit_id INTEGER NOT NULL REFERENCES room_units(id),
    PRIMARY KEY (reservation_id, room_unit_id)
  );
  CREATE INDEX IF NOT EXISTS reservation_room_units_unit ON reservation_room_units(room_unit_id, reservation_id);
  CREATE TABLE IF NOT EXISTS enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_name TEXT NOT NULL,
    guest_email TEXT NOT NULL,
    guest_phone TEXT,
    preferred_dates TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS operational_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    record_key TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(kind, record_key)
  );
  CREATE TABLE IF NOT EXISTS guest_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    nationality TEXT,
    id_document TEXT,
    preferences TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_key TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'receptionist', 'chief-accountant')),
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS staff_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    entity_key TEXT NOT NULL DEFAULT '',
    dedupe_key TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TEXT,
    cleared_at TEXT
  );
  CREATE INDEX IF NOT EXISTS staff_notifications_feed ON staff_notifications(cleared_at, id DESC);
  CREATE TABLE IF NOT EXISTS hotel_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT NOT NULL UNIQUE,
    reservation_reference TEXT NOT NULL REFERENCES reservations(reference),
    amount_ksh INTEGER NOT NULL CHECK(amount_ksh > 0),
    method TEXT NOT NULL,
    transaction_reference TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    recorder TEXT NOT NULL,
    verifier TEXT,
    notes TEXT NOT NULL DEFAULT '',
    rejection_reason TEXT NOT NULL DEFAULT '',
    receipt_number TEXT,
    receipt_snapshot TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TEXT
  );
  CREATE TABLE IF NOT EXISTS folio_charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_reference TEXT NOT NULL REFERENCES reservations(reference),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_ksh INTEGER NOT NULL CHECK(amount_ksh >= 0),
    status TEXT NOT NULL DEFAULT 'posted',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const roomColumns = database.prepare("PRAGMA table_info(rooms)").all() as { name: string }[];
if (!roomColumns.some((column) => column.name === "room_details")) database.exec("ALTER TABLE rooms ADD COLUMN room_details TEXT NOT NULL DEFAULT '{}'");

const reservationColumns = database.prepare("PRAGMA table_info(reservations)").all() as { name: string }[];
if (!reservationColumns.some((column) => column.name === "source")) database.exec("ALTER TABLE reservations ADD COLUMN source TEXT NOT NULL DEFAULT 'Website'");
if (!reservationColumns.some((column) => column.name === "room_unit_id")) database.exec("ALTER TABLE reservations ADD COLUMN room_unit_id INTEGER REFERENCES room_units(id)");
if (!reservationColumns.some((column) => column.name === "accommodation_slug")) database.exec("ALTER TABLE reservations ADD COLUMN accommodation_slug TEXT NOT NULL DEFAULT ''");
database.exec(`
  UPDATE reservations SET accommodation_slug=room_slug WHERE accommodation_slug='';
  INSERT OR IGNORE INTO reservation_room_units(reservation_id,room_unit_id)
    SELECT id,room_unit_id FROM reservations WHERE room_unit_id IS NOT NULL
`);
const notificationColumns = database.prepare("PRAGMA table_info(staff_notifications)").all() as { name: string }[];
if (!notificationColumns.some((column) => column.name === "details")) database.exec("ALTER TABLE staff_notifications ADD COLUMN details TEXT NOT NULL DEFAULT '{}'");
if (!notificationColumns.some((column) => column.name === "dedupe_key")) database.exec("ALTER TABLE staff_notifications ADD COLUMN dedupe_key TEXT");
database.exec("CREATE UNIQUE INDEX IF NOT EXISTS staff_notifications_dedupe ON staff_notifications(dedupe_key)");
const paymentColumns = database.prepare("PRAGMA table_info(hotel_payments)").all() as { name: string }[];
if (!paymentColumns.some((column) => column.name === "rejection_reason")) database.exec("ALTER TABLE hotel_payments ADD COLUMN rejection_reason TEXT NOT NULL DEFAULT ''");
if (!paymentColumns.some((column) => column.name === "receipt_number")) database.exec("ALTER TABLE hotel_payments ADD COLUMN receipt_number TEXT");
if (!paymentColumns.some((column) => column.name === "receipt_snapshot")) database.exec("ALTER TABLE hotel_payments ADD COLUMN receipt_snapshot TEXT");
database.exec(`
  UPDATE hotel_payments SET receipt_number='HLD-' || strftime('%Y',created_at) || '-' || printf('%06d',id)
  WHERE receipt_number IS NULL OR receipt_number='';
  CREATE UNIQUE INDEX IF NOT EXISTS hotel_payments_receipt_number ON hotel_payments(receipt_number);
`);

function detailsForUnit(room: RoomConfig): RoomUnitDetails {
  return { name: room.name, maxGuests: room.maxGuests, nightlyRateKsh: room.nightlyRateKsh, abbreviation: room.abbreviation, weeklyRatesKsh: room.weeklyRatesKsh || Array(7).fill(room.nightlyRateKsh), bedCount: room.bedCount ?? 0, bedConfiguration: room.bedConfiguration || "", shortDescription: room.shortDescription || "", description: room.description || "", amenities: room.amenities || [], operationalStatus: "available" };
}

function synchronizeRoomUnits(slug: string, name: string, inventory: number, defaults: RoomUnitDetails) {
  const current = database.prepare("SELECT id FROM room_units WHERE room_slug=? AND active=1 ORDER BY id").all(slug) as { id: number }[];
  const baseCode = slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "ROOM";
  const existingCodes = new Set((database.prepare("SELECT code FROM room_units").all() as { code: string }[]).map((row) => row.code.toLowerCase()));
  for (const unit of current.slice(inventory)) database.prepare("UPDATE room_units SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(unit.id);
  for (let index = 0; index < Math.min(inventory, 10000); index += 1) {
    const existing = current[index];
    if (existing) {
      database.prepare("UPDATE room_units SET active=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(existing.id);
    } else {
      let sequence = index + 1;
      let code = `${baseCode}-${String(sequence).padStart(2, "0")}`;
      while (existingCodes.has(code.toLowerCase())) { sequence += 1; code = `${baseCode}-${String(sequence).padStart(2, "0")}`; }
      database.prepare("INSERT INTO room_units(room_slug,code,unit_details) VALUES(?,?,?)").run(slug, code, JSON.stringify({ ...defaults, name }));
      existingCodes.add(code.toLowerCase());
    }
  }
}

function loadRoomConfig(): RoomConfig[] {
  const json = process.env.HOTEL_ROOMS_JSON;
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((room): room is RoomConfig =>
      typeof room?.slug === "string" && /^[a-z0-9-]{2,60}$/.test(room.slug) &&
      typeof room.name === "string" && room.name.length > 0 && room.name.length <= 100 &&
      Number.isSafeInteger(room.inventory) && room.inventory >= 0 && room.inventory <= 10000 &&
      Number.isSafeInteger(room.maxGuests) && room.maxGuests >= 1 && room.maxGuests <= 20 &&
      Number.isSafeInteger(room.nightlyRateKsh) && room.nightlyRateKsh > 0 && room.nightlyRateKsh <= 100000000
    );
  } catch {
    return [];
  }
}

const roomConfigs = loadRoomConfig();
const updateRoom = database.prepare(`
  INSERT INTO rooms (slug, name, inventory, max_guests, nightly_rate_ksh, room_details, active)
  VALUES (@slug, @name, @inventory, @maxGuests, @nightlyRateKsh, @roomDetails, 1)
  ON CONFLICT(slug) DO UPDATE SET name=excluded.name, inventory=excluded.inventory,
    max_guests=excluded.max_guests, nightly_rate_ksh=excluded.nightly_rate_ksh,
    room_details=excluded.room_details, active=1
`);
const deactivateMissing = database.prepare("UPDATE rooms SET active = 0");
const configuredRooms = roomConfigs;
if (configuredRooms.length) {
  database.exec("BEGIN IMMEDIATE");
  try {
    deactivateMissing.run();
    for (const room of configuredRooms) {
      updateRoom.run({
      slug: room.slug,
      name: room.name,
      inventory: room.inventory,
      maxGuests: room.maxGuests,
      nightlyRateKsh: room.nightlyRateKsh,
      roomDetails: JSON.stringify(room),
      });
      synchronizeRoomUnits(room.slug, room.name, room.inventory, detailsForUnit(room));
    }
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

for (const room of database.prepare("SELECT slug,name,inventory,max_guests AS maxGuests,nightly_rate_ksh AS nightlyRateKsh,room_details AS roomDetails FROM rooms").all() as (RoomConfig & { roomDetails: string })[]) {
  const count = (database.prepare("SELECT COUNT(*) AS count FROM room_units WHERE room_slug=?").get(room.slug) as { count: number }).count;
  if (!count && room.inventory > 0) {
    const saved = JSON.parse(room.roomDetails || "{}") as RoomConfig;
    synchronizeRoomUnits(room.slug, room.name, room.inventory, detailsForUnit({ ...saved, ...room }));
  }
}

const initialSeed = database.prepare("SELECT 1 FROM operational_records WHERE kind='settings' AND record_key='initial-room-inventory-seeded'").get();
const activeInventory = database.prepare("SELECT code FROM room_units WHERE active=1").all() as { code: string }[];
const activeCodes = new Set(activeInventory.map((unit) => unit.code));
const expectedCodes = initialPhysicalRooms.map((unit) => unit.code);
const needsCanonicalInventory = activeInventory.length !== expectedCodes.length || expectedCodes.some((code) => !activeCodes.has(code));
if (!initialSeed || needsCanonicalInventory) {
  const reservationCount = (database.prepare("SELECT COUNT(*) AS count FROM reservations").get() as { count: number }).count;
  const reconcileInventory = needsCanonicalInventory && reservationCount === 0;
  database.exec("BEGIN IMMEDIATE");
  try {
    if (reconcileInventory) {
      database.prepare("UPDATE room_units SET active=0,updated_at=CURRENT_TIMESTAMP WHERE active=1").run();
      database.prepare("UPDATE rooms SET active=0,inventory=0 WHERE active=1").run();
      for (const category of initialRoomCategories) {
        const defaults = initialPhysicalRooms.filter((unit) => unit.categorySlug === category.slug);
        const nightlyRateKsh = defaults[0].nightlyRateKsh;
        const maxGuests = defaults[0].maxGuests;
        const existingRoom = database.prepare("SELECT room_details AS roomDetails FROM rooms WHERE slug=?").get(category.slug) as { roomDetails: string } | undefined;
        const existingDetails: Partial<RoomConfig> = existingRoom ? JSON.parse(existingRoom.roomDetails) as RoomConfig : {};
        const roomDetails = {
          ...existingDetails,
          slug: category.slug,
          name: category.name,
          inventory: defaults.length,
          maxGuests,
          nightlyRateKsh,
          weeklyRatesKsh: Array(7).fill(nightlyRateKsh),
          shortDescription: existingDetails.shortDescription || category.description,
          description: existingDetails.description || category.description,
          images: existingDetails.images || [],
          imageUrl: existingDetails.imageUrl || "",
          amenities: existingDetails.amenities || [],
        };
        database.prepare(`INSERT INTO rooms(slug,name,inventory,max_guests,nightly_rate_ksh,room_details,active)
          VALUES(?,?,?,?,?,?,1)
          ON CONFLICT(slug) DO UPDATE SET inventory=excluded.inventory,max_guests=excluded.max_guests,
          nightly_rate_ksh=excluded.nightly_rate_ksh,room_details=excluded.room_details,active=1`)
          .run(category.slug, category.name, defaults.length, maxGuests, nightlyRateKsh, JSON.stringify(roomDetails));
        for (const unit of defaults) {
          const unitDetails: RoomUnitDetails = {
            name: unit.code,
            maxGuests: unit.maxGuests,
            nightlyRateKsh: unit.nightlyRateKsh,
            weeklyRatesKsh: Array(7).fill(unit.nightlyRateKsh),
            bedCount: 0,
            bedConfiguration: "",
            shortDescription: category.description,
            description: category.description,
            amenities: [],
            operationalStatus: "available",
          };
          database.prepare(`INSERT INTO room_units(room_slug,code,unit_details,active) VALUES(?,?,?,1)
            ON CONFLICT(code) DO UPDATE SET room_slug=excluded.room_slug,unit_details=excluded.unit_details,active=1`)
            .run(unit.categorySlug, unit.code, JSON.stringify(unitDetails));
        }
      }
    }

    const unitsByCode = new Map((database.prepare("SELECT id,code FROM room_units WHERE active=1").all() as { id: number; code: string }[]).map((unit) => [unit.code, unit.id]));
    const completeInventory = expectedCodes.every((code) => unitsByCode.has(code)) &&
      (database.prepare("SELECT COUNT(*) AS count FROM room_units WHERE active=1").get() as { count: number }).count === expectedCodes.length;
    for (const combination of initialRoomCombinations) {
      if (!completeInventory || (!reconcileInventory && database.prepare("SELECT 1 FROM room_combinations WHERE slug=?").get(combination.slug))) continue;
      const unitIds = combination.unitCodes.map((code) => unitsByCode.get(code));
      if (unitIds.some((id) => id === undefined)) continue;
      const details = { weeklyRatesKsh: Array(7).fill(combination.nightlyRateKsh), description: combination.description, amenities: [], bedCount: 0, bedConfiguration: "" };
      database.prepare(`INSERT INTO room_combinations(slug,name,display_name,max_guests,nightly_rate_ksh,details,active)
        VALUES(?,?,?,?,?,?,1)
        ON CONFLICT(slug) DO UPDATE SET name=excluded.name,display_name=excluded.display_name,
        max_guests=excluded.max_guests,nightly_rate_ksh=excluded.nightly_rate_ksh,details=excluded.details,active=1`)
        .run(combination.slug, combination.name, combination.displayName, combination.maxGuests, combination.nightlyRateKsh, JSON.stringify(details));
      if (reconcileInventory) database.prepare("DELETE FROM room_combination_units WHERE combination_slug=?").run(combination.slug);
      const insertUnit = database.prepare("INSERT INTO room_combination_units(combination_slug,room_unit_id) VALUES(?,?)");
      for (const unitId of unitIds as number[]) insertUnit.run(combination.slug, unitId);
    }
    if (completeInventory) database.prepare("INSERT OR IGNORE INTO operational_records(kind,record_key,payload) VALUES('settings','initial-room-inventory-seeded','{}')").run();
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

type RoomRow = { slug: string; name: string; inventory: number; max_guests: number; nightly_rate_ksh: number };

const listRooms = database.prepare("SELECT slug, name, inventory, max_guests, nightly_rate_ksh FROM rooms WHERE active=1 ORDER BY name");
const countUnassignedOverlaps = database.prepare("SELECT COUNT(*) AS count FROM reservations WHERE room_slug=? AND room_unit_id IS NULL AND status IN ('pending','confirmed','checked-in') AND check_in < ? AND check_out > ?");
const listActiveUnits = database.prepare(`SELECT u.id,u.code,u.unit_details AS unitDetails,r.slug,r.name,r.room_details AS roomDetails
  FROM room_units u JOIN rooms r ON r.slug=u.room_slug WHERE u.room_slug=? AND u.active=1 AND r.active=1 ORDER BY u.code`);
const listUnitOverlaps = database.prepare(`SELECT DISTINCT linked.room_unit_id AS unitId FROM (
    SELECT rr.room_unit_id, r.check_in, r.check_out, r.status FROM reservation_room_units rr JOIN reservations r ON r.id=rr.reservation_id
    UNION ALL
    SELECT r.room_unit_id, r.check_in, r.check_out, r.status FROM reservations r WHERE r.room_unit_id IS NOT NULL
  ) linked WHERE linked.status IN ('pending','confirmed','checked-in') AND linked.check_in < ? AND linked.check_out > ?`);

function parseUnit(unit: { id: number; code: string; unitDetails: string; slug: string; name: string; roomDetails: string }) {
  const details = JSON.parse(unit.unitDetails) as RoomUnitDetails;
  const category = JSON.parse(unit.roomDetails) as RoomConfig;
  return { id: unit.id, code: unit.code, slug: unit.slug, category: unit.name, name: String(details.name || unit.name), maxGuests: Number(details.maxGuests || 1), nightlyRateKsh: Number(details.nightlyRateKsh || 0), weeklyRatesKsh: details.weeklyRatesKsh || Array(7).fill(Number(details.nightlyRateKsh || 0)), bedCount: Number(details.bedCount ?? 0), bedConfiguration: String(details.bedConfiguration || ""), abbreviation: String(details.abbreviation || ""), shortDescription: String(details.shortDescription || ""), description: String(details.description || ""), amenities: details.amenities || [], operationalStatus: details.operationalStatus || "available", active: true, images: category.images || [], imageUrl: category.imageUrl || category.images?.[0] || "" };
}

function priceForStay(unit: { nightlyRateKsh: number; weeklyRatesKsh?: number[] }, checkIn: string, checkOut: string) {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  const nights = Math.round((end - start) / 86400000);
  if (!Number.isFinite(start) || nights < 1 || nights > 60) return { nights: 0, totalKsh: 0, nightlyRateKsh: unit.nightlyRateKsh };
  const rates = unit.weeklyRatesKsh?.length === 7 ? unit.weeklyRatesKsh : Array(7).fill(unit.nightlyRateKsh);
  let totalKsh = 0;
  for (let night = 0; night < nights; night += 1) {
    const weekday = (new Date(start + night * 86400000).getUTCDay() + 6) % 7;
    totalKsh += Number(rates[weekday] || unit.nightlyRateKsh);
  }
  return { nights, totalKsh, nightlyRateKsh: Math.round(totalKsh / nights) };
}

export function getRoomAvailability(checkIn: string, checkOut: string, guests: number) {
  return getRoomAvailabilityStatus(checkIn, checkOut, guests)
    .filter((room) => room.guestLimitMet && room.availableUnits > 0)
    .map(({ slug, name, type, availableUnits, nightlyRateKsh, maxGuests, unitOptions }) => ({
      slug,
      name,
      type,
      availableUnits,
      nightlyRateKsh: unitOptions[0]?.nightlyRateKsh || nightlyRateKsh,
      totalKsh: unitOptions[0]?.totalKsh || 0,
      nights: unitOptions[0]?.nights || 0,
      maxGuests,
    }));
}

type AvailabilityOption = ReturnType<typeof priceForStay> & {
  id?: number;
  code?: string;
  unitIds?: number[];
  maxGuests: number;
  bedCount: number;
  bedConfiguration: string;
};

type AccommodationAvailability = {
  slug: string;
  name: string;
  type: "room" | "combination";
  guestLimitMet: boolean;
  availableUnits: number;
  nightlyRateKsh: number;
  maxGuests: number;
  unitOptions: AvailabilityOption[];
};

function getPhysicalRoomAvailabilityStatus(checkIn: string, checkOut: string, guests: number): AccommodationAvailability[] {
  const overlappingUnitIds = new Set((listUnitOverlaps.all(checkOut, checkIn) as { unitId: number }[]).map((row) => Number(row.unitId)));
  return (listRooms.all() as RoomRow[]).map((room) => {
    const units = (listActiveUnits.all(room.slug) as { id: number; code: string; unit_details: string; unitDetails: string; slug: string; name: string; roomDetails: string }[]).map((unit) => parseUnit({ ...unit, unitDetails: unit.unitDetails || unit.unit_details }));
    const unassigned = (countUnassignedOverlaps.get(room.slug, checkOut, checkIn) as { count: number }).count;
    const eligible = units.filter((unit) => unit.maxGuests >= guests && unit.operationalStatus === "available" && !overlappingUnitIds.has(unit.id));
    const guestLimitMet = units.some((unit) => unit.maxGuests >= guests);
    return {
      slug: room.slug,
      name: room.name,
      type: "room" as const,
      guestLimitMet,
      availableUnits: guestLimitMet ? Math.max(0, eligible.length - unassigned) : 0,
      maxGuests: units.length ? Math.max(...units.map((unit) => unit.maxGuests)) : room.max_guests,
      nightlyRateKsh: guestLimitMet && eligible.length ? Math.min(...eligible.map((unit) => priceForStay(unit, checkIn, checkOut).nightlyRateKsh)) : room.nightly_rate_ksh,
      unitOptions: eligible.slice(Math.min(unassigned, eligible.length)).map((unit) => ({ id: unit.id, code: unit.code, ...priceForStay(unit, checkIn, checkOut), maxGuests: unit.maxGuests, bedCount: unit.bedCount, bedConfiguration: unit.bedConfiguration })).sort((a, b) => a.totalKsh - b.totalKsh || (a.code || "").localeCompare(b.code || "")),
    };
  });
}

function getRoomCombinationAvailabilityStatus(checkIn: string, checkOut: string, guests: number): AccommodationAvailability[] {
  const overlappingUnitIds = new Set((listUnitOverlaps.all(checkOut, checkIn) as { unitId: number }[]).map((row) => Number(row.unitId)));
  const combinations = database.prepare(`SELECT slug,name,display_name AS displayName,max_guests AS maxGuests,
    nightly_rate_ksh AS nightlyRateKsh,details FROM room_combinations WHERE active=1 ORDER BY name,slug`).all() as
    { slug: string; name: string; displayName: string; maxGuests: number; nightlyRateKsh: number; details: string }[];

  return combinations.map((combination) => {
    const details = JSON.parse(combination.details) as { weeklyRatesKsh?: number[]; description?: string; bedCount?: number; bedConfiguration?: string; amenities?: string[] };
    const units = database.prepare(`SELECT u.id,u.code,u.unit_details AS unitDetails,r.slug,r.name,r.room_details AS roomDetails
      FROM room_combination_units cu
      JOIN room_units u ON u.id=cu.room_unit_id AND u.active=1
      JOIN rooms r ON r.slug=u.room_slug AND r.active=1
      WHERE cu.combination_slug=? ORDER BY u.code`).all(combination.slug) as
      { id: number; code: string; unitDetails: string; slug: string; name: string; roomDetails: string }[];
    const componentUnits = units.map(parseUnit);
    const componentSlugs = new Set(componentUnits.map((unit) => unit.slug));
    const legacyConflict = Array.from(componentSlugs).some((slug) =>
      (countUnassignedOverlaps.get(slug, checkOut, checkIn) as { count: number }).count > 0);
    const configured = componentUnits.length >= 2 && componentUnits.length === (database.prepare("SELECT COUNT(*) AS count FROM room_combination_units WHERE combination_slug=?").get(combination.slug) as { count: number }).count;
    const guestLimitMet = guests <= combination.maxGuests;
    const available = configured && guestLimitMet && !legacyConflict &&
      componentUnits.every((unit) => unit.operationalStatus === "available" && !overlappingUnitIds.has(unit.id));
    const priceUnit = {
      nightlyRateKsh: combination.nightlyRateKsh,
      weeklyRatesKsh: details.weeklyRatesKsh,
    };
    const price = priceForStay(priceUnit, checkIn, checkOut);
    return {
      slug: combination.slug,
      name: combination.name,
      type: "combination" as const,
      guestLimitMet,
      availableUnits: available ? 1 : 0,
      nightlyRateKsh: price.nightlyRateKsh,
      maxGuests: combination.maxGuests,
      unitOptions: available ? [{
        unitIds: componentUnits.map((unit) => unit.id),
        ...price,
        maxGuests: combination.maxGuests,
        bedCount: details.bedCount || 0,
        bedConfiguration: details.bedConfiguration || "",
      }] : [],
    };
  });
}

export function getRoomAvailabilityStatus(checkIn: string, checkOut: string, guests: number): AccommodationAvailability[] {
  return [
    ...getPhysicalRoomAvailabilityStatus(checkIn, checkOut, guests),
    ...getRoomCombinationAvailabilityStatus(checkIn, checkOut, guests),
  ];
}

export function isBookingConfigured() {
  return ((database.prepare("SELECT COUNT(*) AS count FROM room_units u JOIN rooms r ON r.slug=u.room_slug WHERE u.active=1 AND r.active=1").get() as { count: number }).count) > 0;
}

export function getAdminSnapshot() {
  return {
    rooms: (database.prepare("SELECT slug, name, inventory, max_guests AS maxGuests, nightly_rate_ksh AS nightlyRateKsh, room_details AS roomDetails, active FROM rooms ORDER BY name").all() as { slug: string; name: string; inventory: number; maxGuests: number; nightlyRateKsh: number; roomDetails: string; active: number }[])
      .map((room) => {
        const details = JSON.parse(room.roomDetails) as RoomConfig;
        return { ...details, slug: room.slug, name: room.name, inventory: room.inventory, maxGuests: room.maxGuests, nightlyRateKsh: room.nightlyRateKsh, defaultRateKsh: room.nightlyRateKsh, active: room.active };
      }),
    roomUnits: (database.prepare(`SELECT u.id,u.code,u.room_slug AS slug,u.unit_details AS unitDetails,u.active,r.name AS name,r.room_details AS roomDetails
      FROM room_units u JOIN rooms r ON r.slug=u.room_slug WHERE u.active=1 ORDER BY r.name,u.code`).all() as { id: number; code: string; slug: string; unitDetails: string; active: number; name: string; roomDetails: string }[])
      .map((unit) => ({ ...parseUnit(unit), active: Boolean(unit.active) })),
    combinations: getRoomCombinations(),
    guests: database.prepare(`SELECT g.id, g.full_name AS name, g.email, g.phone, g.nationality,
      g.id_document AS idDocument, g.preferences, g.notes,
      COUNT(r.id) AS stays, MAX(r.check_out) AS lastCheckOut,
      COALESCE(SUM(r.total_ksh),0) AS lifetimeRoomSpend FROM guest_profiles g
      LEFT JOIN reservations r ON lower(r.guest_email)=lower(g.email)
      GROUP BY g.id ORDER BY g.updated_at DESC LIMIT 500`).all(),
    reservations: database.prepare(`SELECT r.reference, COALESCE(NULLIF(r.accommodation_slug,''),r.room_slug) AS roomSlug,
      COALESCE(combinations.name,rooms.name) AS roomName,
      GROUP_CONCAT(DISTINCT linked_units.code) AS roomCodes,
      r.room_unit_id AS roomUnitId,
      r.check_in AS checkIn, r.check_out AS checkOut, r.guests, r.guest_name AS name,
      r.guest_email AS email, r.guest_phone AS phone, r.source, r.nightly_rate_ksh AS nightlyRateKsh,
      r.total_ksh AS totalKsh,
      COALESCE((SELECT SUM(amount_ksh) FROM folio_charges WHERE reservation_reference=r.reference AND status='posted'),0) AS serviceChargesKsh,
      COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments WHERE reservation_reference=r.reference AND status='verified'),0) AS paidKsh,
      COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments WHERE reservation_reference=r.reference AND status='pending'),0) AS pendingPaymentKsh,
      MAX(0,r.total_ksh
        + COALESCE((SELECT SUM(amount_ksh) FROM folio_charges WHERE reservation_reference=r.reference AND status='posted'),0)
        - COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments WHERE reservation_reference=r.reference AND status='verified'),0)) AS balanceDueKsh,
      MAX(0,r.total_ksh
        + COALESCE((SELECT SUM(amount_ksh) FROM folio_charges WHERE reservation_reference=r.reference AND status='posted'),0)
        - COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments WHERE reservation_reference=r.reference AND status IN ('verified','pending')),0)) AS availableToRecordKsh,
      r.status, r.created_at AS createdAt FROM reservations r
      LEFT JOIN rooms ON rooms.slug=r.room_slug
      LEFT JOIN room_combinations combinations ON combinations.slug=COALESCE(NULLIF(r.accommodation_slug,''),r.room_slug)
      LEFT JOIN reservation_room_units linked ON linked.reservation_id=r.id
      LEFT JOIN room_units linked_units ON linked_units.id=linked.room_unit_id
      GROUP BY r.id ORDER BY r.id DESC LIMIT 100`).all(),
    enquiries: database.prepare(`SELECT id, guest_name AS name, guest_email AS email, guest_phone AS phone,
      preferred_dates AS dates, message, created_at AS createdAt FROM enquiries ORDER BY id DESC LIMIT 100`).all(),
  };
}

export function saveRoomConfig(room: RoomConfig) {
  database.exec("BEGIN IMMEDIATE");
  try {
  updateRoom.run({
    slug: room.slug,
    name: room.name,
    inventory: room.inventory,
    maxGuests: room.maxGuests,
    nightlyRateKsh: room.nightlyRateKsh,
    roomDetails: JSON.stringify(room),
  });
  synchronizeRoomUnits(room.slug, room.name, room.inventory, detailsForUnit(room));
  database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  recordAudit("room.rate_or_inventory_changed", "room_type", room.slug, room);
}

export function saveRoomGallery(slug: string, images: string[], imageUrl: string) {
  const existing = database.prepare("SELECT room_details AS roomDetails FROM rooms WHERE slug=?").get(slug) as { roomDetails: string } | undefined;
  if (!existing) throw new Error("Room category not found.");
  const details = JSON.parse(existing.roomDetails) as RoomConfig;
  const updated = { ...details, images, imageUrl };
  database.prepare("UPDATE rooms SET room_details=? WHERE slug=?").run(JSON.stringify(updated), slug);
  recordAudit("room.gallery_updated", "room_type", slug, { imageCount: images.length, imageUrl });
}

export function saveRoomUnit(input: RoomUnitInput) {
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{0,99}$/.test(input.code)) throw new Error("Use letters, numbers, spaces, or hyphens for the room number.");
  const unit = database.prepare("SELECT id,room_slug AS slug FROM room_units WHERE id=? AND active=1").get(input.id) as { id: number; slug: string } | undefined;
  if (!unit) throw new Error("Room not found.");
  const details = { name: input.code, maxGuests: input.maxGuests, nightlyRateKsh: input.nightlyRateKsh, weeklyRatesKsh: input.weeklyRatesKsh, bedCount: input.bedCount, bedConfiguration: input.bedConfiguration, shortDescription: input.shortDescription, description: input.description, amenities: input.amenities, operationalStatus: input.operationalStatus };
  database.prepare("UPDATE room_units SET code=?,unit_details=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(input.code, JSON.stringify(details), input.id);
  recordAudit("room.unit_updated", "room_unit", String(input.id), { code: input.code, room: unit.slug, operationalStatus: input.operationalStatus });
  return getAdminSnapshot().roomUnits.find((room) => room.id === input.id);
}

export function saveRoomCombination(input: RoomCombinationInput) {
  const uniqueUnitIds = [...new Set(input.unitIds)];
  if (!/^[a-z0-9-]{2,60}$/.test(input.slug) || input.name.trim().length < 2 ||
      input.name.length > 100 || input.displayName.trim().length < 2 || input.displayName.length > 120 ||
      !Number.isInteger(input.maxGuests) || input.maxGuests < 1 || input.maxGuests > 20 ||
      !Number.isSafeInteger(input.nightlyRateKsh) || input.nightlyRateKsh < 1 ||
      input.weeklyRatesKsh.length !== 7 || !input.weeklyRatesKsh.every((rate) => Number.isSafeInteger(rate) && rate > 0) ||
      input.description.length > 3000 || uniqueUnitIds.length < 2 || uniqueUnitIds.length > 10) {
    throw new Error("Enter a valid combination with at least two physical rooms, capacity, description, and nightly rates.");
  }

  database.exec("BEGIN IMMEDIATE");
  try {
    const units = uniqueUnitIds.map((id) => database.prepare("SELECT id FROM room_units WHERE id=? AND active=1").get(id));
    if (units.some((unit) => !unit)) throw new Error("Choose active physical rooms.");
    const hasReservations = database.prepare(`SELECT 1 FROM reservations r
      WHERE COALESCE(NULLIF(r.accommodation_slug,''),r.room_slug)=?
      AND r.status IN ('inquiry','pending','confirmed','checked-in') LIMIT 1`).get(input.slug);
    const currentIds = (database.prepare("SELECT room_unit_id AS id FROM room_combination_units WHERE combination_slug=? ORDER BY room_unit_id").all(input.slug) as { id: number }[]).map((row) => Number(row.id));
    const nextIds = [...uniqueUnitIds].sort((a, b) => a - b);
    if (hasReservations && (currentIds.length !== nextIds.length || currentIds.some((id, index) => id !== nextIds[index]))) {
      throw new Error("A combination with active reservations cannot change its physical rooms.");
    }
    const details = {
      weeklyRatesKsh: input.weeklyRatesKsh,
      description: input.description.trim(),
      amenities: input.amenities,
      bedCount: input.bedCount,
      bedConfiguration: input.bedConfiguration,
    };
    database.prepare(`INSERT INTO room_combinations(slug,name,display_name,max_guests,nightly_rate_ksh,details,active)
      VALUES(@slug,@name,@displayName,@maxGuests,@nightlyRateKsh,@details,1)
      ON CONFLICT(slug) DO UPDATE SET name=excluded.name,display_name=excluded.display_name,
      max_guests=excluded.max_guests,nightly_rate_ksh=excluded.nightly_rate_ksh,details=excluded.details,active=1`)
      .run({ ...input, details: JSON.stringify(details) });
    database.prepare("DELETE FROM room_combination_units WHERE combination_slug=?").run(input.slug);
    const linkUnit = database.prepare("INSERT INTO room_combination_units(combination_slug,room_unit_id) VALUES(?,?)");
    for (const id of uniqueUnitIds) linkUnit.run(input.slug, id);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  recordAudit("room.combination_saved", "room_combination", input.slug, input);
  return getRoomCombinations().find((combination) => combination.slug === input.slug);
}

export function deleteRoomCombination(slug: string) {
  const activeReservation = database.prepare(`SELECT reference FROM reservations
    WHERE COALESCE(NULLIF(accommodation_slug,''),room_slug)=?
    AND status IN ('inquiry','pending','confirmed','checked-in') LIMIT 1`).get(slug) as { reference: string } | undefined;
  if (activeReservation) throw new RoomUnitDeleteError(409, `This combination cannot be removed while reservation ${activeReservation.reference} is active.`);
  const deleted = database.prepare("UPDATE room_combinations SET active=0 WHERE slug=? AND active=1").run(slug);
  if (!deleted.changes) throw new RoomUnitDeleteError(404, "Combination not found or already removed.");
  recordAudit("room.combination_removed", "room_combination", slug);
  return true;
}

export function getRoomCombinations(): RoomCombination[] {
  return (database.prepare(`SELECT slug,name,display_name AS displayName,max_guests AS maxGuests,
    nightly_rate_ksh AS nightlyRateKsh,details,active FROM room_combinations ORDER BY name,slug`).all() as
    { slug: string; name: string; displayName: string; maxGuests: number; nightlyRateKsh: number; details: string; active: number }[])
    .map((combination) => {
      const details = JSON.parse(combination.details) as { weeklyRatesKsh?: number[]; description?: string; amenities?: string[]; bedCount?: number; bedConfiguration?: string };
      const units = database.prepare(`SELECT u.id,u.code,u.room_slug AS slug,r.name AS category
        FROM room_combination_units cu JOIN room_units u ON u.id=cu.room_unit_id
        JOIN rooms r ON r.slug=u.room_slug WHERE cu.combination_slug=? ORDER BY u.code`).all(combination.slug) as
        { id: number; code: string; slug: string; category: string }[];
      return {
        slug: combination.slug,
        name: combination.name,
        displayName: combination.displayName,
        maxGuests: combination.maxGuests,
        nightlyRateKsh: combination.nightlyRateKsh,
        weeklyRatesKsh: details.weeklyRatesKsh || Array(7).fill(combination.nightlyRateKsh),
        description: details.description || "",
        amenities: details.amenities || [],
        bedCount: details.bedCount || 0,
        bedConfiguration: details.bedConfiguration || "",
        unitIds: units.map((unit) => unit.id),
        units,
        active: Boolean(combination.active),
      };
    });
}

export function deleteRoomUnit(id: number) {
  database.exec("BEGIN IMMEDIATE");
  let unit: { id: number; slug: string; code: string };
  try {
    const found = database.prepare("SELECT id,room_slug AS slug,code FROM room_units WHERE id=? AND active=1").get(id) as { id: number; slug: string; code: string } | undefined;
    if (!found) throw new RoomUnitDeleteError(404, "Room not found or already removed.");
    unit = found;
    const activeReservation = database.prepare(`SELECT r.reference,r.status FROM reservations r
      LEFT JOIN reservation_room_units linked ON linked.reservation_id=r.id
      WHERE (linked.room_unit_id=? OR r.room_unit_id=? OR (r.room_slug=? AND r.room_unit_id IS NULL))
        AND r.status IN ('inquiry','pending','confirmed','checked-in') ORDER BY r.id DESC LIMIT 1`).get(id, id, unit.slug) as { reference: string; status: string } | undefined;
    if (activeReservation) throw new RoomUnitDeleteError(409, `Room ${unit.code} cannot be removed while reservation ${activeReservation.reference} is ${activeReservation.status}.`);
    const combination = database.prepare(`SELECT c.display_name AS displayName FROM room_combination_units cu
      JOIN room_combinations c ON c.slug=cu.combination_slug WHERE cu.room_unit_id=? AND c.active=1 LIMIT 1`).get(id) as { displayName: string } | undefined;
    if (combination) throw new RoomUnitDeleteError(409, `Room ${unit.code} is used by ${combination.displayName}. Remove or update that combination first.`);
    database.prepare("UPDATE room_units SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
    database.prepare("UPDATE rooms SET inventory=(SELECT COUNT(*) FROM room_units WHERE room_slug=? AND active=1) WHERE slug=?").run(unit.slug, unit.slug);
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  recordAudit("room.unit_removed", "room_unit", String(id), { code: unit.code, room: unit.slug });
  return { id, code: unit.code, slug: unit.slug };
}

export class RoomUnitDeleteError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function cancelReservation(reference: string) {
  const result = database.prepare("UPDATE reservations SET status='cancelled' WHERE reference=? AND status IN ('inquiry', 'pending', 'confirmed')").run(reference);
  if (result.changes) recordAudit("reservation.cancelled", "reservation", reference);
  return result.changes > 0;
}

export function getDashboardSnapshot(today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())) {
  const inventory = database.prepare("SELECT COUNT(*) AS rooms FROM room_units u JOIN rooms r ON r.slug=u.room_slug WHERE u.active=1 AND r.active=1").get() as { rooms: number };
  const occupied = database.prepare("SELECT COUNT(*) AS count FROM reservations WHERE status='checked-in' AND check_in<=? AND check_out>?").get(today, today) as { count: number };
  const arrivals = database.prepare("SELECT COUNT(*) AS count FROM reservations WHERE status IN ('pending','confirmed') AND check_in=?").get(today) as { count: number };
  const departures = database.prepare("SELECT COUNT(*) AS count FROM reservations WHERE status='checked-in' AND check_out=?").get(today) as { count: number };
  const pending = database.prepare("SELECT COUNT(*) AS count FROM reservations WHERE status IN ('inquiry','pending')").get() as { count: number };
  const revenue = database.prepare("SELECT COALESCE(SUM(amount_ksh),0) AS amount FROM hotel_payments WHERE status='verified' AND date(verified_at,'+3 hours')=?").get(today) as { amount: number };
  const outstanding = database.prepare(`SELECT COALESCE(SUM(MAX(0, r.total_ksh + COALESCE(c.total,0) - COALESCE(p.total,0))),0) AS amount FROM reservations r
    LEFT JOIN (SELECT reservation_reference, SUM(amount_ksh) AS total FROM folio_charges WHERE status='posted' GROUP BY reservation_reference) c ON c.reservation_reference=r.reference
    LEFT JOIN (SELECT reservation_reference, SUM(amount_ksh) AS total FROM hotel_payments WHERE status='verified' GROUP BY reservation_reference) p ON p.reservation_reference=r.reference
    WHERE r.status NOT IN ('cancelled','no-show')`).get() as { amount: number };
  const counts = database.prepare("SELECT COUNT(*) AS reservations FROM reservations WHERE status NOT IN ('cancelled','no-show')").get() as { reservations: number };
  return { date: today, totalRooms: inventory.rooms, occupiedRooms: Math.min(occupied.count, inventory.rooms), availableRooms: Math.max(0, inventory.rooms - occupied.count), arrivals: arrivals.count, departures: departures.count, pendingReservations: pending.count, revenueKsh: revenue.amount, outstandingKsh: outstanding.amount, occupancyRate: inventory.rooms ? Math.round(occupied.count / inventory.rooms * 100) : 0, reservationCount: counts.reservations };
}

export function updateReservationStatus(reference: string, status: string) {
  const supported = new Set(["inquiry", "pending", "confirmed", "checked-in", "checked-out", "no-show", "cancelled"]);
  if (!supported.has(status)) return false;
  const reservation = database.prepare(`SELECT reference,guest_name AS guest,room_slug AS room_slug,check_out AS checkOut
    FROM reservations WHERE reference=?`).get(reference) as { reference: string; guest: string; room_slug: string; checkOut: string } | undefined;
  const result = database.prepare("UPDATE reservations SET status=? WHERE reference=? AND status != 'cancelled'").run(status, reference);
  if (result.changes) {
    recordAudit("reservation.status_changed", "reservation", reference, { status });
    if (status === "checked-out" && reservation) saveOperationalRecord("housekeeping", {
      id: `turnover-${reference}`, reservationReference: reference, guest: reservation.guest,
      roomType: reservation.room_slug, task: "Departure clean", status: "dirty", priority: "high",
      checkOut: reservation.checkOut, createdBy: "Front desk",
    });
  }
  return result.changes > 0;
}

const createReservation = database.prepare(`
  INSERT INTO reservations (reference, room_slug, room_unit_id, accommodation_slug, check_in, check_out, guests, guest_name, guest_email,
    guest_phone, nightly_rate_ksh, total_ksh, source)
  VALUES (@reference, @roomSlug, @roomUnitId, @accommodationSlug, @checkIn, @checkOut, @guests, @name, @email, @phone, @nightlyRateKsh, @totalKsh, @source)
`);
const findRoom = database.prepare("SELECT slug, name, inventory, max_guests, nightly_rate_ksh FROM rooms WHERE slug=? AND active=1");
function reserve(input: BookingInput) {
  database.exec("BEGIN IMMEDIATE");
  try {
  const nights = Math.round((Date.parse(`${input.checkOut}T00:00:00Z`) - Date.parse(`${input.checkIn}T00:00:00Z`)) / 86400000);
  if (nights < 1 || nights > 60) throw new BookingError("INVALID_STAY", "Choose a stay between 1 and 60 nights.");
  const availability = getRoomAvailabilityStatus(input.checkIn, input.checkOut, input.guests).find((item) => item.slug === input.roomSlug);
  if (!availability) throw new BookingError("ROOM_NOT_CONFIGURED", "This accommodation is not available to book.");
  if (!availability.guestLimitMet) throw new BookingError("GUEST_LIMIT", "This accommodation does not accommodate that number of guests.");
  const option = availability.unitOptions[0];
  if (!option) throw new BookingError("NO_AVAILABILITY", "That accommodation is no longer available for these dates.");
  const unitIds = option.unitIds || (option.id === undefined ? [] : [option.id]);
  if (!unitIds.length) throw new BookingError("NO_AVAILABILITY", "The selected accommodation has no bookable physical rooms.");
  const chosenUnits = unitIds.map((id) => database.prepare("SELECT id,code,room_slug AS roomSlug FROM room_units WHERE id=? AND active=1").get(id) as { id: number; code: string; roomSlug: string } | undefined);
  if (chosenUnits.some((unit) => !unit)) throw new BookingError("NO_AVAILABILITY", "That accommodation is no longer available for these dates.");
  const activeUnits = chosenUnits as { id: number; code: string; roomSlug: string }[];
  const room = findRoom.get(activeUnits[0].roomSlug) as RoomRow | undefined;
  if (!room) throw new BookingError("NO_AVAILABILITY", "The selected physical room is no longer bookable.");
  const nightlyRateKsh = option.nightlyRateKsh;
  const reference = `HLD-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
  const totalKsh = option.totalKsh;
  const accommodationName = availability.name;
  upsertGuestProfile(input);
  createReservation.run({
    reference,
    roomSlug: room.slug,
    roomUnitId: activeUnits[0].id,
    accommodationSlug: input.roomSlug,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests: input.guests,
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    nightlyRateKsh,
    totalKsh,
    source: input.source || "Website",
  });
  const reservationId = (database.prepare("SELECT id FROM reservations WHERE reference=?").get(reference) as { id: number }).id;
  const linkUnit = database.prepare("INSERT INTO reservation_room_units(reservation_id,room_unit_id) VALUES(?,?)");
  for (const unit of activeUnits) linkUnit.run(reservationId, unit.id);
  recordAudit("reservation.created", "reservation", reference, { accommodation: input.roomSlug, roomName: accommodationName, roomUnits: activeUnits.map((unit) => unit.code), checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests, nightlyRateKsh, totalKsh, guestName: input.name, guestEmail: input.email, guestPhone: input.phone || "", source: input.source || "Website" });
  database.exec("COMMIT");
  return { reference, roomName: accommodationName, roomCode: activeUnits[0].code, roomCodes: activeUnits.map((unit) => unit.code), nights, nightlyRateKsh, totalKsh };
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

export class BookingError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export function createBooking(input: BookingInput) {
  return reserve(input);
}

type OperationalKind = "room" | "guest" | "payment" | "housekeeping" | "maintenance" | "service" | "expense" | "supplier" | "inventory" | "settings";

function recordAudit(action: string, entity: string, entityKey: string, details: unknown = {}, actor = "Hotel Manager") {
  database.prepare("INSERT INTO audit_events (actor, action, entity, entity_key, details) VALUES (?, ?, ?, ?, ?)")
    .run(actor, action, entity, entityKey, JSON.stringify(details));
  const metadata = details && typeof details === "object" ? details as Record<string, unknown> : {};
  const guest = typeof metadata.guestName === "string" ? metadata.guestName : "";
  const source = typeof metadata.source === "string" ? metadata.source : "";
  const messages: Record<string, { type: string; title: string; message: string }> = {
    "reservation.created": {
      type: "reservation",
      title: source === "Website" ? "New website booking" : "New reservation",
      message: `${guest ? `${guest} · ` : ""}${String(metadata.roomName || "Accommodation")} · ${String(metadata.checkIn || "")} to ${String(metadata.checkOut || "")} · ${entityKey}`,
    },
    "reservation.cancelled": { type: "reservation", title: "Reservation cancelled", message: `Reservation ${entityKey} was cancelled.` },
    "reservation.status_changed": {
      type: "reservation",
      title: "Reservation updated",
      message: `Reservation ${entityKey} is now ${String(metadata.status || "updated").replaceAll("-", " ")}.`,
    },
    "payment.recorded": {
      type: "payment",
      title: "Payment recorded",
      message: `${typeof metadata.guest === "string" ? `${metadata.guest} · ` : ""}${typeof metadata.amountKsh === "number" ? `KSh ${new Intl.NumberFormat("en-KE").format(metadata.amountKsh)}` : entityKey}`,
    },
    "payment.verified": { type: "payment", title: "Payment verified", message: `Payment ${entityKey} has been verified.` },
    "payment.rejected": {
      type: "payment",
      title: "Payment rejected",
      message: `Payment ${entityKey} was rejected: ${String(metadata.reason || "review required")}`,
    },
  };
  const notification = messages[action];
  if (notification) {
    database.prepare("INSERT INTO staff_notifications(type,title,message,details,entity_key) VALUES(?,?,?,?,?)")
      .run(notification.type, notification.title, notification.message, JSON.stringify(metadata), entityKey);
  }
}

function nairobiToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function getTodayCheckouts() {
  const date = nairobiToday();
  const reservations = database.prepare(`SELECT r.reference, r.guest_name AS guestName, r.guest_email AS guestEmail,
      COALESCE(r.guest_phone,'') AS guestPhone, r.check_in AS checkIn, r.check_out AS checkOut,
      r.guests, r.status, r.source, r.total_ksh AS totalKsh,
      COALESCE(combinations.name, rooms.name) AS accommodationName,
      GROUP_CONCAT(DISTINCT COALESCE(linked_units.code,direct_units.code)) AS roomCodes
    FROM reservations r
    LEFT JOIN rooms ON rooms.slug=r.room_slug
    LEFT JOIN room_combinations combinations ON combinations.slug=COALESCE(NULLIF(r.accommodation_slug,''),r.room_slug)
    LEFT JOIN reservation_room_units linked ON linked.reservation_id=r.id
    LEFT JOIN room_units linked_units ON linked_units.id=linked.room_unit_id
    LEFT JOIN room_units direct_units ON direct_units.id=r.room_unit_id
    WHERE r.check_out=? AND r.status='checked-in'
    GROUP BY r.id ORDER BY r.guest_name,r.reference`).all(date) as
    { reference: string; guestName: string; guestEmail: string; guestPhone: string; checkIn: string; checkOut: string; guests: number; status: string; source: string; totalKsh: number; accommodationName: string | null; roomCodes: string | null }[];
  return { date, reservations, guestCount: reservations.reduce((sum, reservation) => sum + Number(reservation.guests), 0) };
}

export function getStaffNotifications() {
  const today = getTodayCheckouts();
  const dailyKey = `checkouts:${today.date}`;
  if (today.guestCount > 0) {
    const existing = database.prepare("SELECT details,cleared_at AS clearedAt FROM staff_notifications WHERE dedupe_key=?").get(dailyKey) as { details: string; clearedAt: string | null } | undefined;
    const previous = existing ? JSON.parse(existing.details) as { guestCount?: number } : null;
    const increasedAfterClear = Boolean(existing?.clearedAt && today.guestCount > Number(previous?.guestCount || 0));
    const title = `${today.guestCount} guest${today.guestCount === 1 ? "" : "s"} checking out today`;
    const message = `${today.reservations.length} reservation${today.reservations.length === 1 ? "" : "s"} · ${today.date}`;
    database.prepare(`INSERT INTO staff_notifications(type,title,message,details,entity_key,dedupe_key)
      VALUES('checkout',?,?,?,?,?)
      ON CONFLICT(dedupe_key) DO UPDATE SET title=excluded.title,message=excluded.message,details=excluded.details,
      cleared_at=CASE WHEN staff_notifications.cleared_at IS NOT NULL AND ? THEN NULL ELSE staff_notifications.cleared_at END,
      read_at=CASE WHEN staff_notifications.cleared_at IS NOT NULL AND ? THEN NULL ELSE staff_notifications.read_at END`)
      .run(title, message, JSON.stringify({ date: today.date, guestCount: today.guestCount, reservationCount: today.reservations.length }), today.date, dailyKey, increasedAfterClear ? 1 : 0, increasedAfterClear ? 1 : 0);
  }
  const notifications = database.prepare(`SELECT id,type,title,message,details,entity_key AS entityKey,
    created_at AS createdAt,read_at AS readAt FROM staff_notifications
    WHERE cleared_at IS NULL ORDER BY id DESC LIMIT 100`).all().map((raw) => {
      const notification = raw as { details: string };
      return { ...notification, details: JSON.parse(notification.details) as Record<string, unknown> };
    }) as { id: number; type: string; title: string; message: string; details: Record<string, unknown>; entityKey: string; createdAt: string; readAt: string | null }[];
  const unreadCount = (database.prepare("SELECT COUNT(*) AS count FROM staff_notifications WHERE cleared_at IS NULL AND read_at IS NULL").get() as { count: number }).count;
  return { notifications, unreadCount, todayCheckouts: today.reservations, todayGuestCount: today.guestCount, todayDate: today.date };
}

export function markStaffNotificationRead(id: number) {
  return database.prepare("UPDATE staff_notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=? AND cleared_at IS NULL").run(id).changes > 0;
}

export function markAllStaffNotificationsRead() {
  database.prepare("UPDATE staff_notifications SET read_at=CURRENT_TIMESTAMP WHERE cleared_at IS NULL AND read_at IS NULL").run();
}

export function clearStaffNotifications() {
  database.prepare("UPDATE staff_notifications SET cleared_at=CURRENT_TIMESTAMP,read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE cleared_at IS NULL").run();
}

function upsertGuestProfile(input: Pick<BookingInput, "name" | "email" | "phone" | "nationality" | "idDocument" | "preferences" | "notes">) {
  database.prepare(`INSERT INTO guest_profiles (full_name,email,phone,nationality,id_document,preferences,notes)
    VALUES (?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET
    full_name=excluded.full_name,
    phone=COALESCE(NULLIF(excluded.phone,''),guest_profiles.phone),
    nationality=COALESCE(NULLIF(excluded.nationality,''),guest_profiles.nationality),
    id_document=COALESCE(NULLIF(excluded.id_document,''),guest_profiles.id_document),
    preferences=COALESCE(NULLIF(excluded.preferences,''),guest_profiles.preferences),
    notes=COALESCE(NULLIF(excluded.notes,''),guest_profiles.notes),
    updated_at=CURRENT_TIMESTAMP`)
    .run(input.name, input.email.toLowerCase(), input.phone || "", input.nationality || "", input.idDocument || "", input.preferences || "", input.notes || "");
}

export function saveGuestProfile(record: Record<string, unknown>, actor = "Hotel Manager") {
  const name = String(record.name || "").trim();
  const email = String(record.email || "").trim().toLowerCase();
  const phone = String(record.phone || "").trim();
  const nationality = String(record.nationality || "").trim();
  const idDocument = String(record.idDocument || "").trim();
  const preferences = String(record.preferences || "").trim();
  const notes = String(record.notes || "").trim();
  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || phone.length > 40 || nationality.length > 100 || idDocument.length > 200 || preferences.length > 500 || notes.length > 1000) {
    throw new Error("Enter a valid guest name, email and profile details.");
  }
  const existing = database.prepare("SELECT id FROM guest_profiles WHERE lower(email)=lower(?)").get(email);
  upsertGuestProfile({ name, email, phone, nationality, idDocument, preferences, notes });
  recordAudit(existing ? "guest.profile_updated" : "guest.profile_created", "guest", email, { name, email }, actor);
  return database.prepare(`SELECT id,full_name AS name,email,phone,nationality,id_document AS idDocument,preferences,notes
    FROM guest_profiles WHERE lower(email)=lower(?)`).get(email);
}

export function listOperationalRecords(kind: OperationalKind) {
  return database.prepare("SELECT record_key AS recordKey, payload, created_at AS createdAt, updated_at AS updatedAt FROM operational_records WHERE kind=? ORDER BY updated_at DESC")
    .all(kind).map((row) => {
      const item = row as { recordKey: string; payload: string; createdAt: string; updatedAt: string };
      return { key: item.recordKey, ...JSON.parse(item.payload) as Record<string, unknown>, createdAt: item.createdAt, updatedAt: item.updatedAt };
    });
}

export function saveOperationalRecord(kind: OperationalKind, record: Record<string, unknown>, actor = "Hotel Manager") {
  if (kind === "guest") return saveGuestProfile(record, actor);
  if (kind === "payment") return recordHotelPayment(record, actor);
  if (kind === "service" && typeof record.reservationReference === "string") return addFolioCharge(record, actor);
  const key = typeof record.id === "string" && record.id ? record.id : `${kind}-${randomBytes(6).toString("hex").toUpperCase()}`;
  const payload = { ...record, id: key };
  database.prepare(`INSERT INTO operational_records (kind, record_key, payload) VALUES (?, ?, ?)
    ON CONFLICT(kind, record_key) DO UPDATE SET payload=excluded.payload, updated_at=CURRENT_TIMESTAMP`)
    .run(kind, key, JSON.stringify(payload));
  recordAudit(typeof record.id === "string" ? "record.updated" : "record.created", kind, key, payload, actor);
  return payload;
}

function getLinkedReservation(reference: string) {
  return database.prepare(`SELECT reference, guest_name AS guestName, guest_email AS guestEmail, room_slug AS roomSlug,
    check_in AS checkIn, check_out AS checkOut, total_ksh AS totalKsh, status FROM reservations
    WHERE reference=?`).get(reference) as
    { reference: string; guestName: string; guestEmail: string; roomSlug: string; checkIn: string; checkOut: string; totalKsh: number; status: string } | undefined;
}

export function recordHotelPayment(record: Record<string, unknown>, actor = "Hotel Manager") {
  const reservationReference = typeof record.reservationReference === "string" ? record.reservationReference.trim() : "";
  const amountKsh = Number(record.amountKsh);
  const method = typeof record.method === "string" ? record.method.trim() : "";
  const transactionReference = typeof record.transactionReference === "string" ? record.transactionReference.trim() : "";
  const notes = typeof record.notes === "string" ? record.notes.trim() : "";
  if (!reservationReference || !Number.isSafeInteger(amountKsh) || amountKsh < 1 || amountKsh > 100000000 ||
    !["Cash", "M-Pesa", "Bank transfer", "Card", "Online payment", "Other"].includes(method) ||
    transactionReference.length > 120 || notes.length > 1000) {
    throw new Error("Choose a reservation and enter a valid amount, payment method, reference, and note.");
  }

  database.exec("BEGIN IMMEDIATE");
  try {
    const reservation = database.prepare(`SELECT reference,guest_name AS guestName,guest_email AS guestEmail,room_slug AS roomSlug,
      total_ksh AS totalKsh,status,
      COALESCE((SELECT SUM(amount_ksh) FROM folio_charges WHERE reservation_reference=r.reference AND status='posted'),0) AS serviceChargesKsh,
      COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments WHERE reservation_reference=r.reference AND status IN ('verified','pending')),0) AS paymentsKsh
      FROM reservations r WHERE reference=?`).get(reservationReference) as {
        reference: string; guestName: string; guestEmail: string; roomSlug: string; totalKsh: number;
        status: string; serviceChargesKsh: number; paymentsKsh: number;
      } | undefined;
    if (!reservation || ["cancelled", "no-show"].includes(reservation.status)) {
      throw new Error("Choose an active reservation before recording a payment.");
    }
    const availableToRecordKsh = Math.max(0, reservation.totalKsh + reservation.serviceChargesKsh - reservation.paymentsKsh);
    if (availableToRecordKsh < 1) throw new Error("This reservation has no remaining balance available for a new payment.");
    if (amountKsh > availableToRecordKsh) {
      throw new Error(`The amount exceeds the remaining recordable balance of KSh ${new Intl.NumberFormat("en-KE").format(availableToRecordKsh)}.`);
    }
    if (transactionReference && database.prepare(`SELECT 1 FROM hotel_payments
      WHERE lower(method)=lower(?) AND lower(transaction_reference)=lower(?) LIMIT 1`).get(method, transactionReference)) {
      throw new Error("This transaction reference has already been recorded for that payment method.");
    }

    const reference = `PAY-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
    const inserted = database.prepare(`INSERT INTO hotel_payments (reference,reservation_reference,amount_ksh,method,transaction_reference,status,recorder,notes)
      VALUES (?,?,?,?,?,'pending',?,?)`).run(reference, reservation.reference, amountKsh, method, transactionReference, actor, notes);
    const paymentId = Number(inserted.lastInsertRowid);
    const receiptNumber = `HLD-${new Date().getUTCFullYear()}-${String(paymentId).padStart(6, "0")}`;
    database.prepare("UPDATE hotel_payments SET receipt_number=? WHERE id=?").run(receiptNumber, paymentId);
    const result = { id: reference, reference, receiptNumber, reservationReference: reservation.reference, guest: reservation.guestName, guestEmail: reservation.guestEmail, room: reservation.roomSlug, amountKsh, method, transactionReference, status: "pending", recorder: actor, notes, createdAt: new Date().toISOString() };
    const receiptSnapshot = getPaymentReceipt(reference);
    if (!receiptSnapshot) throw new Error("The saved payment receipt could not be prepared.");
    database.prepare("UPDATE hotel_payments SET receipt_snapshot=? WHERE id=?").run(JSON.stringify(receiptSnapshot), paymentId);
    recordAudit("payment.recorded", "payment", reference, result, actor);
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function recordGuestMpesaPayment(record: Record<string, unknown>) {
  const reservationReference = typeof record.reservationReference === "string" ? record.reservationReference.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  const amountKsh = Number(record.amountKsh);
  const transactionReference = typeof record.transactionReference === "string" ? record.transactionReference.trim().toUpperCase() : "";
  if (!/^[A-Z0-9-]{6,80}$/.test(reservationReference) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
    !Number.isSafeInteger(amountKsh) || amountKsh < 1 || amountKsh > 100000000 ||
    !/^[A-Z0-9-]{4,120}$/.test(transactionReference)) {
    throw new GuestPaymentError("Enter your booking reference, booking email, a valid payment amount, and M-Pesa transaction code.");
  }

  database.exec("BEGIN IMMEDIATE");
  try {
    const reservation = database.prepare(`SELECT r.reference,r.guest_name AS guestName,r.guest_email AS guestEmail,
      r.room_slug AS roomSlug,r.total_ksh AS totalKsh,r.status,
      COALESCE((SELECT SUM(amount_ksh) FROM folio_charges WHERE reservation_reference=r.reference AND status='posted'),0) AS serviceChargesKsh,
      COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments WHERE reservation_reference=r.reference AND status='verified'),0) AS verifiedPaymentsKsh,
      COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments WHERE reservation_reference=r.reference AND status='pending'),0) AS pendingPaymentsKsh
      FROM reservations r WHERE r.reference=? AND lower(r.guest_email)=?`).get(reservationReference, email) as {
        reference: string; guestName: string; guestEmail: string; roomSlug: string; totalKsh: number;
        status: string; serviceChargesKsh: number; verifiedPaymentsKsh: number; pendingPaymentsKsh: number;
      } | undefined;
    if (!reservation) throw new GuestPaymentError("We could not match that booking reference and email. Check them and try again.");
    if (["cancelled", "no-show"].includes(reservation.status)) throw new GuestPaymentError("This reservation is not eligible for a payment.");

    const totalChargesKsh = reservation.totalKsh + reservation.serviceChargesKsh;
    const availableToRecordKsh = Math.max(0, totalChargesKsh - reservation.verifiedPaymentsKsh - reservation.pendingPaymentsKsh);
    if (availableToRecordKsh < 1) throw new GuestPaymentError("There is no remaining balance available for another payment.");
    if (amountKsh > availableToRecordKsh) {
      throw new GuestPaymentError(`The payment exceeds the remaining balance of KSh ${new Intl.NumberFormat("en-KE").format(availableToRecordKsh)}.`);
    }
    if (database.prepare(`SELECT 1 FROM hotel_payments
      WHERE lower(method)='m-pesa' AND lower(transaction_reference)=lower(?) LIMIT 1`).get(transactionReference)) {
      throw new GuestPaymentError("That M-Pesa transaction code has already been submitted.");
    }

    const actor = "Guest (Website)";
    const reference = `PAY-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
    const inserted = database.prepare(`INSERT INTO hotel_payments
      (reference,reservation_reference,amount_ksh,method,transaction_reference,status,recorder,notes)
      VALUES (?,?,?,'M-Pesa',?,'pending',?,'Guest-submitted M-Pesa payment; pending staff verification.')`)
      .run(reference, reservation.reference, amountKsh, transactionReference, actor);
    const paymentId = Number(inserted.lastInsertRowid);
    const receiptNumber = `HLD-${new Date().getUTCFullYear()}-${String(paymentId).padStart(6, "0")}`;
    database.prepare("UPDATE hotel_payments SET receipt_number=? WHERE id=?").run(receiptNumber, paymentId);
    const result = {
      reference,
      receiptNumber,
      reservationReference: reservation.reference,
      amountKsh,
      status: "pending",
      balanceDueKsh: Math.max(0, totalChargesKsh - reservation.verifiedPaymentsKsh - amountKsh),
      availableToRecordKsh: availableToRecordKsh - amountKsh,
    };
    const receiptSnapshot = getPaymentReceipt(reference);
    if (!receiptSnapshot) throw new Error("The saved payment receipt could not be prepared.");
    database.prepare("UPDATE hotel_payments SET receipt_snapshot=? WHERE id=?").run(JSON.stringify(receiptSnapshot), paymentId);
    recordAudit("payment.recorded", "payment", reference, {
      guest: reservation.guestName,
      guestEmail: reservation.guestEmail,
      amountKsh,
      source: "Website",
      reservationReference: reservation.reference,
    }, actor);
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export class GuestPaymentError extends Error {}

export function getGuestPaymentSummary(record: Record<string, unknown>) {
  const reservationReference = typeof record.reservationReference === "string" ? record.reservationReference.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  if (!/^[A-Z0-9-]{6,80}$/i.test(reservationReference) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new GuestPaymentError("Enter a valid booking reference and the email used for the reservation.");
  }
  const reservation = database.prepare(`SELECT r.reference,r.check_in AS checkIn,r.check_out AS checkOut,
      COALESCE(combinations.name,rooms.name,r.room_slug) AS roomName,
      r.total_ksh + COALESCE((SELECT SUM(amount_ksh) FROM folio_charges WHERE reservation_reference=r.reference AND status='posted'),0) AS totalChargesKsh,
      COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments WHERE reservation_reference=r.reference AND status='verified'),0) AS paidKsh,
      COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments WHERE reservation_reference=r.reference AND status='pending'),0) AS pendingKsh
    FROM reservations r
    LEFT JOIN rooms ON rooms.slug=r.room_slug
    LEFT JOIN room_combinations combinations ON combinations.slug=COALESCE(NULLIF(r.accommodation_slug,''),r.room_slug)
    WHERE r.reference=? AND lower(r.guest_email)=?`).get(reservationReference, email) as {
      reference: string; checkIn: string; checkOut: string; roomName: string;
      totalChargesKsh: number; paidKsh: number; pendingKsh: number;
    } | undefined;
  if (!reservation) throw new GuestPaymentError("We could not match that booking reference and email. Check them and try again.");
  const balanceDueKsh = Math.max(0, reservation.totalChargesKsh - reservation.paidKsh);
  const availableToRecordKsh = Math.max(0, balanceDueKsh - reservation.pendingKsh);
  return { ...reservation, balanceDueKsh, availableToRecordKsh };
}

export function addFolioCharge(record: Record<string, unknown>, actor = "Hotel Manager") {
  const reservation = getLinkedReservation(String(record.reservationReference || ""));
  const amountKsh = Number(record.amountKsh);
  if (!reservation || !Number.isSafeInteger(amountKsh) || amountKsh < 0 || amountKsh > 100000000) throw new Error("Choose a current guest reservation and enter a valid charge.");
  const category = String(record.category || "Guest service");
  const description = String(record.description || "Guest service");
  const result = database.prepare("INSERT INTO folio_charges (reservation_reference,category,description,amount_ksh) VALUES (?,?,?,?)")
    .run(reservation.reference, category, description, amountKsh);
  const charge = { id: Number(result.lastInsertRowid), reservationReference: reservation.reference, guest: reservation.guestName, room: reservation.roomSlug, category, description, amountKsh, status: "posted" };
  recordAudit("folio.charge_added", "reservation", reservation.reference, charge, actor);
  return charge;
}

export function getFinancialRecords() {
  const payments = database.prepare(`SELECT p.reference, p.reservation_reference AS reservationReference, r.guest_name AS guest,
    r.guest_email AS guestEmail, COALESCE(NULLIF(r.guest_phone,''),NULLIF(g.phone,''),'') AS guestPhone,
    r.room_slug AS room, p.amount_ksh AS amountKsh, p.method,
    p.transaction_reference AS transactionReference, p.status, p.recorder, p.verifier, p.notes,
    p.rejection_reason AS rejectionReason,
    p.receipt_number AS receiptNumber,
    p.created_at AS createdAt, p.verified_at AS verifiedAt FROM hotel_payments p
    JOIN reservations r ON r.reference=p.reservation_reference
    LEFT JOIN guest_profiles g ON lower(g.email)=lower(r.guest_email)
    ORDER BY p.id DESC`).all();
  const folios = database.prepare(`SELECT r.reference AS reservationReference, r.guest_name AS guest, r.room_slug AS room,
    r.check_in AS checkIn, r.check_out AS checkOut, r.total_ksh AS roomCharges,
    COALESCE((SELECT SUM(amount_ksh) FROM folio_charges WHERE reservation_reference=r.reference AND status='posted'),0) AS serviceCharges,
    COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments WHERE reservation_reference=r.reference AND status='verified'),0) AS paid,
    COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments WHERE reservation_reference=r.reference AND status='pending'),0) AS pending,
    MAX(0,r.total_ksh
      + COALESCE((SELECT SUM(amount_ksh) FROM folio_charges WHERE reservation_reference=r.reference AND status='posted'),0)
      - COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments WHERE reservation_reference=r.reference AND status='verified'),0)) AS balanceDue,
    MAX(0,r.total_ksh
      + COALESCE((SELECT SUM(amount_ksh) FROM folio_charges WHERE reservation_reference=r.reference AND status='posted'),0)
      - COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments WHERE reservation_reference=r.reference AND status IN ('verified','pending')),0)) AS availableToRecord
    FROM reservations r ORDER BY r.id DESC LIMIT 200`).all();
  const charges = database.prepare("SELECT id,reservation_reference AS reservationReference,category,description,amount_ksh AS amountKsh,status,created_at AS createdAt FROM folio_charges ORDER BY id DESC").all();
  return { payments, folios, charges };
}

export function getPaymentReceipt(reference: string) {
  const payment = database.prepare(`SELECT p.reference AS paymentReference,p.receipt_number AS receiptNumber,
  p.receipt_snapshot AS receiptSnapshot,
  p.reservation_reference AS reservationReference,p.amount_ksh AS amountKsh,p.method,
      p.transaction_reference AS transactionReference,p.status,p.recorder,p.created_at AS createdAt,
      r.guest_name AS guestName,COALESCE(NULLIF(r.guest_phone,''),NULLIF(g.phone,''),'') AS guestPhone,
      r.check_in AS checkIn,r.check_out AS checkOut,r.total_ksh AS roomChargesKsh,
      COALESCE((SELECT SUM(amount_ksh) FROM folio_charges WHERE reservation_reference=r.reference AND status='posted'),0) AS serviceChargesKsh,
      COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments hp WHERE hp.reservation_reference=r.reference AND hp.status='verified' AND hp.reference<>p.reference),0) AS paidBeforeKsh,
      COALESCE((SELECT SUM(amount_ksh) FROM hotel_payments hp WHERE hp.reservation_reference=r.reference AND hp.status='pending' AND hp.reference<>p.reference),0) AS pendingPaymentsKsh,
      r.room_slug AS roomSlug,COALESCE(combinations.name,rooms.name,r.room_slug) AS roomName,
      GROUP_CONCAT(DISTINCT linked_units.code) AS roomCodes
    FROM hotel_payments p
    JOIN reservations r ON r.reference=p.reservation_reference
    LEFT JOIN guest_profiles g ON lower(g.email)=lower(r.guest_email)
    LEFT JOIN rooms ON rooms.slug=r.room_slug
    LEFT JOIN room_combinations combinations ON combinations.slug=COALESCE(NULLIF(r.accommodation_slug,''),r.room_slug)
    LEFT JOIN reservation_room_units linked ON linked.reservation_id=r.id
    LEFT JOIN room_units linked_units ON linked_units.id=linked.room_unit_id
    WHERE p.reference=? GROUP BY p.id,r.id`).get(reference) as {
      paymentReference: string; receiptNumber: string | null; reservationReference: string; amountKsh: number;
      receiptSnapshot: string | null; method: string; transactionReference: string | null; status: string; recorder: string; createdAt: string;
      guestName: string; guestPhone: string; checkIn: string; checkOut: string; roomChargesKsh: number;
      serviceChargesKsh: number; paidBeforeKsh: number; pendingPaymentsKsh: number;
      roomSlug: string; roomName: string; roomCodes: string | null;
    } | undefined;
  if (!payment) return undefined;
  if (!payment.receiptNumber) throw new Error(`Payment ${reference} does not have a persisted receipt number.`);
  const totalChargesKsh = payment.roomChargesKsh + payment.serviceChargesKsh;
  const paidInThisTransactionKsh = payment.status === "verified" || payment.status === "pending" ? payment.amountKsh : 0;
  const balanceDueKsh = Math.max(0, totalChargesKsh - payment.paidBeforeKsh - paidInThisTransactionKsh);
  if (payment.receiptSnapshot) {
    const snapshot = JSON.parse(payment.receiptSnapshot) as Record<string, unknown>;
    return {
      ...snapshot,
      totalChargesKsh: Number(snapshot.totalChargesKsh ?? totalChargesKsh),
      paidBeforeKsh: payment.paidBeforeKsh,
      pendingPaymentsKsh: payment.pendingPaymentsKsh,
      balanceDueKsh,
      status: payment.status,
    };
  }

  const nights = Math.max(1, Math.round((Date.parse(`${payment.checkOut}T00:00:00Z`) - Date.parse(`${payment.checkIn}T00:00:00Z`)) / 86400000));
  const charges = database.prepare(`SELECT category,description,amount_ksh AS amountKsh
    FROM folio_charges WHERE reservation_reference=? AND status='posted' ORDER BY id`).all(payment.reservationReference) as
    { category: string; description: string; amountKsh: number }[];
  return {
    ...payment,
    receiptNumber: payment.receiptNumber,
    roomLabel: `${payment.roomName}${payment.roomCodes ? ` · ${payment.roomCodes.split(",").join(", ")}` : ""}`,
    nights,
    totalChargesKsh,
    paidBeforeKsh: payment.paidBeforeKsh,
    pendingPaymentsKsh: payment.pendingPaymentsKsh,
    balanceDueKsh,
    charges: [
      { description: `Accommodation · ${nights} ${nights === 1 ? "night" : "nights"}`, quantity: 1, unitPriceKsh: payment.roomChargesKsh, amountKsh: payment.roomChargesKsh },
      ...charges.map((charge) => ({
        description: `${charge.category}: ${charge.description}`,
        quantity: 1,
        unitPriceKsh: charge.amountKsh,
        amountKsh: charge.amountKsh,
      })),
    ],
  };
}

export function verifyHotelPayment(reference: string, verifier: string, decision: "verify" | "reject" = "verify", rejectionReason = "") {
  const normalizedReason = rejectionReason.trim();
  if (decision === "reject" && (!normalizedReason || normalizedReason.length > 500)) {
    return { ok: false, reason: "Provide a rejection reason of 1 to 500 characters." };
  }
  const payment = database.prepare("SELECT recorder FROM hotel_payments WHERE reference=? AND status='pending'").get(reference) as { recorder: string } | undefined;
  if (!payment) return { ok: false, reason: "Payment not found or no longer pending review." };
  if (payment.recorder.toLowerCase() === verifier.toLowerCase()) return { ok: false, reason: "The person who recorded a payment cannot verify it." };
  database.exec("BEGIN IMMEDIATE");
  try {
    const status = decision === "verify" ? "verified" : "rejected";
    const updated = database.prepare(`UPDATE hotel_payments
      SET status=?,verifier=?,verified_at=CASE WHEN ?='verified' THEN CURRENT_TIMESTAMP ELSE NULL END,rejection_reason=?
      WHERE reference=? AND status='pending'`)
      .run(status, verifier, status, decision === "reject" ? normalizedReason : "", reference);
    if (!updated.changes) {
      database.exec("ROLLBACK");
      return { ok: false, reason: "Payment was updated by another staff member. Refresh and try again." };
    }
    recordAudit(decision === "verify" ? "payment.verified" : "payment.rejected", "payment", reference, {
      recorder: payment.recorder,
      verifier,
      ...(decision === "reject" ? { reason: normalizedReason } : {}),
    });
    database.exec("COMMIT");
    return { ok: true };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function authenticateStaffUser(username: string, password: string): StaffIdentity | null {
  const user = database.prepare("SELECT id, username, full_name AS fullName, role, password_salt AS passwordSalt, password_hash AS passwordHash FROM staff_users WHERE username=? COLLATE NOCASE AND active=1")
    .get(username) as (StaffIdentity & { passwordSalt: string; passwordHash: string }) | undefined;
  if (!user) return null;
  const supplied = scryptSync(password, user.passwordSalt, 64);
  const expected = Buffer.from(user.passwordHash, "hex");
  if (expected.length !== supplied.length || !timingSafeEqual(supplied, expected)) return null;
  return { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
}

export function getStaffIdentity(id: string): StaffIdentity | null {
  const user = database.prepare("SELECT id, username, full_name AS fullName, role FROM staff_users WHERE id=? AND active=1").get(id) as StaffIdentity | undefined;
  return user || null;
}

export function listStaffUsers(): StaffIdentity[] {
  return database.prepare("SELECT id, username, full_name AS fullName, role FROM staff_users WHERE active=1 ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'manager' THEN 1 WHEN 'chief-accountant' THEN 2 ELSE 3 END, full_name COLLATE NOCASE")
    .all() as StaffIdentity[];
}

export class AdminAccountLimitError extends Error {
  constructor() {
    super("A maximum of two administrator accounts is allowed.");
    this.name = "AdminAccountLimitError";
  }
}

export function createStaffUser(input: { username: string; fullName: string; role: StaffRole; password: string }, actor: string): StaffIdentity {
  const id = randomBytes(18).toString("hex");
  const passwordSalt = randomBytes(16).toString("hex");
  const passwordHash = scryptSync(input.password, passwordSalt, 64).toString("hex");
  database.exec("BEGIN IMMEDIATE");
  try {
    if (input.role === "admin") {
      const activeAdmins = (database.prepare("SELECT COUNT(*) AS count FROM staff_users WHERE role='admin' AND active=1").get() as { count: number }).count;
      const bootstrapUsername = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
      const bootstrapIsSeparateAccount = Boolean(process.env.ADMIN_PASSWORD) &&
        !database.prepare("SELECT 1 FROM staff_users WHERE username=? COLLATE NOCASE AND active=1").get(bootstrapUsername);
      if (activeAdmins + Number(bootstrapIsSeparateAccount) >= 2) throw new AdminAccountLimitError();
    }
    database.prepare("INSERT INTO staff_users (id, username, full_name, role, password_salt, password_hash) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, input.username, input.fullName, input.role, passwordSalt, passwordHash);
    recordAudit("staff.created", "staff", id, { username: input.username, fullName: input.fullName, role: input.role }, actor);
    database.exec("COMMIT");
    return { id, username: input.username, fullName: input.fullName, role: input.role };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getAuditTrail() {
  return database.prepare("SELECT id, actor, action, entity, entity_key AS entityKey, details, created_at AS createdAt FROM audit_events ORDER BY id DESC LIMIT 300")
    .all().map((row) => { const item = row as { details: string }; return { ...item, details: JSON.parse(item.details) as unknown }; });
}

export function getPublicHotelSnapshot() {
  const physicalRooms = (database.prepare("SELECT slug,name,inventory,max_guests AS maxGuests,nightly_rate_ksh AS nightlyRateKsh,room_details AS roomDetails FROM rooms WHERE active=1 ORDER BY nightly_rate_ksh").all() as { slug: string; name: string; inventory: number; maxGuests: number; nightlyRateKsh: number; roomDetails: string }[])
    .map((room) => {
      const details = JSON.parse(room.roomDetails) as RoomConfig;
      const actualInventory = (database.prepare("SELECT COUNT(*) AS count FROM room_units WHERE room_slug=? AND active=1").get(room.slug) as { count: number }).count;
      const unitOptions = (database.prepare("SELECT id,code,unit_details AS unitDetails,room_slug AS slug,rooms.name AS name,room_details AS roomDetails FROM room_units JOIN rooms ON rooms.slug=room_units.room_slug WHERE room_slug=? AND room_units.active=1 ORDER BY code").all(room.slug) as { id: number; code: string; unitDetails: string; slug: string; name: string; roomDetails: string }[]).map((unit) => parseUnit(unit));
      const startingRate = unitOptions.length ? Math.min(...unitOptions.map((unit) => unit.nightlyRateKsh)) : room.nightlyRateKsh;
      const maximumGuests = unitOptions.length ? Math.max(...unitOptions.map((unit) => unit.maxGuests)) : room.maxGuests;
      return {
        ...details,
        slug: room.slug,
        name: room.name,
        type: "room" as const,
        inventory: actualInventory,
        maxGuests: maximumGuests,
        nightlyRateKsh: startingRate,
        defaultRateKsh: startingRate,
        guests: maximumGuests,
        description: details.description || details.shortDescription || "",
        image: details.imageUrl && details.images?.includes(details.imageUrl) ? details.imageUrl : details.images?.[0] || details.imageUrl || "",
        images: details.images || [],
        bed: details.bedConfiguration || "",
        amenities: details.amenities?.length ? details.amenities : initialRoomAmenities,
      };
    });
  const roomBySlug = new Map(physicalRooms.map((room) => [room.slug, room]));
  const combinations = getRoomCombinations().filter((combination) => combination.active).map((combination) => {
    const sharedImages = [...new Set(combination.units.flatMap((unit) => {
      const room = roomBySlug.get(unit.slug);
      return room ? [room.image, ...room.images].filter((image): image is string => Boolean(image)) : [];
    }))];
    return {
      slug: combination.slug,
      name: combination.name,
      type: "combination" as const,
      inventory: 1,
      maxGuests: combination.maxGuests,
      nightlyRateKsh: combination.nightlyRateKsh,
      defaultRateKsh: combination.nightlyRateKsh,
      weeklyRatesKsh: combination.weeklyRatesKsh,
      guests: combination.maxGuests,
      description: combination.description,
      shortDescription: combination.description,
      image: sharedImages[0] || "",
      imageUrl: sharedImages[0] || "",
      images: sharedImages,
      bed: combination.bedConfiguration,
      bedCount: combination.bedCount,
      amenities: combination.amenities.length ? combination.amenities : initialRoomAmenities,
    };
  });
  const settings = listOperationalRecords("settings");
  const profile = (settings.find((item) => item.key === "property-profile" || String((item as Record<string, unknown>).id) === "property-profile") || {}) as Record<string, unknown>;
  return { property: { name: String(profile.name || "HappyLand Hotel Diani"), destination: String(profile.destination || ""), currency: "KES", currencyCode: "KES", timezone: "Africa/Nairobi", tagline: String(profile.tagline || ""), logo: "/images/logonav.png", heroImage: "/images/herohome.png", phone: String(profile.phone || ""), email: String(profile.email || ""), website: String(profile.website || "") }, rooms: [...physicalRooms, ...combinations],
    experiences: [],
    content: settings.find((item) => item.key === "public-content" || String((item as Record<string, unknown>).id) === "public-content") || null };
}

export function storeEnquiry(input: { name: string; email: string; phone?: string; dates?: string; message: string }) {
  const result = database.prepare(`INSERT INTO enquiries (guest_name, guest_email, guest_phone, preferred_dates, message)
    VALUES (?, ?, ?, ?, ?)`).run(input.name, input.email, input.phone || null, input.dates || null, input.message);
  const enquiryId = String(result.lastInsertRowid);
  const details = { guestName: input.name, guestEmail: input.email, guestPhone: input.phone || "", preferredDates: input.dates || "", enquiryMessage: input.message };
  database.prepare("INSERT INTO staff_notifications(type,title,message,details,entity_key) VALUES('enquiry','New website enquiry',?,?,?)")
    .run(`${input.name} · ${input.email}`, JSON.stringify(details), enquiryId);
  recordAudit("enquiry.created", "enquiry", enquiryId, { guestName: input.name, guestEmail: input.email });
}
