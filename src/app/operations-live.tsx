"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import RoomManagement from "./operations/room-management";
import { InventoryManagement } from "./operations/inventory-management";
import { HousekeepingManagement } from "./operations/housekeeping-management";
import { StaffUsersPanel } from "./operations/staff-users-panel";

export type Section = "Dashboard" | "Reservations" | "Notifications" | "Check-outs Today" | "Rooms" | "Guests" | "Check-in / Check-out" | "Payments" | "Housekeeping" | "Maintenance" | "Guest Services" | "Inventory" | "Reports" | "Expenses" | "Suppliers" | "Settings";
export type Booking = { guest: string; room: string; dates: string; source: string; total: number; paid: number; status: string; color: string; reference?: string };
type Row = Record<string, unknown>;
export type StaffNotification = { id: number; type: string; title: string; message: string; details: Record<string, unknown>; entityKey: string; createdAt: string; readAt: string | null };
export type CheckoutReservation = { reference: string; guestName: string; guestEmail: string; guestPhone: string; checkIn: string; checkOut: string; guests: number; status: string; source: string; totalKsh: number; accommodationName: string | null; roomCodes: string | null };
export type StaffRole = "admin" | "manager" | "receptionist" | "chief-accountant";
export type StaffIdentity = { id: string; username: string; fullName: string; role: StaffRole };
export type LiveSnapshot = { rooms: Row[]; roomUnits: Row[]; combinations: Row[]; guests: Row[]; reservations: Row[]; notifications: StaffNotification[]; unreadNotifications: number; todayCheckouts: CheckoutReservation[]; todayGuestCount: number; todayDate: string; dashboard: Record<string, number>; records: Record<string, Row[]>; inventoryMovements: Row[]; financial: { payments: Row[]; charges: Row[]; folios: Row[] }; staff?: StaffIdentity };
export const emptySnapshot: LiveSnapshot = { rooms: [], roomUnits: [], combinations: [], guests: [], reservations: [], notifications: [], unreadNotifications: 0, todayCheckouts: [], todayGuestCount: 0, todayDate: "", dashboard: {}, records: {}, inventoryMovements: [], financial: { payments: [], charges: [], folios: [] } };
const money = (n: number) => `KSh ${new Intl.NumberFormat("en-KE").format(n || 0)}`;
const statusOptions: Record<string, string[]> = { inquiry: ["pending", "confirmed", "cancelled"], pending: ["confirmed", "cancelled"], confirmed: ["checked-in", "no-show", "cancelled"], "checked-in": ["checked-out"] };
const statusesFor = (status: string) => [status, ...(statusOptions[status] || [])];
const display = (v: unknown) => v === null || v === undefined || v === "" ? "-" : String(v);
const formatDate = (v: unknown) => { const value = String(v || ""); return /^\d{4}-\d\d-\d\d/.test(value) ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : display(v); };
const notificationDateTime = (v: string) => {
  const date = new Date(`${v.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? v : new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(date);
};

const iconPaths: Record<string, string> = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
  calendar: "M7 2v4 M17 2v4 M3 9h18 M5 4h14a2 2 0 0 1 2 2v13H3V6a2 2 0 0 1 2-2z M7 13h3 M14 13h3 M7 17h3",
  bed: "M3 18V6 M3 15h18v5 M6 11h5a3 3 0 0 1 3 3v1H3v-1a3 3 0 0 1 3-3z M15 12h3a3 3 0 0 1 3 3v1h-7v-1a3 3 0 0 1 1-3z",
  guest: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0",
  door: "M5 3h14v18H5z M15 12h.01 M2 21h20 M8 3v18",
  card: "M3 5h18v14H3z M3 9h18 M7 15h4",
  clean: "M4 20h16 M6 17l8-12 3 2-8 12z M5 12l4 6 M15 8l3-3",
  tools: "M14 7a5 5 0 0 0 6 6l-9 9-5-5 9-9a5 5 0 0 1 6-6l-3 3-4-1-1-4z",
  service: "M3 12h18 M5 12l2 8h10l2-8 M8 12a4 4 0 1 1 8 0 M12 3v2",
  inventory: "M4 7h16v14H4z M3 7l2-4h14l2 4 M9 11v3h6v-3",
  chart: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6 M9 16h3",
  truck: "M2 6h12v12H2z M14 10h4l4 4v4h-8z M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M19 13.5l2 1-2 3.5-2-1a8 8 0 0 1-2 1.2l-.3 2.3h-4L10 18.2a8 8 0 0 1-2-1.2l-2 1L4 14.5l2-1a8 8 0 0 1 0-2l-2-1L6 7l2 1a8 8 0 0 1 2-1.2L10.3 4h4l.4 2.8a8 8 0 0 1 2 1.2l2-1 2 3.5-2 1a8 8 0 0 1 0 2z",
  bell: "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
};

export function Icon({ children }: { children: ReactNode }) {
  const name = String(children);
  return <span className="op-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[name] || iconPaths.dashboard}/></svg></span>;
}

function Empty({ title, text }: { title: string; text: string }) { return <div className="live-empty"><span className="empty-mark" aria-hidden="true"/><b>{title}</b><p>{text}</p></div>; }

function ReservationReviewDialog({ reservation, onClose, onStatus }: { reservation: Row; onClose: () => void; onStatus: (row: Row, status: string) => Promise<boolean> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const guest = String(reservation.name || "Guest");
  const roomCodes = String(reservation.roomCodes || "");
  const nights = Math.max(0, Math.round((Date.parse(`${String(reservation.checkOut)}T00:00:00Z`) - Date.parse(`${String(reservation.checkIn)}T00:00:00Z`)) / 86400000));
  async function update(status: "confirmed" | "cancelled") {
    if (status === "cancelled" && !window.confirm(`Decline and cancel booking ${String(reservation.reference)} for ${guest}? Its room availability will be released.`)) return;
    setSaving(true);
    setError("");
    try {
      if (await onStatus(reservation, status)) onClose();
      else setError("The booking could not be updated. Refresh the reservations list and try again.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "The booking could not be updated.");
    } finally {
      setSaving(false);
    }
  }
  return <div className="modal-backdrop reservation-review-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="room-editor-modal reservation-review-dialog" role="dialog" aria-modal="true" aria-labelledby="reservation-review-title">
      <header className="room-editor-heading"><div><span className="module-crumb">BOOKING REVIEW · {display(reservation.reference)}</span><h2 id="reservation-review-title">Review guest booking</h2></div><button type="button" className="outline-btn" disabled={saving} onClick={onClose}>Close</button></header>
      <div className="reservation-review-status"><b>Awaiting staff confirmation</b><span>Review the guest, dates and requested accommodation before confirming.</span></div>
      <div className="reservation-review-grid">
        <div><small>GUEST</small><b>{guest}</b><a href={`mailto:${String(reservation.email || "")}`}>{display(reservation.email)}</a>{reservation.phone ? <a href={`tel:${String(reservation.phone)}`}>{String(reservation.phone)}</a> : <span>Phone not provided</span>}</div>
        <div><small>ACCOMMODATION</small><b>{display(reservation.roomName || reservation.roomSlug)}</b><span>{roomCodes ? `Assigned unit${roomCodes.includes(",") ? "s" : ""}: ${roomCodes}` : "Unit assignment pending"}</span><span>{Number(reservation.guests || 0)} guest{Number(reservation.guests) === 1 ? "" : "s"}</span></div>
        <div><small>STAY</small><b>{formatDate(reservation.checkIn)} – {formatDate(reservation.checkOut)}</b><span>{nights} night{nights === 1 ? "" : "s"}</span></div>
        <div><small>BOOKING TOTAL</small><b>{money(Number(reservation.totalKsh || 0))}</b><span>Verified paid: {money(Number(reservation.paidKsh || 0))}</span><span>Pending payment: {money(Number(reservation.pendingPaymentKsh || 0))}</span><span>Balance due: {money(Number(reservation.balanceDueKsh || 0))}</span></div>
        <div><small>BOOKING SOURCE</small><b>{display(reservation.source)}</b><span>Received {formatDate(reservation.createdAt)}</span></div>
      </div>
      <div className="reservation-review-checklist"><b>Before confirming</b><ul><li>Check the guest&apos;s contact details and stay dates.</li><li>Verify the selected accommodation and guest capacity.</li><li>Contact the guest if any detail needs clarification. A pending payment is not a verified payment.</li></ul></div>
      {error && <p className="room-form-message" role="alert">{error}</p>}
      <footer className="reservation-review-actions"><button type="button" className="outline-btn" disabled={saving} onClick={onClose}>Decide later</button><button type="button" className="record-delete-btn" disabled={saving} onClick={() => void update("cancelled")}>Decline and release room</button><button type="button" className="primary-btn" disabled={saving} onClick={() => void update("confirmed")}>{saving ? "Saving…" : "Confirm booking"}</button></footer>
    </section>
  </div>;
}

const metricIcons: Record<string, string> = { rooms: "bed", occupied: "guest", available: "bed", arrivals: "door", departures: "door", pending: "calendar", revenue: "card", outstanding: "card", occupancy: "chart", adr: "chart", revpar: "chart" };
function Table({ rows, columns, onRowClick }: { rows: Row[]; columns: [string, string, (row: Row) => ReactNode][]; onRowClick?: (row: Row) => void }) {
  if (!rows.length) return <Empty title="No records yet" text="Records will appear here once they have been entered and saved."/>;
  return <div className="module-card"><div className="table-scroll"><table className="data-table"><thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.reference || row.id || row.key || index)} className={onRowClick ? "guest-profile-row" : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined} onKeyDown={onRowClick ? (event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onRowClick(row); } } : undefined} tabIndex={onRowClick ? 0 : undefined} aria-label={onRowClick ? `Open guest profile for ${String(row.name || "guest")}` : undefined}>{columns.map(([label, , value]) => <td key={label}>{value(row)}</td>)}</tr>)}</tbody></table></div></div>;
}

function GuestProfileDialog({ guest, reservations, onClose, onPayment }: { guest: Row; reservations: Row[]; onClose: () => void; onPayment: (reference: string) => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [onClose]);
  const name = String(guest.name || "Guest");
  const email = String(guest.email || "");
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  const lifetimeSpend = Number(guest.lifetimeRoomSpend || 0);
  const totalStays = Number(guest.stays || reservations.length);
  return <div className="guest-profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="guest-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-profile-title">
      <header className="guest-profile-banner">
        <div className="guest-profile-banner-decoration" aria-hidden="true"><span>H</span></div>
        <button className="guest-profile-close" type="button" onClick={onClose} aria-label="Close guest profile">×</button>
        <div className="guest-profile-identity">
          <span className="guest-profile-avatar">{initials || "G"}</span>
          <div><span className="guest-profile-eyebrow">HAPPYLAND · GUEST PROFILE</span><h2 id="guest-profile-title">{name}</h2><p>{email || "Email address not provided"}</p></div>
          <span className={`guest-profile-loyalty${totalStays > 1 ? " returning" : ""}`}>{totalStays > 1 ? "Returning guest" : "Guest"}</span>
        </div>
      </header>
      <div className="guest-profile-content">
        <section className="guest-profile-stats" aria-label="Guest stay summary">
          <article><span>Total stays</span><b>{totalStays}</b><small>{totalStays === 1 ? "reservation on record" : "reservations on record"}</small></article>
          <article><span>Lifetime room spend</span><b>{money(lifetimeSpend)}</b><small>Accommodation charges</small></article>
          <article><span>Last check-out</span><b>{formatDate(guest.lastCheckOut)}</b><small>Most recent departure</small></article>
        </section>
        <div className="guest-profile-columns">
          <section className="guest-profile-card"><div className="guest-profile-section-heading"><span>01 / ABOUT</span><h3>Guest details</h3></div>
            <dl className="guest-profile-details">
              <div><dt>Email</dt><dd>{email ? <a href={`mailto:${email}`}>{email}</a> : "Not provided"}</dd></div>
              <div><dt>Phone</dt><dd>{guest.phone ? <a href={`tel:${String(guest.phone)}`}>{String(guest.phone)}</a> : "Not provided"}</dd></div>
              <div><dt>Nationality</dt><dd>{display(guest.nationality)}</dd></div>
              <div><dt>ID / passport</dt><dd>{display(guest.idDocument)}</dd></div>
              <div><dt>Preferences</dt><dd>{display(guest.preferences)}</dd></div>
              <div><dt>Staff notes</dt><dd>{display(guest.notes)}</dd></div>
            </dl>
          </section>
          <section className="guest-profile-card guest-profile-history"><div className="guest-profile-section-heading"><span>02 / STAY HISTORY</span><h3>Reservations <small>{reservations.length}</small></h3></div>
            {reservations.length ? <div className="guest-stay-list">{reservations.map((reservation) => {
              const status = String(reservation.status || "pending");
              const stayAndServices = Number(reservation.totalKsh || 0) + Number(reservation.serviceChargesKsh || 0);
              return <article className="guest-stay-card" key={String(reservation.reference)}>
                <div className="guest-stay-top"><span>{formatDate(reservation.checkIn)} <i>→</i> {formatDate(reservation.checkOut)}</span><b className={`guest-stay-status ${status}`}>{status.replaceAll("-", " ")}</b></div>
                <h4>{display(reservation.roomName || reservation.roomSlug)}</h4>
                <p>{reservation.roomCodes ? `Room ${String(reservation.roomCodes).replaceAll(",", " · ")}` : "Room assignment pending"} · {Number(reservation.guests || 1)} {Number(reservation.guests || 1) === 1 ? "guest" : "guests"} · {display(reservation.source)}</p>
                <div className="guest-stay-financial"><span>Stay + services <b>{money(stayAndServices)}</b></span><span>Verified <b>{money(Number(reservation.paidKsh || 0))}</b></span><span>Pending <b>{money(Number(reservation.pendingPaymentKsh || 0))}</b></span><span>Balance due <b>{money(Number(reservation.balanceDueKsh || 0))}</b></span></div>
                {Number(reservation.availableToRecordKsh) > 0 && !["cancelled", "no-show"].includes(status) && <button type="button" className="guest-stay-payment" onClick={() => onPayment(String(reservation.reference))}>Record a payment <span>→</span></button>}
              </article>;
            })}</div> : <div className="guest-profile-no-stays"><span aria-hidden="true">✦</span><b>First stay, fresh memories</b><p>No reservations are linked to this guest yet.</p></div>}
          </section>
        </div>
      </div>
    </section>
  </div>;
}

function NotificationsPage({ notifications, unreadCount, selectedId, openNotification, clearNotifications, markAllRead }: { notifications: StaffNotification[]; unreadCount: number; selectedId: number | null; openNotification: (id: number) => void; clearNotifications: () => void; markAllRead: () => void }) {
  const selected = notifications.find((item) => item.id === selectedId);
  const detailEntries = selected?.details ? Object.entries(selected.details).filter(([key, value]) => value !== "" && value !== null && value !== undefined && !["guestEmail", "guestPhone", "enquiryMessage"].includes(key)) : [];
  return <section className="notifications-page">
    <div className="module-intro"><div><span className="module-crumb">HOTEL OPERATIONS</span><h1>Notifications</h1><p>Bookings, guest enquiries, and payment updates from the hotel system.</p></div><div className="module-actions">{unreadCount > 0 && <button className="outline-btn" type="button" onClick={markAllRead}>Mark all as read</button>}<button className="primary-btn" type="button" disabled={!notifications.length} onClick={clearNotifications}>Clear notifications</button></div></div>
    <div className="notification-feed">
      {!notifications.length ? <Empty title="You’re all caught up" text="New reservations, website enquiries, and payment updates will appear here."/> : notifications.map((item) => <button type="button" key={item.id} className={`notification-feed-item${item.readAt ? "" : " unread"}${selectedId === item.id ? " focused" : ""}`} onClick={() => openNotification(item.id)}>
        <span className={`notification-type-mark ${item.type}`}><Icon>{item.type === "payment" ? "card" : item.type === "enquiry" ? "guest" : "calendar"}</Icon></span>
        <span className="notification-feed-copy"><b>{item.title}</b><span>{item.message}</span><time>{notificationDateTime(item.createdAt)}</time></span>
        {!item.readAt && <i className="notification-unread-dot" aria-label="Unread"/>}
      </button>)}
    </div>
    {selected && <article className="notification-detail-card"><div><span className={`notification-type-mark ${selected.type}`}><Icon>{selected.type === "payment" ? "card" : selected.type === "enquiry" ? "guest" : "calendar"}</Icon></span><span><small>NOTIFICATION DETAILS</small><h2>{selected.title}</h2><p>{selected.message}</p></span></div><dl>{detailEntries.map(([key, value]) => <div key={key}><dt>{key.replaceAll(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}</dt><dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd></div>)}{typeof selected.details.guestEmail === "string" && <div><dt>Guest email</dt><dd><a href={`mailto:${selected.details.guestEmail}`}>{selected.details.guestEmail}</a></dd></div>}{typeof selected.details.guestPhone === "string" && selected.details.guestPhone && <div><dt>Guest phone</dt><dd><a href={`tel:${selected.details.guestPhone}`}>{selected.details.guestPhone}</a></dd></div>}</dl>{typeof selected.details.enquiryMessage === "string" && <p className="notification-enquiry-message">{selected.details.enquiryMessage}</p>}</article>}
  </section>;
}

function CheckoutsPage({ reservations, guestCount, date, onGuest }: { reservations: CheckoutReservation[]; guestCount: number; date: string; onGuest: (guest: Row) => void }) {
  const displayDate = date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)) : "Today";
  return <section className="checkouts-page">
    <div className="module-intro"><div><span className="module-crumb">FRONT DESK · DEPARTURES</span><h1>Guests checking out today</h1><p>{displayDate} · Confirm departures and prepare room turnover.</p></div><div className="checkout-guest-total"><b>{guestCount}</b><span>{guestCount === 1 ? "guest" : "guests"} · {reservations.length} {reservations.length === 1 ? "reservation" : "reservations"}</span></div></div>
    {!reservations.length ? <Empty title="No check-outs scheduled" text="There are no active guest departures scheduled for today."/> : <div className="checkout-list">{reservations.map((reservation) => <article className="checkout-card" key={reservation.reference}><div className="checkout-card-heading"><span className="checkout-room-icon"><Icon>door</Icon></span><div><b>{reservation.accommodationName || "Accommodation"}</b><small>{reservation.roomCodes || "Room assignment not recorded"} · Ref {reservation.reference}</small></div><span className={`checkout-status ${reservation.status}`}>{reservation.status.replaceAll("-", " ")}</span></div><div className="checkout-card-info"><div><small>GUEST</small><button type="button" className="guest-profile-link" onClick={() => onGuest({ name: reservation.guestName, email: reservation.guestEmail, phone: reservation.guestPhone })}>{reservation.guestName}</button></div><div><small>PARTY SIZE</small><b>{reservation.guests} {reservation.guests === 1 ? "guest" : "guests"}</b></div><div><small>CHECK-OUT DATE</small><b>{formatDate(reservation.checkOut)}</b></div><div><small>CHECK-IN</small><b>{formatDate(reservation.checkIn)}</b></div></div><div className="checkout-contact"><a href={`mailto:${reservation.guestEmail}`}>{reservation.guestEmail}</a>{reservation.guestPhone && <a href={`tel:${reservation.guestPhone}`}>{reservation.guestPhone}</a>}<span>Source: {reservation.source}</span></div></article>)}</div>}
  </section>;
}

export function Dashboard({ snapshot, roomsPublic, signedIn, staffName, go, onQuick, today }: { snapshot: LiveSnapshot; roomsPublic: Row[]; signedIn: boolean; staffName?: string; go: (section: Section) => void; onQuick: (type: "booking" | "payment" | "maintenance" | "expense") => void; today: string }) {
  const m = snapshot.dashboard;
  const publicRoomCount = roomsPublic.reduce((sum, room) => sum + Number(room.inventory || 0), 0);
  const publicReservations = signedIn ? snapshot.reservations : [];
  const verifiedToday = Number(m.revenueKsh || 0);
  const adr = publicReservations.length ? Math.round(publicReservations.reduce((sum, row) => sum + Number(row.nightlyRateKsh || 0), 0) / publicReservations.length) : 0;
    const values = [
    ["Total rooms", signedIn ? m.totalRooms || 0 : publicRoomCount, "Configured inventory", "Rooms", "rooms", "green"], ["Occupied rooms", signedIn ? m.occupiedRooms || 0 : "-", "Currently checked in", "Check-in / Check-out", "occupied", "green"], ["Available rooms", signedIn ? m.availableRooms || 0 : "-", "Ready to sell", "Rooms", "available", "gold"], ["Today's arrivals", signedIn ? m.arrivals || 0 : "-", "Scheduled check-ins", "Check-in / Check-out", "arrivals", "blue"], ["Today's departures", signedIn ? m.departures || 0 : "-", "Scheduled check-outs", "Check-outs Today", "departures", "violet"],
    ["Pending reservations", signedIn ? m.pendingReservations || 0 : "-", "Awaiting confirmation", "Reservations", "pending", "gold"], ["Today's revenue", signedIn ? money(verifiedToday) : "-", "Verified payments", "Payments", "revenue", "gold"], ["Outstanding payments", signedIn ? money(m.outstandingKsh || 0) : "-", "Open guest folios", "Payments", "outstanding", "gold"], ["Occupancy rate", signedIn ? `${m.occupancyRate || 0}%` : "-", "Of configured room units", "Reports", "occupancy", "green"], ["Average daily rate", signedIn ? money(adr) : "-", "From saved reservations", "Reports", "adr", "green"], ["RevPAR", signedIn ? money(Math.round(adr * Number(m.occupancyRate || 0) / 100)) : "-", "ADR x occupancy", "Reports", "revpar", "green"],
  ] as const;
  const recent = snapshot.reservations.slice(0, 5);
  const arrivals = snapshot.reservations.filter((r) => String(r.checkIn) === String(m.date) && ["pending", "confirmed"].includes(String(r.status))).slice(0, 4);
  const weekStart = new Date(`${m.date || new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date())}T00:00:00Z`);
  const calendarDates = Array.from({ length: 7 }, (_, index) => { const date = new Date(weekStart); date.setUTCDate(date.getUTCDate() + index); return { iso: date.toISOString().slice(0, 10), day: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(date), date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", timeZone: "UTC" }).format(date) }; });
  const roomRows = (signedIn ? snapshot.roomUnits : roomsPublic).filter((room) => room.active === undefined || Number(room.active) === 1);
  const departures = snapshot.reservations.filter((r) => String(r.checkOut) === String(m.date) && r.status === "checked-in").slice(0, 4);
  return <>
    <section className="welcome-banner"><Image src="/images/herohome.png" alt="HappyLand Hotel Diani" fill priority sizes="(max-width: 900px) 100vw, 1500px" unoptimized/><div className="welcome-overlay"/><div className="welcome-copy"><div className="welcome-eyebrow"><i/> PROPERTY OPERATIONS <span>|</span> LIVE DATA</div><h1>Welcome back{staffName ? `, ${staffName}` : ""}!</h1><p>Here&apos;s what&apos;s happening at HappyLand Hotel Diani today.</p><div className="welcome-lower"><span><Icon>calendar</Icon> {today}</span></div></div></section>
    <section className="metric-grid">{values.map(([label, value, sub, target, symbol, tone]) => <button key={label} className={`metric-card ${tone}`} onClick={() => go(target as Section)}><span className="metric-symbol"><Icon>{metricIcons[symbol]}</Icon></span><div className="metric-details"><span>{label}</span><b>{value}</b><i>{sub}</i></div></button>)}</section>
    <section className="dashboard-grid">
      <article className="panel calendar-panel"><div className="panel-heading"><div><span><b>Booking calendar</b><small>Live occupancy from saved reservations</small></span></div><button className="view-all" onClick={() => go("Reservations")}>View reservations </button></div>{signedIn ? roomRows.length ? <div className="calendar-scroll"><div className="calendar-table"><div className="calendar-head"><span className="room-col">ROOM / TYPE</span>{calendarDates.map((date) => <span key={date.iso} className={date.iso === String(m.date) ? "today" : ""}><i>{date.day}</i><b>{date.date}</b></span>)}</div>{roomRows.map((room) => <div className="calendar-row" key={String(room.id || room.slug)}><span className="room-col"><b>{String(room.code || room.name)}</b><small>{String(room.category || room.name)} · {money(Number(room.nightlyRateKsh))}</small></span><div className="calendar-track">{calendarDates.map((date) => <i key={date.iso} className={date.iso === String(m.date) ? "today-cell" : ""}/>)}{snapshot.reservations.filter((booking) => (typeof booking.roomCodes === "string" ? booking.roomCodes.split(",").includes(String(room.code)) : booking.roomUnitId ? Number(booking.roomUnitId) === Number(room.id) : booking.roomSlug === room.slug && snapshot.roomUnits.findIndex((unit) => unit.slug === room.slug) === snapshot.roomUnits.findIndex((unit) => unit.id === room.id)) && String(booking.status) !== "cancelled" && String(booking.checkIn) < calendarDates.at(-1)!.iso && String(booking.checkOut) > calendarDates[0].iso).map((booking) => { const start = Math.max(0, calendarDates.findIndex((date) => date.iso >= String(booking.checkIn))); const end = Math.min(7, calendarDates.findIndex((date) => date.iso >= String(booking.checkOut)) === -1 ? 7 : calendarDates.findIndex((date) => date.iso >= String(booking.checkOut))); const span = end - start; return span > 0 ? <button className={`booking-bar ${booking.status === "checked-in" ? "green" : booking.status === "pending" ? "amber" : "blue"}`} key={String(booking.reference)} style={{ gridColumn: `${start + 1} / span ${span}` }} title={`${String(booking.name)} · ${String(booking.reference)}`} onClick={() => go("Reservations")}>{String(booking.name)}<small> </small></button> : null; })}</div></div>)}</div></div> : <Empty title="No room inventory" text="Add physical rooms to start using the booking calendar."/> : <Empty title="Manager sign-in required" text="Sign in to view the booking calendar."/>}<div className="calendar-legend"><span><i className="legend-dot green"/> Checked in</span><span><i className="legend-dot blue"/> Confirmed</span><span><i className="legend-dot amber"/> Pending</span><button onClick={() => go("Rooms")}>Manage rooms </button></div></article>
      <article className="panel bookings-panel"><div className="panel-heading"><div><span><b>Recent reservations</b><small>Saved booking records</small></span></div><button className="view-all" onClick={() => go("Reservations")}>View all </button></div>{signedIn ? <Table rows={recent} columns={[["GUEST", "", (r) => display(r.name)], ["ROOM TYPE", "", (r) => display(r.roomSlug)], ["CHECK-IN", "", (r) => formatDate(r.checkIn)], ["STATUS", "", (r) => display(r.status)]]}/> : <Empty title="Manager sign-in required" text="Sign in to view reservations and private hotel totals."/>}</article>
      <article className="panel arrivals-panel"><div className="panel-heading"><div><span><b>Arrivals today</b><small>Based on reservation dates</small></span></div><button className="view-all" onClick={() => go("Check-in / Check-out")}>Front desk </button></div>{signedIn ? arrivals.length ? arrivals.map((r) => <div className="arrival-row" key={String(r.reference)}><span><b>{display(r.name)}</b><small>{display(r.roomSlug)}   {display(r.reference)}</small></span><button onClick={() => go("Check-in / Check-out")}>Open </button></div>) : <Empty title="No arrivals scheduled" text="There are no reservations arriving today."/> : <Empty title="Manager sign-in required" text="Sign in to view the arrivals list."/>}</article>
      <article className="panel departures-panel"><div className="panel-heading"><div><span><b>Departures today</b><small>Checked-in guests due to leave</small></span></div><button className="view-all" onClick={() => go("Check-in / Check-out")}>Front desk </button></div>{signedIn ? departures.length ? departures.map((r) => <div className="arrival-row" key={String(r.reference)}><span><b>{display(r.name)}</b><small>{display(r.roomSlug)}   {display(r.reference)}</small></span><button onClick={() => go("Check-in / Check-out")}>Open </button></div>) : <Empty title="No departures due" text="There are no checked-in guests departing today."/> : <Empty title="Manager sign-in required" text="Sign in to view departures."/>}</article>
      <article className="panel occupancy-panel"><div className="panel-heading"><div><span><b>Occupancy today</b><small>Checked-in guests against room stock</small></span></div><button className="view-all" onClick={() => go("Reports")}>Reports </button></div>{signedIn ? <div className="occupancy-content"><div className="occupancy-ring" style={{ background: `conic-gradient(#12805a 0% ${m.occupancyRate || 0}%,#e2bd73 ${m.occupancyRate || 0}% 100%)` }}><div><b>{m.occupancyRate || 0}<span>%</span></b><small>OCCUPIED</small></div></div><div className="occupancy-stats"><div><i className="legend-dot green"/><span>Occupied</span><b>{m.occupiedRooms || 0} rooms</b></div><div><i className="legend-dot gold"/><span>Available</span><b>{m.availableRooms || 0} rooms</b></div><div><i className="legend-dot blue"/><span>Today&apos;s arrivals</span><b>{m.arrivals || 0} guests</b></div></div></div> : <Empty title="Manager sign-in required" text="Sign in to view occupancy."/>}</article>
      <article className="room-feature"><div className="room-feature-photo"><Image src={roomRows[0]?.imageUrl ? String(roomRows[0].imageUrl) : "/images/herohome.png"} alt={String(roomRows[0]?.category || roomRows[0]?.name || "HappyLand Hotel Diani")} fill sizes="(max-width: 900px) 100vw, 340px" unoptimized/><span>FEATURED ROOM</span></div><div className="room-feature-copy"><div><span>ROOM INVENTORY</span><i className="room-ready">{roomRows.length} physical rooms</i></div>{roomRows[0] ? <><h3>{String(roomRows[0].name)}</h3><p>A comfortable stay at HappyLand Hotel Diani.</p><div className="room-amenities"><span> Up to {Number(roomRows[0].maxGuests || roomRows[0].guests)} guests</span><span>{String(roomRows[0].category || roomRows[0].name)}</span><span>{Number(roomRows[0].bedCount || 0)} beds</span></div><div className="room-feature-bottom"><b>{money(Number(roomRows[0].nightlyRateKsh))} <small>/ night</small></b><button onClick={() => go("Rooms")}>View room details</button></div></> : <><h3>No rooms configured</h3><p>Add physical room inventory to make it available to the booking website.</p><div className="room-feature-bottom"><button onClick={() => go("Rooms")}>Configure rooms </button></div></>}</div></article>
      <article className="panel quick-panel"><div className="panel-heading"><div><span><b>Quick actions</b><small>Open a saved workflow</small></span></div></div><div className="quick-grid">{([["New reservation", "booking"], ["Record payment", "payment"], ["Report maintenance", "maintenance"], ["Add expense", "expense"]] as const).map(([label, action]) => <button key={label} className="quick-action" onClick={() => onQuick(action)}><b>{label}</b></button>)}</div></article>
    </section>
  </>;
}

function PaymentRecords({ rows, folios, onReceipt, onGuest, onDelete, canVerify, isAdmin }: { rows: Row[]; folios: Row[]; onReceipt: (reference: string, print: boolean) => void; onGuest: (guest: Row) => void; onDelete: (kind: "payment", reference: string, summary: string) => void; canVerify: boolean; isAdmin: boolean }) {
  const [reference, setReference] = useState("");
  const [decision, setDecision] = useState<"verify" | "reject">("verify");
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState("");
  async function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch(`/api/admin/payments/${encodeURIComponent(reference)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, rejectionReason }),
    });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Payment could not be reviewed."); return; }
    window.location.reload();
  }
  return <>
    <section className="module-card">
      <h2>Reservation balances</h2>
      {folios.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{["RESERVATION", "GUEST", "ROOM", "ROOM CHARGES", "SERVICE CHARGES", "VERIFIED", "PENDING", "BALANCE DUE", "AVAILABLE TO RECORD"].map((v) => <th key={v}>{v}</th>)}</tr></thead><tbody>{folios.map((folio, i) => <tr key={String(folio.reservationReference || i)}><td>{display(folio.reservationReference)}</td><td>{display(folio.guest)}</td><td>{display(folio.room)}</td><td>{money(Number(folio.roomCharges))}</td><td>{money(Number(folio.serviceCharges))}</td><td>{money(Number(folio.paid))}</td><td>{money(Number(folio.pending))}</td><td>{money(Number(folio.balanceDue))}</td><td>{money(Number(folio.availableToRecord))}</td></tr>)}</tbody></table></div> : <Empty title="No reservations to reconcile" text="Reservation balances will appear here when stays are created."/>}
    </section>
    {rows.length ? <div className="module-card"><h2>Payment records</h2><div className="table-scroll"><table className="data-table"><thead><tr>{["RECEIPT", "GUEST", "RESERVATION", "AMOUNT", "METHOD", "TRANSACTION REF", "RECORDED BY", "REVIEWED BY", "STATUS / REVIEW", "RECEIPT ACTIONS", ...(isAdmin ? ["DELETE"] : [])].map((v) => <th key={v}>{v}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={String(r.reference || i)}><td>{display(r.receiptNumber)}</td><td><button type="button" className="guest-profile-link" onClick={() => onGuest({ name: r.guest, email: r.guestEmail, phone: r.guestPhone })}>{display(r.guest)}</button></td><td>{display(r.reservationReference)}</td><td>{money(Number(r.amountKsh))}</td><td>{display(r.method)}</td><td>{display(r.transactionReference)}</td><td>{display(r.recorder)}</td><td>{display(r.verifier)}</td><td>    {String(r.status) === "pending" ? !canVerify ? "Awaiting an authorized reviewer" : reference === String(r.reference) ? <form className="verify-form" onSubmit={review}>
    <label>Decision<select value={decision} onChange={(event) => setDecision(event.target.value === "reject" ? "reject" : "verify")}><option value="verify">Verify payment</option><option value="reject">Reject payment</option></select></label>
    {decision === "reject" && <label>Reason<textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={500} required/></label>}
    <button>{decision === "reject" ? "Reject payment" : "Verify payment"}</button>{error && <small>{error}</small>}
    </form> : <button type="button" className="verify-trigger" onClick={() => { setReference(String(r.reference)); setDecision("verify"); setRejectionReason(""); setError(""); }}>Review</button> : <>{display(r.status)}{r.rejectionReason ? <small>{String(r.rejectionReason)}</small> : null}</>}</td><td><div className="receipt-row-actions"><button type="button" className="verify-trigger" onClick={() => onReceipt(String(r.reference), false)}>Preview</button><button type="button" className="verify-trigger" onClick={() => onReceipt(String(r.reference), true)}>Print</button></div></td>{isAdmin && <td><button type="button" className="record-delete-btn" onClick={() => onDelete("payment", String(r.reference), `${display(r.receiptNumber)} · ${money(Number(r.amountKsh))}`)}>Delete</button></td>}</tr>)}</tbody></table></div></div> : <Empty title="No payments recorded" text="Payments appear here after they have been linked to a reservation."/>}
  </>;
}

export function Module({ section, snapshot, roomsPublic, signedIn, search, action, onQuick, onReceipt, persistRecord, refresh, openNotification, clearNotifications, markAllNotificationsRead, selectedNotificationId, staffRole }: { section: Section; snapshot: LiveSnapshot; roomsPublic: Row[]; signedIn: boolean; search: string; action: (message: string) => void; onQuick: (type: "booking" | "payment" | "maintenance" | "expense", reservationReference?: string) => void; onReceipt: (reference: string, print: boolean) => void; persistRecord: (kind: string, record: Row) => Promise<Row | null>; refresh: () => Promise<void>; openNotification: (id: number) => void; clearNotifications: () => void; markAllNotificationsRead: () => void; selectedNotificationId: number | null; staffRole: StaffRole | null }) {
  const titles: Partial<Record<Section, string>> = { Reservations: "Reservations", Notifications: "Notifications", Rooms: "Rooms and rates", Guests: "Guest profiles", "Check-in / Check-out": "Front desk", Payments: "Payments and folios", Housekeeping: "Housekeeping", Maintenance: "Maintenance", "Guest Services": "Guest services", Inventory: "Inventory", Reports: "Reports", Expenses: "Expenses", Suppliers: "Suppliers", Settings: "Property settings" };
  const [roomMessage, setRoomMessage] = useState("");
  const [recordMessage, setRecordMessage] = useState("");
  const [editingRoom, setEditingRoom] = useState<Row | null>(null);
  const [roomFormOpen, setRoomFormOpen] = useState(false);
  const [roomSaving, setRoomSaving] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Row | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<Row | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Row | null>(null);
  const [roomPhotos, setRoomPhotos] = useState<string[]>([]);
  const [roomRates, setRoomRates] = useState<number[]>(Array(7).fill(0));
  const [defaultRate, setDefaultRate] = useState(0);
  const protectedPage = section !== "Rooms";
  const allRecords: Row[] = section === "Reservations" || section === "Check-in / Check-out" ? snapshot.reservations
    : section === "Guests" ? snapshot.guests
      : section === "Payments" ? snapshot.financial.payments
        : section === "Housekeeping" ? snapshot.records.housekeeping || []
          : section === "Maintenance" ? snapshot.records.maintenance || []
            : section === "Guest Services" ? [...(snapshot.financial.charges || []), ...(snapshot.records.service || [])]
              : section === "Inventory" ? snapshot.records.inventory || []
                : section === "Expenses" ? snapshot.records.expense || []
                  : section === "Suppliers" ? snapshot.records.supplier || [] : [];
  const rows = allRecords.filter((r) => !search || Object.values(r).join(" ").toLowerCase().includes(search.toLowerCase()));
  const closeGuestProfile = useCallback(() => setSelectedGuest(null), []);
  function openGuestProfile(candidate: Row) {
    const email = String(candidate.email || candidate.guestEmail || "").trim().toLowerCase();
    const profile = snapshot.guests.find((guest) => String(guest.email || "").trim().toLowerCase() === email);
    setSelectedGuest(profile ? { ...candidate, ...profile } : {
      ...candidate,
      name: candidate.name || candidate.guest || candidate.guestName || "Guest",
      email: candidate.email || candidate.guestEmail || "",
      phone: candidate.phone || candidate.guestPhone || "",
    });
  }
  const selectedGuestEmail = String(selectedGuest?.email || "").trim().toLowerCase();
  const guestReservations = selectedGuestEmail
    ? snapshot.reservations.filter((reservation) => String(reservation.email || "").trim().toLowerCase() === selectedGuestEmail)
    : [];
  const propertyProfile = snapshot.records.settings?.find((row) => row.key === "property-profile" || row.id === "property-profile") || {};
  if (section === "Notifications") return signedIn
    ? <NotificationsPage notifications={snapshot.notifications.filter((item) => !search || `${item.title} ${item.message} ${item.type}`.toLowerCase().includes(search.toLowerCase()))} unreadCount={snapshot.unreadNotifications} selectedId={selectedNotificationId} openNotification={openNotification} clearNotifications={clearNotifications} markAllRead={markAllNotificationsRead}/>
    : <Empty title="Manager sign-in required" text="Sign in to view private hotel notifications."/>;
  if (section === "Check-outs Today") return signedIn
    ? <><CheckoutsPage reservations={snapshot.todayCheckouts} guestCount={snapshot.todayGuestCount} date={snapshot.todayDate} onGuest={openGuestProfile}/>{selectedGuest && <GuestProfileDialog guest={selectedGuest} reservations={guestReservations} onClose={closeGuestProfile} onPayment={(reference) => { closeGuestProfile(); onQuick("payment", reference); }}/>}</>
    : <Empty title="Manager sign-in required" text="Sign in to view guest departure details."/>;
  async function saveRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (roomSaving) return;
    setRoomSaving(true);
    setRoomMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name"));
    const slug = String(form.get("slug") || name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    const rates = roomRates.map((rate) => rate || defaultRate);
    if (rates.length !== 7 || rates.some((rate) => !Number.isSafeInteger(rate) || rate < 1)) {
      setRoomMessage("Enter a default nightly rate and a valid rate for each day.");
      setRoomSaving(false);
      return;
    }
    try {
      const response = await fetch("/api/admin/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name,
          abbreviation: String(form.get("abbreviation")),
          inventory: Number(form.get("inventory")),
          maxGuests: Number(form.get("maxGuests")),
          nightlyRateKsh: rates[0],
          weeklyRatesKsh: rates,
          bedCount: Number(form.get("bedCount")),
          bedConfiguration: String(form.get("bedConfiguration")),
          shortDescription: String(form.get("shortDescription")),
          description: String(form.get("description")),
          imageUrl: String(form.get("imageUrl")),
          images: [...new Set([...roomPhotos, ...String(form.get("images")).split(/\r?\n/).map((image) => image.trim()).filter(Boolean)])],
          amenities: String(form.get("amenities")).split(",").map((amenity) => amenity.trim()).filter(Boolean),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setRoomMessage(result.error || "Room could not be saved.");
        return;
      }
      formElement.reset();
      setEditingRoom(null);
      setSelectedRoom(null);
      setRoomFormOpen(false);
      setRoomRates(Array(7).fill(0));
      setDefaultRate(0);
      await refresh();
      action(editingRoom ? "Room details updated." : "Room added.");
    } catch (error) {
      setRoomMessage(error instanceof Error ? error.message : "Room could not be saved. Please try again.");
    } finally {
      setRoomSaving(false);
    }
  }
  async function addRoomPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const payload = new FormData(); payload.append("file", file);
      const response = await fetch("/api/admin/room-photos", { method: "POST", body: payload });
      const result = await response.json();
      if (!response.ok) { setRoomMessage(result.error || "Photo upload failed."); continue; }
      setRoomPhotos((current) => [...current, String(result.url)].slice(0, 12));
    }
    event.target.value = "";
  }
  async function saveRoomPhotos() {
    if (!selectedRoom) return;
    const response = await fetch("/api/admin/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: selectedRoom.slug, name: selectedRoom.name, abbreviation: selectedRoom.abbreviation || "", inventory: Number(selectedRoom.inventory), maxGuests: Number(selectedRoom.maxGuests), nightlyRateKsh: Number(selectedRoom.nightlyRateKsh), weeklyRatesKsh: selectedRoom.weeklyRatesKsh, bedCount: Number(selectedRoom.bedCount || 1), bedConfiguration: String(selectedRoom.bedConfiguration || "1 double bed"), shortDescription: String(selectedRoom.shortDescription || ""), description: String(selectedRoom.description || ""), imageUrl: roomPhotos[0] || "", images: roomPhotos, amenities: Array.isArray(selectedRoom.amenities) ? selectedRoom.amenities : [] }) });
    const result = await response.json();
    if (!response.ok) { setRoomMessage(result.error || "Room photos could not be saved."); return; }
    setRoomMessage("Room photos saved and shared with the website.");
    await refresh();
    const updated = await fetch("/api/admin/rooms", { cache: "no-store" });
    const data = await updated.json();
    const latestRoom = (data.rooms || []).find((room: Row) => room.slug === selectedRoom.slug) || selectedRoom;
    setRoomPhotos(Array.isArray(latestRoom.images) ? latestRoom.images as string[] : latestRoom.image ? [String(latestRoom.image)] : []);
    setSelectedRoom(latestRoom);
    action("Room photos updated.");
  }
  async function saveOperationalForm(event: React.FormEvent<HTMLFormElement>, kind: string) {
    event.preventDefault(); setRecordMessage(""); const formElement = event.currentTarget; const form = new FormData(formElement); const record: Record<string, unknown> = Object.fromEntries(form.entries());
    if (kind === "settings" && typeof record.contentJson === "string") {
      try { const content = JSON.parse(record.contentJson); if (!content || typeof content !== "object" || Array.isArray(content)) throw new Error("Enter a JSON object."); delete record.contentJson; Object.assign(record, content); }
      catch { setRecordMessage("Enter valid JSON content before saving."); return; }
    }
    for (const key of ["amountKsh", "quantity", "reorderAt", "unitCostKsh", "inventory", "maxGuests"]) if (key in record) record[key] = Number(record[key]);
    if (kind === "service") record.status = "posted";
    const saved = await persistRecord(kind, record); if (saved) { formElement.reset(); await refresh(); setRecordMessage("Record saved."); }
  }
  async function updateReservation(row: Row, status: string): Promise<boolean> {
    const response = await fetch(`/api/admin/reservations/${encodeURIComponent(String(row.reference))}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "Reservation status could not be changed.");
    await refresh();
    action(status === "confirmed"
      ? result.emailSent ? "Booking confirmed and guest email sent." : "Booking confirmed. Email is not configured; contact the guest directly."
      : status === "cancelled"
        ? result.emailSent ? "Booking declined and guest email sent; room availability released." : "Booking declined; room availability released. Contact the guest directly."
        : `Reservation marked ${status}.`);
    return true;
  }
  async function deleteRecord(kind: "reservation" | "payment", reference: string, summary: string) {
    const prompt = kind === "reservation"
      ? `Permanently delete reservation ${reference} for ${summary}?\n\nAll payment records and folio charges linked to this reservation will also be deleted. This cannot be undone.`
      : `Permanently delete payment ${summary}?\n\nThis changes the reservation balance and cannot be undone.`;
    if (!window.confirm(prompt)) return;
    const path = kind === "reservation"
      ? `/api/admin/reservations/${encodeURIComponent(reference)}/purge`
      : `/api/admin/payments/${encodeURIComponent(reference)}`;
    const response = await fetch(path, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) { action(result.error || "Record could not be deleted."); return; }
    await refresh();
    action(kind === "reservation" ? "Reservation and linked payment/folio records deleted." : "Payment record deleted.");
  }
  const reservationDeleteColumn: [string, string, (row: Row) => ReactNode][] = staffRole === "admin"
    ? [["DELETE", "", (row) => <button type="button" className="record-delete-btn" onClick={() => void deleteRecord("reservation", String(row.reference), display(row.name))}>Delete</button>]]
    : [];
  if (section === "Settings" && staffRole !== "admin") return <Empty title="Administrator access required" text="Property and staff settings are restricted to administrators."/>;
  if (isRoomsSection(section)) return <RoomManagement rooms={snapshot.rooms} units={snapshot.roomUnits} combinations={snapshot.combinations} reservations={snapshot.reservations} signedIn={signedIn} canDelete={staffRole !== null && staffRole !== "manager"} search={search} action={action} refresh={refresh}/>;
  return <><section className="module-intro"><div><span className="module-crumb">HOTEL OPERATIONS</span><h1>{titles[section] || section}</h1><p>Live records stored in the hotel database.</p></div><div className="module-actions">{section === "Rooms" && signedIn && <button className="primary-btn" onClick={() => { setEditingRoom(null); setRoomMessage(""); setRoomPhotos([]); setRoomRates(Array(7).fill(0)); setDefaultRate(0); setRoomFormOpen(true); }}>Add room</button>}{section === "Reservations" && <button className="primary-btn" onClick={() => onQuick("booking")}> New reservation</button>}{section === "Payments" && <button className="primary-btn" onClick={() => onQuick("payment")}> Record payment</button>}{section === "Maintenance" && <button className="primary-btn" onClick={() => onQuick("maintenance")}> Report issue</button>}{section === "Expenses" && <button className="primary-btn" onClick={() => onQuick("expense")}> Add expense</button>}</div></section>
    {protectedPage && !signedIn ? <Empty title="Manager sign-in required" text="Sign in with your configured manager password to view and update these private hotel records."/> : null}
    {section === "Rooms" ? <>
      <div className="room-card-grid">{roomsPublic.filter((room) => !search || Object.values(room).join(" ").toLowerCase().includes(search.toLowerCase())).map((room) => <article className="managed-room-card" key={String(room.slug)}><button type="button" className="managed-room-open" onClick={() => { const rates = Array.isArray(room.weeklyRatesKsh) && room.weeklyRatesKsh.length === 7 ? room.weeklyRatesKsh as number[] : Array(7).fill(Number(room.nightlyRateKsh || 0)); setRoomRates(rates); setDefaultRate(rates.every((rate) => rate === rates[0]) ? Number(rates[0]) : 0); setRoomMessage(""); setRoomPhotos(Array.isArray(room.images) ? room.images as string[] : room.image ? [String(room.image)] : []); setSelectedRoom(room); }} aria-label={`View ${String(room.name)} details`}><div className="managed-room-photo">{room.image ? <Image src={String(room.image)} alt={String(room.name)} fill sizes="(max-width:700px) 100vw, 360px" unoptimized/> : <span aria-hidden="true"></span>}<i className={Number(room.inventory) > 0 ? "room-status-live" : "room-status-empty"}>{Number(room.inventory) > 0 ? "Available" : "No rooms"}</i></div><div className="managed-room-copy"><span className="managed-room-kicker">{display(room.abbreviation || "ROOM DETAILS")}</span><h2>{display(room.name)}</h2><p>{Number(room.maxGuests || 0)} guests   {display(room.bedConfiguration || "Bed details not set")}</p><div className="managed-room-meta"><b>{money(Number(room.nightlyRateKsh))}<small> / night</small></b><span>{Number(room.inventory || 0)} rooms</span></div><span className="managed-room-link">View details <b></b></span></div></button></article>)}</div>{!roomsPublic.length && <Empty title="No rooms added yet" text="Use Add room above to set up inventory and the rates shown on the website."/>}
      {signedIn && roomFormOpen && <div className="modal-backdrop room-form-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !roomSaving) setRoomFormOpen(false); }}><section className="room-editor-modal" role="dialog" aria-modal="true" aria-labelledby="room-editor-title"><header className="room-editor-heading"><div><span className="module-crumb">ROOM SETUP</span><h2 id="room-editor-title">{editingRoom ? `Edit ${String(editingRoom.name)}` : "Add room"}</h2></div><button type="button" className="outline-btn" onClick={() => setRoomFormOpen(false)} disabled={roomSaving}>Close</button></header><form key={String(editingRoom?.slug || "new-room")} className="room-setup-form room-type-form" onSubmit={(event) => void saveRoom(event)}><p>Set up rooms that share the same name, layout, capacity, and prices. Their availability updates as guests book.</p>{roomMessage && <p className="room-form-message" role="alert">{roomMessage}</p>}<div><input type="hidden" name="slug" defaultValue={String(editingRoom?.slug || "")}/><div className="room-core-fields"><label>Room name<input name="name" required minLength={2} placeholder="e.g. Double Room" defaultValue={String(editingRoom?.name || "")}/></label><label>Short name<input name="abbreviation" maxLength={40} placeholder="e.g. Double" defaultValue={String(editingRoom?.abbreviation || "")}/></label><label>Maximum guests<input name="maxGuests" type="number" min="1" max="20" required placeholder="e.g. 2" defaultValue={editingRoom ? Number(editingRoom.maxGuests) : ""}/></label></div><section className="room-pricing" aria-label="Default nightly rates"><div className="room-section-heading"><span>Default rate</span><small>KSh per night</small></div><label className="default-rate-field">Default KSh per night<span className="rate-input"><i>KSh</i><input type="number" min="1" step="1" required value={defaultRate || ""} onChange={(event) => { const amount = Number(event.target.value); setDefaultRate(amount); setRoomRates(Array(7).fill(amount)); }} placeholder="0"/></span></label><div className="weekday-rate-heading">Optional rates by day</div><div className="weekday-rates">{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day, index) => <label key={day}>{day}<span className="rate-input"><i>KSh</i><input aria-label={`${day} nightly rate in Kenyan shillings`} type="number" min="1" step="1" value={roomRates[index] || ""} onChange={(event) => setRoomRates((current) => current.map((rate, rateIndex) => rateIndex === index ? Number(event.target.value) : rate))} placeholder={String(defaultRate || 0)}/></span></label>)}</div><button type="button" className="rate-quick-fill" onClick={() => { if (defaultRate > 0) setRoomRates(Array(7).fill(defaultRate)); }}>Use default rate for every day</button></section><div className="room-core-fields"><label>Number of beds<input name="bedCount" type="number" min="1" max="20" required defaultValue={editingRoom ? Number(editingRoom.bedCount || 1) : 1}/></label><label>Bed layout<input name="bedConfiguration" required maxLength={160} placeholder="1 double bed" defaultValue={String(editingRoom?.bedConfiguration || "1 double bed")}/></label><label>Number of rooms<input name="inventory" type="number" min="0" max="10000" required defaultValue={editingRoom ? Number(editingRoom.inventory) : ""}/></label></div><details className="room-extra-fields"><summary>Website details (optional)</summary><div><label className="room-type-wide">Short description<input name="shortDescription" maxLength={240} placeholder="A short summary shown on the website" defaultValue={String(editingRoom?.shortDescription || "")}/></label><label className="room-type-wide">Full description<textarea name="description" maxLength={3000} rows={3} placeholder="What guests should know about this room" defaultValue={String(editingRoom?.description || "")}/></label><label className="room-type-wide">Main room photo URL<input name="imageUrl" maxLength={1000} placeholder="https://... or /images/rooms/room.jpg" defaultValue={String(editingRoom?.imageUrl || editingRoom?.image || "")}/></label><label className="room-type-wide">Additional photo URLs<textarea name="images" rows={3} placeholder="One public image URL per line" defaultValue={Array.isArray(editingRoom?.images) ? (editingRoom.images as string[]).join("\n") : ""}/></label><label className="room-type-wide">Amenities<input name="amenities" placeholder="Wi-Fi, balcony, air conditioning" defaultValue={Array.isArray(editingRoom?.amenities) ? (editingRoom.amenities as string[]).join(", ") : ""}/></label></div></details><button className="primary-btn" disabled={roomSaving}>{roomSaving ? "Saving room..." : editingRoom ? "Save room" : "Add room"}</button>{editingRoom && <button type="button" className="outline-btn" onClick={() => { setEditingRoom(null); setRoomFormOpen(false); setRoomRates(Array(7).fill(0)); setDefaultRate(0); }} disabled={roomSaving}>Cancel</button>}</div></form></section></div>}
      {selectedRoom && <div className="room-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRoom(null); }}><section className="room-detail-panel" role="dialog" aria-modal="true" aria-labelledby="room-detail-heading"><header><div><span className="module-crumb">ROOM DETAILS</span><h2 id="room-detail-heading">{display(selectedRoom.name)}</h2></div><button type="button" className="room-detail-close" onClick={() => setSelectedRoom(null)} aria-label="Close room details">x</button></header><div className="room-detail-body"><div className="room-detail-gallery">{roomPhotos.length ? roomPhotos.map((photo, index) => <div className="room-detail-photo" key={`${photo}-${index}`}><Image src={photo} alt={`${String(selectedRoom.name)} photo ${index + 1}`} fill sizes="(max-width:760px) 90vw, 480px" unoptimized/><button type="button" onClick={() => setRoomPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} aria-label="Remove photo">x</button></div>) : <div className="room-detail-photo-placeholder"><span></span><b>No room photos yet</b><small>Add photos to share with the booking website.</small></div>}</div><div className="room-detail-facts"><article><span>Maximum guests</span><b>{Number(selectedRoom.maxGuests || 0)}</b></article><article><span>Beds</span><b>{display(selectedRoom.bedConfiguration || `${Number(selectedRoom.bedCount || 0)} beds`)}</b></article><article><span>Rooms in inventory</span><b>{Number(selectedRoom.inventory || 0)}</b></article><article><span>Default rate</span><b>{money(Number(selectedRoom.defaultRateKsh || selectedRoom.nightlyRateKsh))} / night</b></article></div><div className="room-detail-weekly">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => <div key={day}><span>{day}</span><b>{money(Number((selectedRoom.weeklyRatesKsh as number[] | undefined)?.[index] || selectedRoom.nightlyRateKsh))}</b></div>)}</div><div className="room-detail-copy"><h3>Website description</h3><p>{display(selectedRoom.description || selectedRoom.shortDescription || "No description added yet.")}</p><h3>Amenities</h3><p>{Array.isArray(selectedRoom.amenities) && selectedRoom.amenities.length ? (selectedRoom.amenities as string[]).join("   ") : "No amenities added yet."}</p></div><label className="room-photo-upload">Add photos<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => void addRoomPhoto(event)}/><small>JPEG, PNG, WebP or AVIF. Up to 8 MB each.</small></label>{roomMessage && <p className="room-detail-message">{roomMessage}</p>}</div><footer><button type="button" className="outline-btn" onClick={() => { setEditingRoom(selectedRoom); setRoomMessage(""); setSelectedRoom(null); setRoomFormOpen(true); }}>Edit room details</button><button type="button" className="primary-btn" onClick={() => void saveRoomPhotos()}>Save room and photos</button></footer></section></div>}
    </> : null}
    {section === "Reservations" && signedIn ? <><Table rows={rows} columns={[["GUEST", "", (r) => <button type="button" className="guest-profile-link" onClick={() => openGuestProfile(r)}>{display(r.name)} <small>{display(r.email)}</small></button>], ["ROOM TYPE", "", (r) => display(r.roomName || r.roomSlug)], ["STAY", "", (r) => `${formatDate(r.checkIn)} - ${formatDate(r.checkOut)}`], ["SOURCE", "", (r) => display(r.source)], ["TOTAL", "", (r) => money(Number(r.totalKsh))], ["BALANCE", "", (r) => money(Number(r.balanceDueKsh))], ["STATUS", "", (r) => String(r.status) === "pending" ? <button type="button" className="reservation-review-trigger" onClick={() => setSelectedReservation(r)}>Review booking</button> : <select className="row-status" aria-label={`Change status for ${String(r.name)}`} value={String(r.status)} onChange={(event) => void updateReservation(r, event.target.value).catch((error) => action(error.message))}>{statusesFor(String(r.status)).map((status) => <option key={status}>{status}</option>)}</select>], ["PAYMENT", "", (r) => Number(r.availableToRecordKsh) > 0 && !["cancelled", "no-show", "pending", "inquiry"].includes(String(r.status)) ? <button className="verify-trigger" onClick={() => onQuick("payment", String(r.reference))}>Record payment</button> : ["pending", "inquiry"].includes(String(r.status)) ? "Awaiting confirmation" : "—"], ["REFERENCE", "", (r) => display(r.reference)], ...reservationDeleteColumn]}/>{selectedReservation && <ReservationReviewDialog reservation={selectedReservation} onClose={() => setSelectedReservation(null)} onStatus={updateReservation}/>}</> : null}
    {section === "Check-in / Check-out" && signedIn ? <><section className="front-desk-intro"><b>Front desk actions</b><span>Only confirmed bookings can be checked in. Review new website requests in Reservations first.</span></section><Table rows={rows.filter((r) => ["confirmed", "checked-in"].includes(String(r.status)))} columns={[["GUEST", "", (r) => <button type="button" className="guest-profile-link" onClick={() => openGuestProfile(r)}>{display(r.name)}</button>], ["EMAIL", "", (r) => display(r.email)], ["PHONE", "", (r) => display(r.phone)], ["ROOM TYPE", "", (r) => display(r.roomName || r.roomSlug)], ["ROOM UNIT", "", (r) => display(r.roomCodes)], ["GUESTS", "", (r) => String(r.guests || 0)], ["ARRIVAL", "", (r) => formatDate(r.checkIn)], ["DEPARTURE", "", (r) => formatDate(r.checkOut)], ["STATUS", "", (r) => <select className="row-status" aria-label={`Change status for ${String(r.name)}`} value={String(r.status)} onChange={(event) => void updateReservation(r, event.target.value).catch((error) => action(error.message))}>{statusesFor(String(r.status)).map((status) => <option key={status}>{status}</option>)}</select>], ["REFERENCE", "", (r) => display(r.reference)]]}/></> : null}
    {section === "Guests" && signedIn ? <><Table rows={rows} onRowClick={openGuestProfile} columns={[["GUEST", "", (r) => <button type="button" className="guest-profile-link" onClick={() => openGuestProfile(r)}>{display(r.name)} <span>View profile ↗</span></button>], ["EMAIL", "", (r) => display(r.email)], ["PHONE", "", (r) => display(r.phone)], ["NATIONALITY", "", (r) => display(r.nationality)], ["ID / PASSPORT", "", (r) => display(r.idDocument)], ["PREFERENCES", "", (r) => display(r.preferences)], ["NOTES", "", (r) => display(r.notes)], ["STAYS", "", (r) => String(r.stays || 0)], ["LIFETIME ROOM SPEND", "", (r) => money(Number(r.lifetimeRoomSpend))], ["LAST CHECK-OUT", "", (r) => formatDate(r.lastCheckOut)]]}/><form className="room-setup-form" onSubmit={(event) => void saveOperationalForm(event, "guest")}><h2>Add or update a guest profile</h2><p>Use the guest email address to update an existing profile.</p><div><label>Full name<input name="name" required minLength={2}/></label><label>Email<input name="email" type="email" required/></label><label>Phone<input name="phone"/></label><label>Nationality<input name="nationality"/></label><label>ID / passport<input name="idDocument"/></label><label>Preferences<input name="preferences"/></label><label>Notes<input name="notes"/></label><button className="primary-btn">Save guest</button></div>{recordMessage && <small>{recordMessage}</small>}</form></> : null}
    {section === "Payments" && signedIn ? <PaymentRecords rows={rows} folios={snapshot.financial.folios} onReceipt={onReceipt} onGuest={openGuestProfile} onDelete={deleteRecord} canVerify={staffRole !== null && staffRole !== "receptionist"} isAdmin={staffRole === "admin"}/> : null}
    {section === "Housekeeping" && signedIn ? <HousekeepingManagement tasks={snapshot.records.housekeeping || []} roomUnits={snapshot.roomUnits} search={search} persistRecord={persistRecord} refresh={refresh} action={action}/> : null}
    {!["Rooms", "Reservations", "Check-in / Check-out", "Guests", "Payments", "Dashboard", "Housekeeping", "Settings", "Reports"].includes(section) && signedIn ? <Table rows={rows} columns={[["RECORD", "", (r) => display(r.description || r.name || r.task || r.issue || r.item || r.guest || r.room || r.category)], ["DETAIL", "", (r) => display(r.supplier || r.assignedTo || r.reservationReference || r.amountKsh)], ["STATUS", "", (r) => ["Housekeeping", "Maintenance"].includes(section) ? <select className="row-status" aria-label={`Update ${String(r.description || r.task || r.issue || "record")}`} value={String(r.status || "reported")} onChange={(event) => void persistRecord(section === "Housekeeping" ? "housekeeping" : "maintenance", { ...r, status: event.target.value })}>{["reported", "in-progress", "ready", "done"].map((status) => <option key={status}>{status}</option>)}</select> : display(r.status)], ["UPDATED", "", (r) => formatDate(r.updatedAt || r.createdAt)]]}/> : null}
    {section === "Reports" && signedIn ? <div className="report-live-grid">{[["Room inventory", `${snapshot.dashboard.totalRooms || 0}`, "Configured active room count"], ["Reservations", `${snapshot.dashboard.reservationCount || 0}`, "Current records excluding cancellations and no-shows"], ["Occupancy", `${snapshot.dashboard.occupancyRate || 0}%`, "Checked-in guests against configured room inventory"], ["Verified revenue today", money(snapshot.dashboard.revenueKsh || 0), "Payments verified today"], ["Outstanding folios", money(snapshot.dashboard.outstandingKsh || 0), "Unpaid room and posted service charges"]].map(([name, value, note]) => <article key={name}><span>{name}</span><b>{value}</b><small>{note}</small></article>)}</div> : null}
    {section === "Inventory" && signedIn ? <InventoryManagement items={rows} movements={snapshot.inventoryMovements} suppliers={snapshot.records.supplier || []} persistRecord={persistRecord} refresh={refresh} action={action}/> : null}
    {section === "Suppliers" && signedIn ? <form className="room-setup-form" onSubmit={(event) => void saveOperationalForm(event, "supplier")}><h2>Add a supplier</h2><div><label>Supplier name<input name="name" required/></label><label>Category<input name="category"/></label><label>Contact person<input name="contact"/></label><label>Email<input name="email" type="email"/></label><label>Phone<input name="phone"/></label><button className="primary-btn">Save supplier</button></div>{recordMessage && <small>{recordMessage}</small>}</form> : null}
    {section === "Guest Services" && signedIn ? <form className="room-setup-form" onSubmit={(event) => void saveOperationalForm(event, "service")}><h2>Post a service to a guest folio</h2><p>Select an existing reservation so the charge stays linked to the guest account.</p><div><label>Reservation<select name="reservationReference" required defaultValue=""><option value="" disabled>Select reservation</option>{snapshot.reservations.filter((r) => !["cancelled", "no-show", "checked-out"].includes(String(r.status))).map((r) => <option key={String(r.reference)} value={String(r.reference)}>{String(r.name)}   {String(r.reference)}</option>)}</select></label><label>Category<input name="category" required/></label><label>Description<input name="description" required/></label><label>Amount (KSh)<input name="amountKsh" type="number" min="0" required/></label><button className="primary-btn">Add to folio</button></div>{recordMessage && <small>{recordMessage}</small>}</form> : null}
    {section === "Settings" && signedIn ? <>{staffRole === "admin" && <StaffUsersPanel/>}<form className="room-setup-form" onSubmit={(event) => void saveOperationalForm(event, "settings")}><h2>Property profile</h2><p>These saved contact details are available to the public hotel API.</p><div><input type="hidden" name="id" defaultValue="property-profile"/><input type="hidden" name="key" defaultValue="property-profile"/><label>Property name<input name="name" required defaultValue={String(propertyProfile.name || "HappyLand Hotel Diani")}/></label><label>Destination<input name="destination" defaultValue={String(propertyProfile.destination || "")} placeholder="City, region and country"/></label><label>Phone<input name="phone" defaultValue={String(propertyProfile.phone || "")}/></label><label>Email<input name="email" type="email" defaultValue={String(propertyProfile.email || "")}/></label><label>Website<input name="website" defaultValue={String(propertyProfile.website || "")}/></label><label>Tagline<input name="tagline" defaultValue={String(propertyProfile.tagline || "")}/></label><button className="primary-btn">Save property profile</button></div>{recordMessage && <small>{recordMessage}</small>}</form><form className="room-setup-form" onSubmit={(event) => void saveOperationalForm(event, "settings")}><h2>Public website content</h2><p>Set the experiences, offers, and gallery arrays returned by the public hotel API. Leave arrays empty when no content is approved.</p><input type="hidden" name="id" defaultValue="public-content"/><input type="hidden" name="key" defaultValue="public-content"/><textarea className="content-json" name="contentJson" rows={10} defaultValue={JSON.stringify(Object.fromEntries(Object.entries(snapshot.records.settings?.find((row) => row.key === "public-content" || row.id === "public-content") || {}).filter(([key]) => ["experiences", "offers", "gallery"].includes(key))), null, 2)}/><button className="primary-btn">Save public content</button>{recordMessage && <small>{recordMessage}</small>}</form></> : null}
    {selectedGuest && <GuestProfileDialog guest={selectedGuest} reservations={guestReservations} onClose={closeGuestProfile} onPayment={(reference) => { closeGuestProfile(); onQuick("payment", reference); }}/>}
  </>;
}

function isRoomsSection(section: Section): boolean { return section === "Rooms"; }
