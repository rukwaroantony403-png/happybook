"use client";

import { FormEvent, useEffect, useState } from "react";

type Room = { slug: string; name: string; inventory: number; maxGuests: number; nightlyRateKsh: number; active: number };
type Reservation = { reference: string; roomSlug: string; checkIn: string; checkOut: string; guests: number; name: string; email: string; phone: string | null; nightlyRateKsh: number; totalKsh: number; status: string; createdAt: string };
type Enquiry = { id: number; name: string; email: string; phone: string | null; dates: string | null; message: string; createdAt: string };
type Snapshot = { rooms: Room[]; reservations: Reservation[]; enquiries: Enquiry[] };
const money = (value: number) => new Intl.NumberFormat("en-KE").format(value);
const localTesting = process.env.NODE_ENV === "development";

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadDashboard() {
    const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
    if (response.status === 503) { setConfigured(false); return; }
    if (!response.ok) return;
    setSnapshot(await response.json());
    setAuthenticated(true);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/dashboard", { cache: "no-store" }).then(async (response) => {
      if (response.status === 503) return { configured: false as const };
      if (!response.ok) return null;
      return { configured: true as const, snapshot: await response.json() as Snapshot };
    }).then((result) => {
      if (!active || !result) return;
      setConfigured(result.configured);
      if (result.configured) {
        setSnapshot(result.snapshot);
        setAuthenticated(true);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Sign-in failed.");
      setPassword("");
      await loadDashboard();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign-in failed.");
    } finally { setBusy(false); }
  }

  async function saveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/admin/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Room details could not be saved.");
      setStatus("Room inventory and rate saved.");
      await loadDashboard();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Room details could not be saved."); }
    finally { setBusy(false); }
  }

  async function cancelReservation(reference: string) {
    if (!window.confirm(`Cancel reservation ${reference}? Its inventory will become available again.`)) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(`/api/admin/reservations/${encodeURIComponent(reference)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Reservation could not be cancelled.");
      setStatus(`Reservation ${reference} cancelled.`);
      await loadDashboard();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Reservation could not be cancelled."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthenticated(false);
    setSnapshot(null);
  }

  if (!configured) return <section className="interior-content"><div className="wrap admin-login"><span className="section-kicker">STANDALONE HOTEL ADMIN</span><h1>Admin access is not configured</h1><p>Set <code>ADMIN_PASSWORD</code> and a unique <code>ADMIN_SESSION_SECRET</code> of at least 32 characters in the server environment, then restart the app.</p></div></section>;

  if (!authenticated) return <section className="interior-content"><div className="wrap admin-login"><span className="section-kicker">HAPPYLAND HOTEL DIANI</span><h1>Hotel administration</h1><p>{localTesting ? "Authentication is disabled for local development." : "Sign in to manage room inventory and rates and view reservations and enquiries."}</p><form className="enquiry-form admin-login-form" onSubmit={login}>{!localTesting && <label className="full">Admin password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>}<button className="gold-button" disabled={busy}>{busy ? "Signing in…" : localTesting ? "Continue" : "Sign in"}</button>{status && <p className="form-status" role="status">{status}</p>}</form></div></section>;

  return <section className="interior-content admin-page"><div className="wrap">
    <div className="admin-title-row"><div><span className="section-kicker">STANDALONE BOOKING SYSTEM</span><h1>Hotel dashboard</h1><p>Manage publishable room stock and nightly rates. Confirmed bookings immediately reduce availability.</p></div><button className="admin-logout" type="button" onClick={logout}>Sign out</button></div>
    {status && <p className="content-note admin-status" role="status">{status}</p>}
    <section className="admin-section"><div className="admin-section-heading"><div><span className="section-kicker">ROOMS & RATES</span><h2>Sellable inventory</h2></div></div>
      <div className="admin-room-grid">{snapshot?.rooms.map((room) => <form className="admin-room" key={room.slug} onSubmit={saveRoom}><div className="admin-room-title"><h3>{room.name}</h3><code>{room.slug}</code></div><input type="hidden" name="slug" value={room.slug}/><input type="hidden" name="name" value={room.name}/><div className="admin-room-fields"><label>Room units<input type="number" name="inventory" min="0" max="10000" defaultValue={room.inventory} required/></label><label>Guests per room<input type="number" name="maxGuests" min="1" max="20" defaultValue={room.maxGuests} required/></label><label>Nightly rate (KES)<input type="number" name="nightlyRateKsh" min="1" max="100000000" defaultValue={room.nightlyRateKsh} required/></label></div><button className="admin-save" type="submit" disabled={busy}>Save room settings</button></form>)}</div>
      <details className="admin-add-room"><summary>Add a room type</summary><form className="enquiry-form" onSubmit={saveRoom}><label>Slug<input name="slug" placeholder="garden-room" required/></label><label>Room name<input name="name" minLength={2} maxLength={100} placeholder="Garden Room" required/></label><label>Room units<input name="inventory" type="number" min="0" max="10000" defaultValue="1" required/></label><label>Guests per room<input name="maxGuests" type="number" min="1" max="20" defaultValue="2" required/></label><label className="full">Nightly rate (KES)<input name="nightlyRateKsh" type="number" min="1" max="100000000" required/></label><button className="gold-button" type="submit" disabled={busy}>Add room type</button></form></details>
    </section>
    <section className="admin-section"><div className="admin-section-heading"><div><span className="section-kicker">RESERVATIONS</span><h2>Recent bookings</h2></div></div>{snapshot?.reservations.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>Guest</th><th>Room</th><th>Dates</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>{snapshot.reservations.map((booking) => <tr key={booking.reference}><td>{booking.reference}</td><td>{booking.name}<small>{booking.email}</small></td><td>{snapshot.rooms.find((room) => room.slug === booking.roomSlug)?.name || booking.roomSlug}</td><td>{booking.checkIn}<small>to {booking.checkOut} · {booking.guests} guests</small></td><td>KES {money(booking.totalKsh)}</td><td><span className={`booking-state ${booking.status}`}>{booking.status}</span></td><td>{booking.status === "confirmed" && <button className="admin-cancel" type="button" disabled={busy} onClick={() => void cancelReservation(booking.reference)}>Cancel</button>}</td></tr>)}</tbody></table></div> : <p className="admin-empty">No reservations have been recorded yet.</p>}</section>
    <section className="admin-section"><div className="admin-section-heading"><div><span className="section-kicker">GUEST MESSAGES</span><h2>Recent enquiries</h2></div></div>{snapshot?.enquiries.length ? <div className="admin-enquiry-list">{snapshot.enquiries.map((enquiry) => <article key={enquiry.id}><div><b>{enquiry.name}</b><a href={`mailto:${enquiry.email}`}>{enquiry.email}</a><small>{enquiry.phone || "No phone"} · {enquiry.dates || "No dates given"} · {enquiry.createdAt}</small></div><p>{enquiry.message}</p></article>)}</div> : <p className="admin-empty">No enquiries have been recorded yet.</p>}</section>
  </div></section>;
}
