"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Dashboard, emptySnapshot, Icon, LiveSnapshot, Module, Section, StaffIdentity } from "../operations-live";
import "../operations.css";
import { PaymentReceiptDialog } from "../../components/receipts/PaymentReceipt";
import "../../components/receipts/receipt-print.css";


const nav: { name: Section; icon: string; group: string }[] = [
  { name: "Dashboard", icon: "dashboard", group: "OVERVIEW" }, { name: "Reservations", icon: "calendar", group: "OVERVIEW" }, { name: "Notifications", icon: "bell", group: "OVERVIEW" }, { name: "Check-outs Today", icon: "door", group: "OVERVIEW" }, { name: "Rooms", icon: "bed", group: "OVERVIEW" },
  { name: "Guests", icon: "guest", group: "OVERVIEW" }, { name: "Check-in / Check-out", icon: "door", group: "OVERVIEW" },
  { name: "Payments", icon: "card", group: "OPERATIONS" }, { name: "Housekeeping", icon: "clean", group: "OPERATIONS" }, { name: "Maintenance", icon: "tools", group: "OPERATIONS" },
  { name: "Guest Services", icon: "service", group: "OPERATIONS" }, { name: "Inventory", icon: "inventory", group: "OPERATIONS" },
  { name: "Reports", icon: "chart", group: "BUSINESS" }, { name: "Expenses", icon: "receipt", group: "BUSINESS" }, { name: "Suppliers", icon: "truck", group: "BUSINESS" }, { name: "Settings", icon: "settings", group: "ADMINISTRATION" },
];
const nairobiDate = (offset = 0) => { const date = new Date(); date.setUTCDate(date.getUTCDate() + offset); return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); };
const formatKsh = (amount: number) => `KSh ${new Intl.NumberFormat("en-KE").format(amount || 0)}`;
const notificationTime = (value: string) => {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", timeZone: "Africa/Nairobi" }).format(date);
};

const sectionPaths: Record<Section, string> = { Dashboard: "", Reservations: "operations/reservations", Notifications: "operations/notifications", "Check-outs Today": "operations/checkouts", Rooms: "operations/rooms", Guests: "operations/guests", "Check-in / Check-out": "operations/front-desk", Payments: "operations/payments", Housekeeping: "operations/housekeeping", Maintenance: "operations/maintenance", "Guest Services": "operations/guest-services", Inventory: "operations/inventory", Reports: "operations/reports", Expenses: "operations/expenses", Suppliers: "operations/suppliers", Settings: "operations/settings" };
function sectionFromPath(path: string): Section { return (Object.entries(sectionPaths).find(([, slug]) => slug && path.replace(/^\/+|\/+$/g, "") === slug)?.[0] as Section | undefined) || "Dashboard"; }

