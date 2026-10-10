"use client";

import { useState } from "react";
import Image from "next/image";

type Row = Record<string, unknown>;
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const roomCategories = ["Studio", "1-bedroom", "2-bedroom"];
const categoryAbbreviations: Record<string, string> = { Studio: "STD", "1-bedroom": "1BR", "2-bedroom": "2BR", "3-bedroom": "3BR" };
const ksh = (amount: unknown) => `KSh ${new Intl.NumberFormat("en-KE").format(Number(amount || 0))}`;
const value = (row: Row, key: string, fallback = "") => String(row[key] ?? fallback);

export default function RoomManagement({ rooms, units, combinations, reservations, signedIn, canDelete, search, action, refresh }: { rooms: Row[]; units: Row[]; combinations: Row[]; reservations: Row[]; signedIn: boolean; canDelete: boolean; search: string; action: (message: string) => void; refresh: () => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [rates, setRates] = useState<number[]>(Array(7).fill(0));
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("");
  const [newRoomCategory, setNewRoomCategory] = useState("");
  const [combinationEditing, setCombinationEditing] = useState<Row | null>(null);
  const visible = units.filter((unit) => !search || Object.values(unit).join(" ").toLowerCase().includes(search.toLowerCase()));
  const slugForCategory = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const categoryRows: Row[] = [
    ...roomCategories.map((name) => { const existing = rooms.find((room) => room.slug === slugForCategory(name)); return existing ? { ...existing, saved: true } : { slug: slugForCategory(name), name, inventory: 0, images: [], imageUrl: "", saved: true }; }),
    ...rooms.filter((room) => Number(room.active ?? 1) === 1 && !roomCategories.some((name) => slugForCategory(name) === room.slug) && (Number(room.inventory || 0) > 0 || (Array.isArray(room.images) && room.images.length > 0))).map((room) => ({ ...room, saved: true })),
  ];
  const selectedCategory = categoryRows.find((category) => category.slug === selectedCategorySlug);
  const categoryUnits = visible.filter((unit) => unit.slug === selectedCategorySlug);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const occupiedUnitIds = new Set(units.filter((unit) => reservations.some((reservation) => Number(reservation.roomUnitId) === Number(unit.id) && reservation.status === "checked-in" && String(reservation.checkIn) <= today && String(reservation.checkOut) > today)).map((unit) => Number(unit.id)));
  const selectedUnits = units.filter((unit) => unit.slug === selectedCategorySlug);
  const occupiedCount = selectedUnits.filter((unit) => occupiedUnitIds.has(Number(unit.id))).length;
  const availableCount = Math.max(0, selectedUnits.length - occupiedCount);
  const guestCapacity = selectedUnits.reduce((total, unit) => total + Number(unit.maxGuests || 0), 0);
  const startingRate = selectedUnits.length ? Math.min(...selectedUnits.map((unit) => Number(unit.nightlyRateKsh || 0))) : 0;

  function openAddRooms(category = "") {
    setNewRoomCategory(category);
    setRates(Array(7).fill(0));
    setMessage("");
    setAdding(true);
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const slug = String(form.get("slug") || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    const unitsToAdd = Number(form.get("inventory"));
    const maxGuests = Number(form.get("maxGuests"));
    const bedCount = Number(form.get("bedCount"));
    const bedConfiguration = String(form.get("bedConfiguration") || "").trim();
    const defaultRate = Number(form.get("defaultRate"));
    const weeklyRatesKsh = rates.map((rate) => rate || defaultRate);
    if (weeklyRatesKsh.some((rate) => !Number.isSafeInteger(rate) || rate < 1)) { setMessage("Enter a default nightly rate and valid rates for each day."); setSaving(false); return; }
    try {
      const roomResponse = await fetch("/api/admin/rooms", { cache: "no-store" });
      const roomData = await roomResponse.json();
      const existing = (roomData.rooms || []).find((room: Row) => room.slug === slug) as Row | undefined;
      const inventory = Number(existing?.inventory || 0) + unitsToAdd;
      if (!Number.isInteger(unitsToAdd) || unitsToAdd < 1 || inventory > 10000) { setMessage("Enter a valid number of rooms. A category can contain up to 10,000 rooms."); return; }
      const response = await fetch("/api/admin/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, name, inventory, maxGuests, bedCount, bedConfiguration, nightlyRateKsh: weeklyRatesKsh[0], weeklyRatesKsh, abbreviation: String(form.get("abbreviation") || existing?.abbreviation || categoryAbbreviations[name] || ""), shortDescription: String(existing?.shortDescription || ""), description: String(existing?.description || ""), imageUrl: String(existing?.imageUrl || ""), images: Array.isArray(existing?.images) ? existing.images : [], amenities: Array.isArray(existing?.amenities) ? existing.amenities : [] }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "Room category could not be saved."); return; }
      setAdding(false); setNewRoomCategory(""); setRates(Array(7).fill(0)); await refresh(); action(`${unitsToAdd} ${name} ${unitsToAdd === 1 ? "room added" : "rooms added"}; ${inventory} total. Each room has its own details editor.`);
    } catch { setMessage("Could not connect to the booking system. Try again."); }
    finally { setSaving(false); }
  }

  async function saveUnit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const defaultRate = Number(form.get("nightlyRateKsh"));
    const weeklyRatesKsh = rates.map((rate) => rate || defaultRate);
    if (weeklyRatesKsh.some((rate) => !Number.isSafeInteger(rate) || rate < 1)) { setMessage("Enter a valid nightly rate for every day."); setSaving(false); return; }
    const payload = { action: "update-unit", id: Number(editing.id), code: String(form.get("code") || "").trim(), maxGuests: Number(form.get("maxGuests")), nightlyRateKsh: defaultRate, weeklyRatesKsh, bedCount: Number(form.get("bedCount")), bedConfiguration: String(form.get("bedConfiguration") || "").trim(), shortDescription: String(form.get("shortDescription") || "").trim(), description: String(form.get("description") || "").trim(), operationalStatus: String(form.get("operationalStatus") || "available"), amenities: String(form.get("amenities") || "").split(",").map((item) => item.trim()).filter(Boolean) };
    try {
      const response = await fetch("/api/admin/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "Room details could not be saved."); return; }
      setEditing(null); await refresh(); action(`Room ${payload.code} updated.`);
    } catch { setMessage("Could not connect to the booking system. Try again."); }
    finally { setSaving(false); }
  }

  async function deleteUnit() {
    if (!editing || saving) return;
    const code = value(editing, "code");
    if (!window.confirm(`Remove room ${code} from bookable inventory? Its reservation history will be kept.`)) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/rooms?id=${encodeURIComponent(String(editing.id))}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "Room could not be removed."); return; }
      setEditing(null); await refresh(); action(`Room ${code} removed from inventory. Reservation history was kept.`);
    } catch { setMessage("Could not connect to the booking system. Try again."); }
    finally { setSaving(false); }
  }

  async function updateGallery(room: Row, files: FileList | null) {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    const currentImages = Array.isArray(room.images) ? room.images as string[] : [];
    const slots = Math.max(0, 12 - currentImages.length);
    if (selectedFiles.length > slots) {
      setMessage(slots
        ? `This category has ${currentImages.length} shared photos. You can add up to ${slots} more at a time.`
        : "This category already has the maximum of 12 shared photos. Remove a photo before adding another.");
      return;
    }
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
    const invalidFile = selectedFiles.find((file) => !allowedTypes.has(file.type) || file.size < 1 || file.size > 8 * 1024 * 1024);
    if (invalidFile) {
      setMessage(!allowedTypes.has(invalidFile.type)
        ? `${invalidFile.name}: use a JPEG, PNG, WebP, or AVIF image.`
        : `${invalidFile.name}: room photos must be larger than 0 bytes and no more than 8 MB.`);
      return;
    }
    setSaving(true); setMessage("");
    try {
      const uploaded: string[] = [];
      let uploadError = "";
      for (const file of selectedFiles) {
        const data = new FormData(); data.append("file", file); data.append("category", String(room.slug));
        let response: Response;
        try {
          response = await fetch("/api/admin/room-photos", { method: "POST", body: data });
        } catch {
          uploadError = `${file.name}: could not connect to the booking system.`;
          break;
        }
        let result: { error?: string; url?: string } = {};
        try { result = await response.json() as typeof result; } catch { /* the server may return a non-JSON error response */ }
        if (!response.ok) {
          uploadError = `${file.name}: ${result.error || (response.status === 413 ? "the server rejected the upload as too large." : response.status === 401 ? "manager sign-in has expired; sign in again." : "photo upload failed.")}`;
          break;
        }
        if (typeof result.url !== "string" || !result.url) {
          uploadError = `${file.name}: the server did not confirm the saved photo.`;
          break;
        }
        uploaded.push(result.url);
      }
      if (uploaded.length) await refresh();
      if (uploadError) {
        setMessage(uploaded.length
          ? `${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} uploaded successfully. ${uploadError}`
          : uploadError);
        return;
      }
      action(`${uploaded.length} shared ${value(room, "name")} ${uploaded.length === 1 ? "photo uploaded" : "photos uploaded"}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Room photos could not be saved. Check the server media storage and try again."); }
    finally { setSaving(false); }
  }

  async function saveGallery(room: Row, images: string[], mainImage = String(room.imageUrl || (Array.isArray(room.images) ? room.images[0] : ""))) {
    setSaving(true); setMessage("");
    try {
      const selectedImage = images.includes(mainImage) ? mainImage : images[0] || "";
      const response = await fetch("/api/admin/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-gallery", slug: room.slug, images, imageUrl: selectedImage }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Gallery could not be saved.");
      await refresh(); action(`${String(room.name)} shared photo gallery updated.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Photo could not be removed."); }
    finally { setSaving(false); }
  }

  function openUnit(unit: Row) {
    setRates(Array.isArray(unit.weeklyRatesKsh) ? unit.weeklyRatesKsh.map(Number) : Array(7).fill(Number(unit.nightlyRateKsh || 0)));
    setMessage(""); setEditing(unit);
  }

  async function saveCombination(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!combinationEditing) return;
    setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const unitIds = Array.from((event.currentTarget.elements.namedItem("unitIds") as HTMLSelectElement).selectedOptions).map((option) => Number(option.value));
    const nightlyRateKsh = Number(form.get("nightlyRateKsh"));
    const payload = {
      action: "save-combination",
      name: String(form.get("name") || "").trim(),
      displayName: unitIds.map((id) => value(units.find((unit) => Number(unit.id) === id) || {}, "code")).join(" + "),
      slug: value(combinationEditing, "slug") || `three-bedroom-${unitIds.map((id) => value(units.find((unit) => Number(unit.id) === id) || {}, "code").toLowerCase()).join("-")}`,
      unitIds,
      maxGuests: Number(form.get("maxGuests")),
      nightlyRateKsh,
      weeklyRatesKsh: rates.map((rate) => rate || nightlyRateKsh),
      description: String(form.get("description") || "").trim(),
      bedCount: Number(form.get("bedCount") || 0),
      bedConfiguration: String(form.get("bedConfiguration") || "").trim(),
      amenities: String(form.get("amenities") || "").split(",").map((item) => item.trim()).filter(Boolean),
    };
    try {
      const response = await fetch("/api/admin/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "Combination could not be saved."); return; }
      setCombinationEditing(null); await refresh(); action(`${payload.name} combination saved.`);
    } catch { setMessage("Could not connect to the booking system. Try again."); }
    finally { setSaving(false); }
  }

  async function removeCombination(combination: Row) {
    const slug = value(combination, "slug");
    if (!window.confirm(`Remove ${value(combination, "name")} from public booking?`)) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/rooms?combination=${encodeURIComponent(slug)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "Combination could not be removed."); return; }
      await refresh(); action(`${value(combination, "name")} combination removed.`);
    } catch { setMessage("Could not connect to the booking system. Try again."); }
    finally { setSaving(false); }
  }

  return <div className={`room-management${canDelete ? "" : " no-delete"}`}>
    <section className="module-intro"><div><span className="module-crumb">HOTEL OPERATIONS</span><h1>Rooms</h1><p>{units.length} physical rooms across {categoryRows.length} room categories. Each room has its own editor; only category photos are shared. Three-bedroom stays are virtual combinations of physical rooms.</p></div>{signedIn && <div><button className="outline-btn" type="button" onClick={() => { setRates(Array(7).fill(35000)); setMessage(""); setCombinationEditing({}); }}>Add combination</button><button className="primary-btn" onClick={() => openAddRooms(selectedCategory ? value(selectedCategory, "name") : "")}>Add rooms</button></div>}</section>
    {!!message && !adding && !editing && <p className="room-form-message" role="alert">{message}</p>}
    {signedIn && !selectedCategory && <section className="room-category-browser"><div className="room-category-browser-heading"><div><span className="module-crumb">VIRTUAL ACCOMMODATIONS</span><h2>Multi-room combinations</h2><p>These bookable products reserve every selected physical room together.</p></div></div><div className="room-category-cards">{combinations.filter((combination) => Boolean(combination.active)).map((combination) => <article className="room-category-card" key={value(combination, "slug")}><div className="room-category-card-copy"><span className="managed-room-kicker">VIRTUAL COMBINATION</span><h3>{value(combination, "name")}</h3><p>Uses {Array.isArray(combination.units) ? (combination.units as Row[]).map((unit) => value(unit, "code")).join(" + ") : ""} · Up to {value(combination, "maxGuests")} guests</p><b>{ksh(combination.nightlyRateKsh)} / night</b><div className="room-editor-actions"><button className="outline-btn" type="button" onClick={() => { setRates(Array.isArray(combination.weeklyRatesKsh) ? combination.weeklyRatesKsh.map(Number) : Array(7).fill(Number(combination.nightlyRateKsh || 0))); setMessage(""); setCombinationEditing(combination); }}>Edit</button>{canDelete && <button className="danger-btn" type="button" disabled={saving} onClick={() => void removeCombination(combination)}>Remove</button>}</div></div></article>)}</div></section>}
    {!signedIn ? <div className="live-empty"><span className="empty-mark"/><b>Manager sign-in required</b><p>Sign in from the top bar to view and edit physical rooms and their shared photo galleries.</p></div> : selectedCategory ? <section className="room-category-detail">
      <div className="room-category-detail-heading"><div><span className="module-crumb">ROOM CATEGORY</span><h2>{value(selectedCategory, "name")}</h2><p>Each room can have its own details. This category shares one guest photo gallery.</p></div><div><button className="outline-btn" type="button" onClick={() => setSelectedCategorySlug("")}>All categories</button><button className="primary-btn" type="button" onClick={() => openAddRooms(value(selectedCategory, "name"))}>Add rooms</button></div></div>
      <div className="room-category-kpis">
        <article><span>Physical rooms</span><b>{selectedUnits.length}</b><small>In this category</small></article>
        <article><span>Occupied now</span><b>{occupiedCount}</b><small>Checked in today</small></article>
        <article><span>Available now</span><b>{availableCount}</b><small>Not currently checked in</small></article>
        <article><span>Guest capacity</span><b>{guestCapacity}</b><small>Combined maximum guests</small></article>
        <article><span>Rate</span><b>{startingRate ? ksh(startingRate) : "—"}</b><small>Starting price per night</small></article>
        <article><span>Shared photos</span><b>{Array.isArray(selectedCategory.images) ? selectedCategory.images.length : 0}</b><small>Shown for every room</small></article>
      </div>
      <div className="room-category-gallery-detail"><div><b>Shared {value(selectedCategory, "name")} gallery</b><small>Upload folder: <code>data\room-media\{value(selectedCategory, "slug")}\</code></small><small>JPEG, PNG, WebP, or AVIF · up to 8 MB each · {Math.max(0, 12 - (Array.isArray(selectedCategory.images) ? selectedCategory.images.length : 0))} of 12 shared photo slots remaining.</small><small>Project-relative path. Uploads from here are saved directly into this category folder.</small></div><label className="room-gallery-add">Add shared photos<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={saving || (Array.isArray(selectedCategory.images) && selectedCategory.images.length >= 12)} onChange={(event) => { void updateGallery(selectedCategory, event.target.files); event.target.value = ""; }}/></label></div>
      {Array.isArray(selectedCategory.images) && selectedCategory.images.length > 0 && <div className="room-category-gallery-previews">{(selectedCategory.images as string[]).map((photo, index) => { const isMain = selectedCategory.imageUrl === photo || (!selectedCategory.imageUrl && index === 0); return <span className={`room-gallery-thumb${isMain ? " is-main" : ""}`} key={`${photo}-${index}`}><Image src={photo} alt={`${value(selectedCategory, "name")} shared photo ${index + 1}`} fill sizes="90px" unoptimized/>{isMain && <small className="room-gallery-main-badge">Main image</small>}<button type="button" className="room-gallery-remove" disabled={saving} aria-label={`Remove shared photo ${index + 1}`} onClick={() => { const images = (selectedCategory.images as string[]).filter((_, photoIndex) => photoIndex !== index); const mainImage = images.includes(String(selectedCategory.imageUrl || "")) ? String(selectedCategory.imageUrl) : images[0] || ""; void saveGallery(selectedCategory, images, mainImage); }}>×</button>{!isMain && <button type="button" className="room-gallery-set-main" disabled={saving} onClick={() => void saveGallery(selectedCategory, selectedCategory.images as string[], photo)}>Set as main</button>}</span>; })}</div>}
      {categoryUnits.length ? <div className="room-card-grid">{categoryUnits.map((unit) => <article className="managed-room-card" key={String(unit.id)}><button type="button" className="managed-room-open" onClick={() => openUnit(unit)}><div className="managed-room-photo">{unit.imageUrl ? <Image src={String(unit.imageUrl)} alt={`${value(unit, "category")} shared room photo`} fill sizes="(max-width:700px) 100vw, 360px" unoptimized/> : <span aria-hidden="true"/>}<i className="room-status-live">{value(unit, "code")}</i></div><div className="managed-room-copy"><span className="managed-room-kicker">{value(unit, "category")}</span><h2>{value(unit, "name", value(unit, "code"))}</h2><p>{Number(unit.maxGuests || 0)} guests · {value(unit, "bedConfiguration", "Bed details not set")}</p><div className="managed-room-meta"><b>{ksh(unit.nightlyRateKsh)}<small> / night</small></b><span>{Number(unit.bedCount || 0)} {Number(unit.bedCount) === 1 ? "bed" : "beds"}</span></div><span className="managed-room-link">Edit this room <b>→</b></span></div></button></article>)}</div> : <div className="live-empty"><span className="empty-mark"/><b>No physical rooms yet</b><p>Add rooms to this category. Each unit will get its own editable room card.</p><button className="primary-btn" type="button" onClick={() => openAddRooms(value(selectedCategory, "name"))}>Add rooms</button></div>}
    </section> : <section className="room-category-browser"><div className="room-category-browser-heading"><div><span className="module-crumb">ROOM CATEGORIES</span><h2>Choose a category</h2><p>Open a category to review its rooms, availability, capacity, rates, and shared gallery.</p></div></div><div className="room-category-cards">{categoryRows.map((category) => { const categoryImages = Array.isArray(category.images) ? category.images as string[] : []; const categoryThumbnail = categoryImages.includes(String(category.imageUrl || "")) ? category.imageUrl : categoryImages[0] || category.imageUrl; const categoryCount = units.filter((unit) => unit.slug === category.slug).length; const categoryRate = categoryCount ? Math.min(...units.filter((unit) => unit.slug === category.slug).map((unit) => Number(unit.nightlyRateKsh || 0))) : 0; return <article className="room-category-card" key={String(category.slug)}><button className="room-category-card-main" type="button" onClick={() => setSelectedCategorySlug(String(category.slug))}><div className="room-category-card-image">{categoryThumbnail ? <Image src={String(categoryThumbnail)} alt={`${value(category, "name")} room gallery`} fill sizes="(max-width:760px) 100vw, 360px" unoptimized/> : <span className="room-category-card-placeholder">{value(category, "name").slice(0, 1).toUpperCase()}</span>}<span className="room-category-photo-badge">{categoryImages.length} {categoryImages.length === 1 ? "photo" : "photos"}</span></div><div className="room-category-card-copy"><span className="managed-room-kicker">HAPPYLAND HOTEL DIANI</span><h3>{value(category, "name")}</h3><p>{categoryCount} {categoryCount === 1 ? "physical room" : "physical rooms"} · {categoryImages.length} shared photos</p><div className="room-category-card-stats"><span><b>{categoryCount}</b><small>ROOMS</small></span><span><b>{categoryRate ? ksh(categoryRate) : "—"}</b><small>FROM / NIGHT</small></span><span><b>{categoryCount ? units.filter((unit) => unit.slug === category.slug).reduce((max, unit) => Math.max(max, Number(unit.maxGuests || 0)), 0) : "—"}</b><small>MAX GUESTS</small></span></div><span className="managed-room-link">View category details <b>→</b></span></div></button><div className="room-category-card-footer"><label className="room-gallery-add">Add shared photos<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={saving || categoryImages.length >= 12} onChange={(event) => { void updateGallery(category, event.target.files); event.target.value = ""; }}/></label><span>Upload folder: <code>data\room-media\{String(category.slug)}\</code></span></div></article>; })}</div></section>}        {adding && <div className="modal-backdrop room-form-backdrop"><section className="room-editor-modal" role="dialog" aria-modal="true" aria-labelledby="add-rooms-title"><header className="room-editor-heading"><div><span className="module-crumb">ROOM SETUP</span><h2 id="add-rooms-title">Add rooms</h2></div><button className="outline-btn" type="button" disabled={saving} onClick={() => setAdding(false)}>Close</button></header><form className="room-setup-form room-type-form" onSubmit={(event) => void saveCategory(event)}><p>Choose the room category and how many physical rooms to create. Details can be completed individually afterward.</p>{message && <p className="room-form-message" role="alert">{message}</p>}<div className="room-core-fields"><label>Room category<select name="name" required value={newRoomCategory} onChange={(event) => setNewRoomCategory(event.target.value)}><option value="" disabled>Select a category</option>{roomCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><label>Short name<input name="abbreviation" maxLength={40} placeholder="e.g. STD"/></label><label>Number of rooms<input name="inventory" type="number" min="1" max="1000" required placeholder="e.g. 5"/></label><label>Starting maximum guests<input name="maxGuests" type="number" min="1" max="20" required defaultValue="2"/></label><label>Starting number of beds<input name="bedCount" type="number" min="0" max="20" defaultValue="0"/></label><label>Starting bed layout<input name="bedConfiguration" maxLength={160}/></label></div><section className="room-pricing"><div className="room-section-heading"><span>Starting rates</span><small>Each room can be priced separately after setup</small></div><label className="default-rate-field">Default KSh per night<input name="defaultRate" type="number" min="1" required placeholder="e.g. 8500" onChange={(event) => setRates(Array(7).fill(Number(event.target.value)))}/></label><div className="weekday-rates">{days.map((day, index) => <label key={day}>{day}<input aria-label={`${day} rate`} type="number" min="1" value={rates[index] || ""} onChange={(event) => setRates((old) => old.map((rate, i) => i === index ? Number(event.target.value) : rate))}/></label>)}</div></section><button className="primary-btn" disabled={saving}>{saving ? "Creating rooms..." : "Create rooms"}</button></form></section></div>}

    {combinationEditing && <div className="modal-backdrop room-form-backdrop"><section className="room-editor-modal" role="dialog" aria-modal="true" aria-labelledby="combination-title"><header className="room-editor-heading"><div><span className="module-crumb">VIRTUAL ACCOMMODATION</span><h2 id="combination-title">Edit combination</h2></div><button className="outline-btn" type="button" disabled={saving} onClick={() => setCombinationEditing(null)}>Close</button></header><form className="room-setup-form room-type-form" onSubmit={(event) => void saveCombination(event)}><p>Select the physical rooms to reserve together. Their internal room codes are only shown in staff operations.</p>{message && <p className="room-form-message" role="alert">{message}</p>}<div className="room-core-fields"><label className="room-type-wide">Public accommodation name<input name="name" required maxLength={100} defaultValue={value(combinationEditing, "name", "3 Bedroom Apartment")}/></label><label className="room-type-wide">Physical rooms<select name="unitIds" multiple required size={Math.min(8, units.length)} defaultValue={Array.isArray(combinationEditing.unitIds) ? (combinationEditing.unitIds as number[]).map(String) : []}>{units.map((unit) => <option key={String(unit.id)} value={String(unit.id)}>{value(unit, "code")} · {value(unit, "category")} · {value(unit, "operationalStatus")}</option>)}</select></label><label>Maximum guests<input name="maxGuests" type="number" min="1" max="20" required defaultValue={Number(combinationEditing.maxGuests || 8)}/></label><label>Number of beds<input name="bedCount" type="number" min="0" max="20" defaultValue={Number(combinationEditing.bedCount || 0)}/></label><label className="room-type-wide">Bed layout<input name="bedConfiguration" maxLength={160} defaultValue={value(combinationEditing, "bedConfiguration")}/></label><label className="room-type-wide">Full description<textarea name="description" rows={3} maxLength={3000} defaultValue={value(combinationEditing, "description")}/></label><label className="room-type-wide">Amenities<input name="amenities" placeholder="Wi-Fi, balcony, air conditioning" defaultValue={Array.isArray(combinationEditing.amenities) ? combinationEditing.amenities.join(", ") : ""}/></label></div><section className="room-pricing"><div className="room-section-heading"><span>Combination rates</span><small>KSh per night</small></div><label className="default-rate-field">Default nightly rate<input name="nightlyRateKsh" type="number" min="1" required defaultValue={Number(combinationEditing.nightlyRateKsh || 35000)} onChange={(event) => setRates(Array(7).fill(Number(event.target.value)))}/></label><div className="weekday-rates">{days.map((day, index) => <label key={day}>{day}<input type="number" min="1" value={rates[index] || ""} onChange={(event) => setRates((old) => old.map((rate, i) => i === index ? Number(event.target.value) : rate))}/></label>)}</div></section><button className="primary-btn" disabled={saving}>{saving ? "Saving combination..." : "Save combination"}</button></form></section></div>}
    {editing && <div className="modal-backdrop room-form-backdrop"><section className="room-editor-modal room-unit-editor" role="dialog" aria-modal="true" aria-labelledby="edit-room-title"><header className="room-editor-heading"><div><span className="module-crumb">{value(editing, "category")} · INDIVIDUAL ROOM</span><h2 id="edit-room-title">Edit {value(editing, "code")}</h2></div><button className="outline-btn" type="button" disabled={saving} onClick={() => setEditing(null)}>Close</button></header><form className="room-setup-form room-type-form" onSubmit={(event) => void saveUnit(event)}><p>Capacity, beds, rates, and guest information below belong only to this physical room. Its photos are shared by all {value(editing, "category")} rooms.</p>{message && <p className="room-form-message" role="alert">{message}</p>}<div className="room-core-fields"><label>Room number / label<input name="code" required maxLength={100} defaultValue={value(editing, "code")}/></label><label>Maximum guests<input name="maxGuests" type="number" min="1" max="20" required defaultValue={Number(editing.maxGuests || 1)}/></label><label>Operational status<select name="operationalStatus" defaultValue={value(editing, "operationalStatus", "available")}><option value="available">Available</option><option value="dirty">Dirty</option><option value="maintenance">Maintenance</option><option value="out-of-service">Out of service</option><option value="blocked">Blocked</option></select></label><label>Number of beds<input name="bedCount" type="number" min="0" max="20" defaultValue={Number(editing.bedCount || 0)}/></label><label className="room-type-wide">Bed layout<input name="bedConfiguration" maxLength={160} defaultValue={value(editing, "bedConfiguration")}/></label></div><section className="room-pricing"><div className="room-section-heading"><span>Rates for this room</span><small>KSh per night</small></div><label className="default-rate-field">Default nightly rate<input name="nightlyRateKsh" type="number" min="1" required defaultValue={Number(editing.nightlyRateKsh || 0)} onChange={(event) => setRates(Array(7).fill(Number(event.target.value)))}/></label><div className="weekday-rates">{days.map((day, index) => <label key={day}>{day}<input type="number" min="1" value={rates[index] || ""} onChange={(event) => setRates((old) => old.map((rate, i) => i === index ? Number(event.target.value) : rate))}/></label>)}</div></section><div className="room-core-fields"><label className="room-type-wide">Short description<input name="shortDescription" maxLength={240} defaultValue={value(editing, "shortDescription")}/></label><label className="room-type-wide">Full description<textarea name="description" rows={3} maxLength={3000} defaultValue={value(editing, "description")}/></label><label className="room-type-wide">Amenities<input name="amenities" placeholder="Wi-Fi, balcony, air conditioning" defaultValue={Array.isArray(editing.amenities) ? editing.amenities.join(", ") : ""}/></label></div><div className="room-unit-shared-photos"><b>Shared {value(editing, "category")} photos</b><span>Photos are managed once for all rooms in this category.</span>{editing.imageUrl ? <div className="room-unit-photo-preview"><Image src={String(editing.imageUrl)} alt={`${value(editing, "category")} shared photo`} fill sizes="120px" unoptimized/></div> : <small>No shared photo added yet.</small>}</div><div className="room-editor-actions"><button className="danger-btn" type="button" disabled={saving} onClick={() => void deleteUnit()}>{saving ? "Please wait..." : "Delete room"}</button><button className="primary-btn" disabled={saving}>{saving ? "Saving room..." : "Save room details"}</button></div></form></section></div>}
  </div>;
}
