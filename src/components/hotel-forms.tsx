"use client";

import { FormEvent, useState } from "react";

type AvailableRoom = { slug: string; name: string; availableUnits: number; nightlyRateKsh: number; checkInNightlyRateKsh?: number; weeklyRatesKsh?: number[] };
type ConfirmedReservation = { reference: string; roomName: string; checkIn: string; checkOut: string; guests: number; nights: number; nightlyRateKsh: number; totalKsh: number; email: string };
const currency = (amount: number) => new Intl.NumberFormat("en-KE").format(amount);

export function EnquiryForm() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setStatus("");
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your enquiry could not be saved.");
      setStatus(result.emailSent ? "Your enquiry has been saved and sent to the hotel." : "Your enquiry has been saved. Email notifications are not configured, so please contact the hotel for a prompt reply.");
      formElement.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Your enquiry could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return <form className="enquiry-form" onSubmit={submit}>
    <label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Name" /></label>
    <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label>
    <label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder="Optional" /></label>
    <label>Preferred dates<input name="dates" maxLength={100} placeholder="e.g. 12–16 November" /></label>
    <label className="full">How can we help?<textarea name="message" required minLength={5} maxLength={5000} placeholder="Tell us about your stay or question" /></label>
    <button className="gold-button" type="submit" disabled={busy}>{busy ? "Sending…" : "Send enquiry"} <span aria-hidden="true">→</span></button>
    {status && <p className="form-status" role="status">{status}</p>}
  </form>;
}

export function BookingRequestForm() {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [rooms, setRooms] = useState<AvailableRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [reservation, setReservation] = useState<ConfirmedReservation | null>(null);

  async function checkAvailability() {
    setBusy(true);
    setStatus("");
    setRooms([]);
    setSelectedRoom("");
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setStatus("Choose a check-out date after your check-in date.");
      setBusy(false);
      return;
    }
    try {
      const query = new URLSearchParams({ checkIn, checkOut, guests });
      const response = await fetch(`/api/availability?${query.toString()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Availability could not be checked.");
      setRooms(result.rooms);
      if (!result.rooms.length) setStatus(result.message || "No rooms are available for those dates.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Availability could not be checked. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoom) {
      setStatus("Check availability and choose a room first.");
      return;
    }
    setBusy(true);
    setStatus("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomSlug: selectedRoom,
          checkIn,
          checkOut,
          guests: Number(guests),
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your reservation could not be created.");
      setReservation(result.reservation);
      setStatus(result.emailSent ? "Confirmation email sent." : "Your reservation is saved. Hotel and guest email notifications are not configured yet.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Your reservation could not be created. Please check availability again.");
      if (responseStatusConflict(error)) {
        setRooms([]);
        setSelectedRoom("");
      }
    } finally {
      setBusy(false);
    }
  }

  if (reservation) return <section className="booking-confirmation" role="status">
    <span className="section-kicker">RESERVATION CONFIRMED</span>
    <h2>Your Diani stay is booked.</h2>
    <p>We have reserved your room. Your booking reference is:</p>
    <strong className="booking-reference">{reservation.reference}</strong>
    <dl><div><dt>Room</dt><dd>{reservation.roomName}</dd></div><div><dt>Dates</dt><dd>{reservation.checkIn} to {reservation.checkOut} · {reservation.nights} nights</dd></div><div><dt>Guests</dt><dd>{reservation.guests}</dd></div><div><dt>Stay total</dt><dd>KES {currency(reservation.totalKsh)}</dd></div><div><dt>Confirmation email</dt><dd>{reservation.email}</dd></div></dl>
    <p className="content-note">No payment was collected. The hotel will contact you with payment arrangements. Keep your booking reference for any questions.</p>
    {status && <p className="form-status">{status}</p>}
  </section>;

  return <form className="booking-steps" onSubmit={submit}>
    <section className="booking-step"><span className="section-kicker">STEP 01 · YOUR STAY</span><h3>When would you like to come?</h3><div className="enquiry-form">
      <label>Check-in<input type="date" name="checkIn" required value={checkIn} onChange={(event) => setCheckIn(event.target.value)} /></label>
      <label>Check-out<input type="date" name="checkOut" min={checkIn || undefined} required value={checkOut} onChange={(event) => setCheckOut(event.target.value)} /></label>
      <label>Guests<select name="guests" value={guests} onChange={(event) => setGuests(event.target.value)}><option value="1">1 guest</option><option value="2">2 guests</option><option value="3">3 guests</option><option value="4">4 guests</option><option value="5">5+ guests</option></select></label>
      <button className="text-link availability-check" type="button" onClick={checkAvailability} disabled={busy}>{busy ? "Checking…" : "Check availability →"}</button>
    </div>
      {rooms.length > 0 && <fieldset className="available-rooms"><legend>Available rooms</legend>{rooms.map((room) => <label className={`available-room${selectedRoom === room.slug ? " selected" : ""}`} key={room.slug}><input type="radio" name="selectedRoom" value={room.slug} checked={selectedRoom === room.slug} onChange={() => setSelectedRoom(room.slug)} /><span><b>{room.name}</b><small>{room.availableUnits} room{room.availableUnits === 1 ? "" : "s"} · KES {currency(room.checkInNightlyRateKsh || room.nightlyRateKsh)} per night</small></span></label>)}</fieldset>}
    </section>
    <section className="booking-step"><span className="section-kicker">STEP 02 · YOUR DETAILS</span><h3>Who is staying?</h3><div className="enquiry-form">
      <label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Name" /></label>
      <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label>
      <label className="full">Phone<input name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder="Optional" /></label>
    </div></section>
    <button className="gold-button" type="submit" disabled={busy || !selectedRoom}>{busy ? "Confirming…" : "Confirm reservation"} <span aria-hidden="true">→</span></button>
    {status && <p className="content-note" role="status">{status}</p>}
  </form>;
}

function responseStatusConflict(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("no longer available");
}