export function HotelOperations({ initialSection }: { initialSection: Section }) {
  const localTesting = process.env.NODE_ENV === "development";
  const [section, setSection] = useState<Section>(initialSection);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<"booking" | "payment" | "maintenance" | "expense" | null>(null);
  const [paymentReservationReference, setPaymentReservationReference] = useState("");
  const [receiptReference, setReceiptReference] = useState("");
  const [receiptAutoPrint, setReceiptAutoPrint] = useState(false);
  const [toast, setToast] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUsername, setAdminUsername] = useState("admin");
  const [signedIn, setSignedIn] = useState(false);
  const [staffIdentity, setStaffIdentity] = useState<StaffIdentity | null>(null);
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationSound, setNotificationSound] = useState(() => {
    try { return typeof window !== "undefined" && window.localStorage.getItem("happyland.notification-sound") !== "off"; }
    catch { return true; }
  });
  const [selectedNotificationId, setSelectedNotificationId] = useState<number | null>(null);
  const knownNotificationIds = useRef(new Set<number>());
  const hasNotificationBaseline = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const today = nairobiDate();

  useEffect(() => {
    const syncPath = () => {
      const next = sectionFromPath(window.location.pathname);
      if (next === "Settings" && staffIdentity?.role !== "admin") {
        window.history.replaceState({}, "", "/");
        setSection("Dashboard");
      } else setSection(next);
    };
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, [staffIdentity?.role]);

  useEffect(() => {
    document.body.classList.toggle("staff-admin", staffIdentity?.role === "admin");
    return () => document.body.classList.remove("staff-admin");
  }, [staffIdentity?.role]);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const publicResponse = await fetch("/api/public/hotel", { cache: "no-store" });
      const publicData = await publicResponse.json();
      const rooms = Array.isArray(publicData.rooms) ? publicData.rooms : [];
      let staffData: Record<string, unknown> | null = null;
      const staffResponse = await fetch("/api/admin/operations?kind=all", { cache: "no-store" });
      if (staffResponse.ok) {
        const authenticatedData = await staffResponse.json() as Record<string, unknown>;
        staffData = authenticatedData;
        const authenticatedStaff = authenticatedData.staff as StaffIdentity | undefined;
        setSignedIn(true);
        setStaffIdentity(authenticatedStaff || null);
        if (sectionFromPath(window.location.pathname) === "Settings" && authenticatedStaff?.role !== "admin") {
          setSection("Dashboard");
          window.history.replaceState({}, "", "/");
        }
      } else { setSignedIn(false); setStaffIdentity(null); }
      setSnapshot(staffData ? { ...emptySnapshot, ...staffData, rooms: (staffData.rooms as LiveSnapshot["rooms"] | undefined) || rooms, roomUnits: (staffData.roomUnits as LiveSnapshot["roomUnits"] | undefined) || [], notifications: (staffData.notifications as LiveSnapshot["notifications"] | undefined) || [], unreadNotifications: Number(staffData.unreadCount || 0), todayCheckouts: (staffData.todayCheckouts as LiveSnapshot["todayCheckouts"] | undefined) || [], todayGuestCount: Number(staffData.todayGuestCount || 0), todayDate: String(staffData.todayDate || ""), dashboard: (staffData.dashboard as LiveSnapshot["dashboard"] | undefined) || {}, records: (staffData.records as LiveSnapshot["records"] | undefined) || {}, inventoryMovements: (staffData.inventoryMovements as LiveSnapshot["inventoryMovements"] | undefined) || [], financial: (staffData.financial as LiveSnapshot["financial"] | undefined) || { payments: [], charges: [], folios: [] }, guests: (staffData.guests as LiveSnapshot["guests"] | undefined) || [], reservations: (staffData.reservations as LiveSnapshot["reservations"] | undefined) || [] } : { ...emptySnapshot, rooms });
      if (staffData && Array.isArray(staffData.notifications) && !hasNotificationBaseline.current) {
        knownNotificationIds.current = new Set((staffData.notifications as { id: number }[]).map((item) => item.id));
        hasNotificationBaseline.current = true;
      }
    } catch { setSnapshot(emptySnapshot); }
    finally { if (showLoading) setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  function playNotificationSound() {
    try {
      const context = audioContext.current;
      if (!context || context.state !== "running") return;
      const now = context.currentTime;
      [0, 0.19].forEach((offset, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = index === 0 ? 880 : 1175;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.12, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + 0.17);
      });
    } catch (error) {
      console.error("Could not play the notification sound", error);
    }
  }

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    let checking = false;
    const pollNotifications = async () => {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch("/api/admin/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as Partial<LiveSnapshot> & { unreadCount?: number };
        if (!active || !Array.isArray(result.notifications)) return;
        const nextIds = new Set(result.notifications.map((item) => item.id));
        const hasNew = result.notifications.some((item) => !knownNotificationIds.current.has(item.id));
        if (hasNotificationBaseline.current && hasNew && notificationSound) playNotificationSound();
        knownNotificationIds.current = nextIds;
        hasNotificationBaseline.current = true;
        setSnapshot((current) => ({ ...current, notifications: result.notifications || [], unreadNotifications: Number(result.unreadCount || 0), todayCheckouts: result.todayCheckouts || [], todayGuestCount: Number(result.todayGuestCount || 0), todayDate: result.todayDate || "" }));
      } catch (error) {
        console.error("Could not refresh staff notifications", error);
      } finally {
        checking = false;
      }
    };
    void pollNotifications();
    const timer = window.setInterval(() => { void pollNotifications(); }, 12000);
    return () => { active = false; window.clearInterval(timer); };
  }, [signedIn, notificationSound]);

  async function primeNotificationAudio() {
    if (!notificationSound) return;
    try {
      const Context = window.AudioContext;
      if (Context) {
        audioContext.current ||= new Context();
        if (audioContext.current.state !== "running") await audioContext.current.resume();
      }
    } catch (error) {
      console.error("Could not activate notification audio", error);
    }
  }

  async function toggleNotificationSound() {
    const next = !notificationSound;
    setNotificationSound(next);
    window.localStorage.setItem("happyland.notification-sound", next ? "on" : "off");
    if (next) {
      try {
        const Context = window.AudioContext;
        if (Context) {
          audioContext.current ||= new Context();
          await audioContext.current.resume();
        }
      } catch (error) {
        console.error("Could not enable notification sound", error);
        action("Sound could not be enabled in this browser. Check your audio permissions.");
      }
    }
  }

  async function updateNotification(actionName: "read-all" | "clear" | "read", id?: number) {
    const response = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actionName === "read" ? { id } : { action: actionName }),
    });
    const result = await response.json();
    if (!response.ok) {
      action(result.error || "Notifications could not be updated.");
      return false;
    }
    setSnapshot((current) => ({ ...current, notifications: result.notifications || [], unreadNotifications: Number(result.unreadCount || 0), todayCheckouts: result.todayCheckouts || [], todayGuestCount: Number(result.todayGuestCount || 0), todayDate: result.todayDate || "" }));
    knownNotificationIds.current = new Set((result.notifications || []).map((item: { id: number }) => item.id));
    return true;
  }

  async function openNotification(id: number) {
    setSelectedNotificationId(id);
    const notification = snapshot.notifications.find((item) => item.id === id);
    if (notification && !notification.readAt) await updateNotification("read", id);
    setNotificationOpen(false);
    go(notification?.type === "checkout" ? "Check-outs Today" : "Notifications");
  }

  async function clearNotifications() {
    if (!await updateNotification("clear")) return;
    setNotificationOpen(false);
    action("Notifications cleared.");
  }

  function go(next: Section) {
    if (next === "Settings" && staffIdentity?.role !== "admin") {
      action("Settings are available to administrators only.");
      return;
    }
    setSection(next);
    const destination = sectionPaths[next] ? `/${sectionPaths[next]}` : "/";
    window.history.pushState({}, "", destination);
    setMenuOpen(false);
  }

  function action(message: string) { setToast(message); window.setTimeout(() => setToast(""), 3000); }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: adminUsername, password: adminPassword }) });
    const result = await response.json();
    if (!response.ok) { action(result.error || "Sign-in failed."); return; }
    setLoginOpen(false); setAdminPassword(""); await refresh();
  }

  async function signOut() {
    const response = await fetch("/api/admin/session", { method: "DELETE" });
    if (!response.ok) { action("You could not be signed out. Please try again."); return; }
    setSignedIn(false); setStaffIdentity(null); setSnapshot({ ...emptySnapshot }); setSection("Dashboard");
    window.history.pushState({}, "", "/");
  }

  async function persistRecord(kind: string, record: Record<string, unknown>) {
    const response = await fetch("/api/admin/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, record }) });
    const result = await response.json();
    if (!response.ok) { action(result.error || "The record could not be saved."); return null; }
    action("Record saved."); return result.saved || result.record || record;
  }

  async function saveActionModal(type: "booking" | "payment" | "maintenance" | "expense", record: Record<string, unknown>) {
    if (type === "booking") {
      const response = await fetch("/api/admin/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The reservation could not be saved.");
      setModal(null);
      action(`Reservation ${result.reservation.reference} created.`);
      void refresh(false);
      return;
    }

    const saved = await persistRecord(type, record);
    if (!saved) throw new Error("The record could not be saved. Check the details and try again.");
    setModal(null);
    if (type === "payment" && typeof saved.reference === "string") {
      setReceiptReference(saved.reference);
      setReceiptAutoPrint(false);
    }
    void refresh(false);
  }

  return <div className="ops-app">
    <aside className={`ops-sidebar${menuOpen ? " sidebar-open" : ""}`}><div className="brand-area"><Image src="/images/logonav.png" alt="HappyLand Hotel Diani" width={218} height={65} priority/></div><div className="property-switch"><span className="property-dot"/><span><b>HappyLand Hotel Diani</b><small>DIANI BEACH, KENYA</small></span><span className="chevron" aria-hidden="true">⌄</span></div><nav className="ops-nav">    {["OVERVIEW", "OPERATIONS", "BUSINESS", "ADMINISTRATION"].map((group) => <div className="nav-group" key={group}><span className="nav-caption">{group}</span>{nav.filter((item) => item.group === group).map((item) => <button key={item.name} className={`nav-link${section === item.name ? " selected" : ""}`} onClick={() => go(item.name)}><Icon>{item.icon}</Icon>{item.name}{item.name === "Notifications" && snapshot.unreadNotifications > 0 && <i className="nav-count">{snapshot.unreadNotifications > 99 ? "99+" : snapshot.unreadNotifications}</i>}</button>)}</div>)}</nav><div className="sidebar-bottom"><article className="coast-card"><Image src="/images/herohome.png" alt="" fill sizes="220px" unoptimized/><div className="coast-shade"/><div className="coast-copy"><span>YOUR COASTAL ESCAPE</span><b>Relax. Rejuvenate.<br/>Repeat.</b></div></article><a className="sidebar-help" href="/contact"><span className="help-mark" aria-hidden="true">?</span><span><b>Need a hand?</b><small>Contact hotel support</small></span><span aria-hidden="true">›</span></a></div></aside>
    <main className="ops-main"><header className="ops-topbar"><button type="button" className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">Menu</button><label className="global-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records..."/></label><div className="top-actions">
      {signedIn && <div className="notification-wrap">
        <button type="button" className="top-icon-button notification-bell" aria-label={`Notifications${snapshot.unreadNotifications ? `, ${snapshot.unreadNotifications} unread` : ""}`} aria-expanded={notificationOpen} onClick={() => { setNotificationOpen((open) => !open); void primeNotificationAudio(); }}><Icon>bell</Icon>{snapshot.unreadNotifications > 0 && <i className="notification-count">{snapshot.unreadNotifications > 99 ? "99+" : snapshot.unreadNotifications}</i>}</button>
        {notificationOpen && <section className="notification-pop" aria-label="Recent notifications">
          <header><b>Notifications{snapshot.unreadNotifications > 0 && <span>{snapshot.unreadNotifications} new</span>}</b><button type="button" className="notification-sound-toggle" onClick={() => void toggleNotificationSound()}>{notificationSound ? "Sound on" : "Sound off"}</button></header>
          <div className="notification-pop-list">{snapshot.notifications.slice(0, 6).map((item) => <button type="button" className={`notification-pop-item${item.readAt ? "" : " unread"}`} key={item.id} onClick={() => void openNotification(item.id)}><span className={`notification-type-mark ${item.type}`}><Icon>{item.type === "payment" ? "card" : item.type === "enquiry" ? "guest" : "calendar"}</Icon></span><span><b>{item.title}</b><small>{item.message}</small><time>{notificationTime(item.createdAt)}</time></span><i className="notification-unread-dot"/></button>)}
          {!snapshot.notifications.length && <p className="notification-empty">You&apos;re all caught up. New bookings and updates will appear here.</p>}
          </div>
          <footer>{snapshot.unreadNotifications > 0 && <button type="button" onClick={() => void updateNotification("read-all")}>Mark all as read</button>}<button type="button" onClick={() => void clearNotifications()} disabled={!snapshot.notifications.length}>Clear notifications</button><button type="button" className="notification-see-all" onClick={() => { setNotificationOpen(false); go("Notifications"); }}>See all notifications</button></footer>
        </section>}
      </div>}
      <button className="outline-btn" onClick={() => { if (localTesting) return; if (signedIn) void signOut(); else setLoginOpen(true); }} disabled={localTesting}>{localTesting ? "Local test mode" : signedIn ? `${staffIdentity?.fullName || "Staff"} · ${staffIdentity?.role || "Staff"}` : "Staff sign in"}</button><span>{new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(new Date())}</span></div></header><div className="ops-content">{loading ? <div className="live-empty">Loading hotel records...</div> : section === "Dashboard" ? <Dashboard snapshot={snapshot} roomsPublic={snapshot.rooms} signedIn={signedIn} staffName={staffIdentity?.fullName || staffIdentity?.username} go={go} onQuick={setModal} today={today}/> : <Module section={section} snapshot={snapshot} roomsPublic={snapshot.rooms} signedIn={signedIn} search={search} action={action} onQuick={(type, reference) => { setPaymentReservationReference(reference || ""); setModal(type); }} onReceipt={(reference, print) => { setReceiptReference(reference); setReceiptAutoPrint(print); }} persistRecord={persistRecord} refresh={refresh} openNotification={(id) => void openNotification(id)} clearNotifications={() => void clearNotifications()} markAllNotificationsRead={() => void updateNotification("read-all")} selectedNotificationId={selectedNotificationId} staffRole={staffIdentity?.role || null}/>}</div></main>
    {toast && <div className="ops-toast" role="status">{toast}</div>}
    {!localTesting && loginOpen && <div className="modal-backdrop"><form className="action-modal" onSubmit={(event) => void signIn(event)}><h2>Staff sign in</h2><label className="sign-in-label">Username<input autoComplete="username" value={adminUsername} onChange={(event) => setAdminUsername(event.target.value)} required/></label><label className="sign-in-label">Password<input autoComplete="current-password" type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} required/></label><div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setLoginOpen(false)}>Cancel</button><button className="primary-btn">Sign in</button></div></form></div>}
    {modal && <div className="modal-backdrop"><ActionModal type={modal} rooms={snapshot.rooms} reservations={snapshot.reservations} initialReservationReference={paymentReservationReference} close={() => setModal(null)} save={(record) => saveActionModal(modal, record)}/></div>}
    {receiptReference && <PaymentReceiptDialog key={receiptReference} reference={receiptReference} autoPrint={receiptAutoPrint} onClose={() => { setReceiptReference(""); setReceiptAutoPrint(false); }}/>}
  </div>;
}

function ActionModal({ type, rooms, reservations, initialReservationReference, close, save }: { type: "booking" | "payment" | "maintenance" | "expense"; rooms: Record<string, unknown>[]; reservations: Record<string, unknown>[]; initialReservationReference: string; close: () => void; save: (record: Record<string, unknown>) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedPaymentReservation, setSelectedPaymentReservation] = useState(initialReservationReference);
  const [roomSearch, setRoomSearch] = useState("");
  const [bedFilter, setBedFilter] = useState("any");
  const [selectedRoomSlug, setSelectedRoomSlug] = useState("");
  const [guests, setGuests] = useState(2);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [availabilityState, setAvailabilityState] = useState<{
    query: string;
    loading: boolean;
    rooms: Record<string, { status: string; availableUnits: number }>;
    error: string;
  }>({ query: "", loading: false, rooms: {}, error: "" });
  const isBooking = type === "booking";
  const payableReservations = reservations.filter((reservation) =>
    !["inquiry", "pending", "cancelled", "no-show"].includes(String(reservation.status)) && Number(reservation.availableToRecordKsh) > 0);
  const selectedPayment = payableReservations.find((reservation) => reservation.reference === selectedPaymentReservation);
  const availabilityQuery = `${checkIn}|${checkOut}|${guests}`;
  const currentAvailability = availabilityState.query === availabilityQuery ? availabilityState : null;
  const hasStayDates = Boolean(checkIn && checkOut && checkOut > checkIn);
  const availabilityChecking = hasStayDates && (!currentAvailability || currentAvailability.loading);
  const availabilityError = currentAvailability?.error || "";
  const activeRooms = rooms.filter((room) => Number(room.active ?? 1) === 1 && Number(room.inventory || 0) > 0);
  const matchingRooms = activeRooms.filter((room) => {
    const bedCount = Number(room.bedCount || 0);
    const maxGuests = Number(room.maxGuests || 0);
    const searchable = `${room.name || ""} ${room.abbreviation || ""} ${room.bedConfiguration || ""} ${bedCount} ${bedCount === 1 ? "bed" : "beds"} ${maxGuests} ${maxGuests === 1 ? "guest" : "guests"}`.toLowerCase();
    return maxGuests >= guests &&
      (bedFilter === "any" || bedCount === Number(bedFilter)) &&
      (!roomSearch.trim() || searchable.includes(roomSearch.trim().toLowerCase()));
  });

  useEffect(() => {
    if (!isBooking || !checkIn || !checkOut || checkOut <= checkIn) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setAvailabilityState({ query: availabilityQuery, loading: true, rooms: {}, error: "" });
      void fetch(`/api/public/hotel?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${guests}`, {
        cache: "no-store",
        signal: controller.signal,
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Room availability could not be checked.");
        const availability: Record<string, { status: string; availableUnits: number }> = {};
        for (const room of result.rooms || []) {
          if (typeof room.slug === "string" && room.availability) availability[room.slug] = room.availability;
        }
        setAvailabilityState({ query: availabilityQuery, loading: false, rooms: availability, error: "" });
      }).catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setAvailabilityState({
          query: availabilityQuery,
          loading: false,
          rooms: {},
          error: requestError instanceof Error ? requestError.message : "Room availability could not be checked.",
        });
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [availabilityQuery, checkIn, checkOut, guests, isBooking]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    const form = new FormData(event.currentTarget);
    if (isBooking) {
      const room = matchingRooms.find((candidate) => candidate.slug === selectedRoomSlug);
      if (!room) {
        setError("Choose a room from the matching suggestions.");
        return;
      }
      const availability = currentAvailability?.rooms[selectedRoomSlug];
      if (availabilityChecking || availability?.status === "unavailable") {
        setError("That room is not available for the selected stay. Choose another room or dates.");
        return;
      }
      if (availabilityError) {
        setError("Check room availability again before saving this reservation.");
        return;
      }
      form.set("roomSlug", selectedRoomSlug);
      form.set("guests", String(guests));
      form.set("checkIn", checkIn);
      form.set("checkOut", checkOut);
    }

    setSaving(true);
    try {
      await save(Object.fromEntries(form.entries()));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The record could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return <section className={`action-modal${isBooking ? " reservation-flow" : ""}`} role="dialog" aria-modal="true" aria-labelledby="action-modal-title">
    <header className="reservation-modal-heading">
      <div><span className="module-crumb">{isBooking ? "FRONT DESK" : "HOTEL OPERATIONS"}</span><h2 id="action-modal-title">{isBooking ? "New reservation" : type === "payment" ? "Record payment" : type === "expense" ? "Add expense" : "Report maintenance"}</h2></div>
      {isBooking && <button type="button" className="outline-btn" onClick={close} disabled={saving}>Close</button>}
    </header>
    <form onSubmit={(event) => void submit(event)}>
      {error && <p className="reservation-form-error" role="alert">{error}</p>}
      {isBooking ? <>
        <section className="reservation-step">
          <h3><span>1</span> Stay and room</h3>
          <div className="reservation-stay-fields">
            <label>Check in<input name="checkIn" type="date" min={nairobiDate()} value={checkIn} onChange={(event) => { setCheckIn(event.target.value); setSelectedRoomSlug(""); }} required/></label>
            <label>Check out<input name="checkOut" type="date" min={checkIn ? nextDate(checkIn) : nairobiDate(1)} value={checkOut} onChange={(event) => { setCheckOut(event.target.value); setSelectedRoomSlug(""); }} required/></label>
            <label>Guests<input name="guests" type="number" min="1" max="20" value={guests} onChange={(event) => { setGuests(Number(event.target.value)); setSelectedRoomSlug(""); }} required/></label>
            <label>Beds<select value={bedFilter} onChange={(event) => { setBedFilter(event.target.value); setSelectedRoomSlug(""); }}><option value="any">Any bed count</option>{[...new Set(activeRooms.map((room) => Number(room.bedCount || 0)).filter((count) => count > 0))].sort((a, b) => a - b).map((count) => <option key={count} value={count}>{count} {count === 1 ? "bed" : "beds"}</option>)}</select></label>
          </div>
          <label className="reservation-room-search">Find a room by name or type<input type="search" value={roomSearch} onChange={(event) => { setRoomSearch(event.target.value); setSelectedRoomSlug(""); }} placeholder="Try Double, single bed, or 2 guests"/></label>
          <div className="reservation-room-suggestions" role="listbox" aria-label="Matching rooms">
            {!activeRooms.length ? <p>No active rooms are configured.</p> : !matchingRooms.length ? <p>No rooms match those guest and bed requirements.</p> : matchingRooms.map((room) => {
              const slug = String(room.slug);
              const availability = currentAvailability?.rooms[slug];
              const unavailable = availability?.status === "unavailable";
              return <button type="button" role="option" aria-selected={selectedRoomSlug === slug} key={slug} className="reservation-room-option" disabled={unavailable || availabilityChecking} onClick={() => setSelectedRoomSlug(slug)}>
                <span><b>{String(room.name)}</b><small>{String(room.abbreviation || room.bedConfiguration || "Room type")} · {Number(room.bedCount || 0)} {Number(room.bedCount || 0) === 1 ? "bed" : "beds"} · up to {Number(room.maxGuests || 0)} guests</small></span>
                <span><b>{formatKsh(Number(room.nightlyRateKsh || 0))}</b><small>{availabilityChecking ? "Checking dates..." : availability ? unavailable ? "Unavailable" : `${availability.availableUnits} available` : `${Number(room.inventory)} rooms`}</small></span>
              </button>;
            })}
          </div>
          {availabilityError && <p className="reservation-availability-error" role="alert">{availabilityError}</p>}
          <label className="reservation-source">Booking source<select name="source"><option>Direct</option><option>Walk-in</option><option>Phone</option><option>WhatsApp</option><option>Website</option><option>Airbnb</option><option>Booking.com</option><option>Expedia</option><option>Travel Agent</option><option>Corporate</option><option>Other</option></select></label>
        </section>
        <section className="reservation-step">
          <h3><span>2</span> Guest details</h3>
          <div className="reservation-guest-fields">
            <label>Full name<input name="name" autoComplete="name" minLength={2} maxLength={120} required/></label>
            <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required/></label>
            <label>Phone number<input name="phone" type="tel" autoComplete="tel" maxLength={40}/></label>
            <label>Nationality<input name="nationality" autoComplete="country-name" maxLength={100}/></label>
            <label>ID / passport number<input name="idDocument" maxLength={200}/></label>
            <label>Preferences<input name="preferences" maxLength={500} placeholder="For example, ground-floor room"/></label>
            <label className="reservation-guest-wide">Guest notes<textarea name="notes" rows={2} maxLength={1000}/></label>
          </div>
        </section>
      </> : <div className="modal-fields">{type === "payment" ? <>
        <label className="full">Reservation<select name="reservationReference" value={selectedPaymentReservation} onChange={(event) => setSelectedPaymentReservation(event.target.value)} required>
          <option value="">Select a reservation</option>
          {payableReservations.map((reservation) => <option key={String(reservation.reference)} value={String(reservation.reference)}>
            {String(reservation.reference)} · {String(reservation.name)} · {String(reservation.roomName || reservation.roomSlug)} · {String(reservation.checkIn)} to {String(reservation.checkOut)}
          </option>)}
        </select></label>
        {selectedPayment ? <p className="full" role="status">
          Balance due {formatKsh(Number(selectedPayment.balanceDueKsh || 0))}; pending verification {formatKsh(Number(selectedPayment.pendingPaymentKsh || 0))}.
          Maximum new payment {formatKsh(Number(selectedPayment.availableToRecordKsh || 0))}.
        </p> : <p className="full">{payableReservations.length ? "Select the exact reservation to link this payment." : "No active reservations have a balance available for a new payment."}</p>}
        <label>Amount (KSh)<input name="amountKsh" type="number" min="1" max={selectedPayment ? Number(selectedPayment.availableToRecordKsh) : undefined} step="1" required disabled={!selectedPayment}/></label>
        <label>Method<select name="method"><option>M-Pesa</option><option>Cash</option><option>Bank transfer</option><option>Card</option><option>Other</option></select></label>
        <label className="full">Transaction reference<input name="transactionReference" maxLength={120} placeholder="M-Pesa receipt or bank reference"/></label>
        <label className="full">Notes<textarea name="notes" rows={2} maxLength={1000}/></label>
      </> : type === "expense" ? <><label>Description<input name="description" required/></label><label>Category<input name="category" required/></label><label>Amount (KSh)<input name="amountKsh" type="number" min="1" required/></label><label>Date<input name="date" type="date" defaultValue={nairobiDate()} required/></label></> : <><label>Room number<input name="room" required/></label><label>Issue type<input name="issue" required/></label><label className="full">Details<textarea name="description" required rows={3}/></label></>}</div>}
      <div className="modal-actions"><button type="button" className="outline-btn" onClick={close} disabled={saving}>Cancel</button><button className="primary-btn" disabled={saving || (isBooking && (!selectedRoomSlug || availabilityChecking))}>{saving ? "Saving..." : isBooking ? "Create reservation" : "Save"}</button></div>
    </form>
  </section>;
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
