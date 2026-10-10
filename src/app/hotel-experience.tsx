"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

const image = (id: string, width = 1000) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
type PublicRoom = { slug: string; name: string; inventory: number; maxGuests: number; guests?: number; nightlyRateKsh: number; description?: string; images?: string[] };
type IconName = "palm" | "calendar" | "person" | "bed" | "search" | "arrow" | "shield" | "headset" | "star" | "check" | "map" | "phone" | "mail" | "menu" | "close" | "leaf" | "sun" | "heart" | "fork";
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<IconName, React.ReactNode> = {
    palm: <><path d="M12 22v-9"/><path d="M12 13C8 9 3 10 2 6c4 0 8 1 10 5"/><path d="M12 13c1-5 4-9 9-9-1 4-4 7-9 9"/><path d="M12 13c-1-5-1-9 2-12 3 4 2 8-2 12"/><path d="M12 13C8 12 5 14 4 18c4 0 7-1 8-5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    person: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-1a7 7 0 0 1 14 0v1z"/></>,
    bed: <><path d="M3 20V5M3 16h18v4M3 11h18v5M7 11V8h5a3 3 0 0 1 3 3"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    arrow: <><path d="M4 12h15M13 6l6 6-6 6"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11"/><path d="m9 12 2 2 4-4"/></>,
    headset: <><path d="M3 13v-2a9 9 0 0 1 18 0v2"/><path d="M5 13h2v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2ZM19 13h-2v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2Z"/></>,
    star: <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></>,
    phone: <><path d="M7 3H5a2 2 0 0 0-2 2c0 8.8 7.2 16 16 16a2 2 0 0 0 2-2v-2l-5-2-2 3a14 14 0 0 1-6-6l3-2-2-5Z"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    leaf: <><path d="M20 4c-8 0-14 2-14 9a6 6 0 0 0 6 6c7 0 8-7 8-15Z"/><path d="M4 21c3-5 6-8 12-12"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2"/></>,
    heart: <path d="M20.8 8.8c0 4.5-8.8 10-8.8 10S3.2 13.3 3.2 8.8A4.3 4.3 0 0 1 12 6.5a4.3 4.3 0 0 1 8.8 2.3Z"/>,
    fork: <><path d="M7 3v7M4 3v4a3 3 0 0 0 6 0V3M7 10v11M16 3v18M16 3c4 3 4 8 0 10"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}
function Brand({ navbar = false }: { navbar?: boolean }) {
  return <a className="brand" href="#home" aria-label="HappyLand Hotel Diani home"><Image className={navbar ? "brand-logo brand-logo-nav" : "brand-logo"} src={navbar ? "/images/logonav.png" : "/images/logo.png"} alt="HappyLand Hotel Diani" width={navbar ? 1920 : 1280} height={navbar ? 512 : 1024} sizes={navbar ? "220px" : "120px"}/></a>;
}

export default function HotelExperience() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [roomData, setRoomData] = useState<PublicRoom[]>([]);
  const [publishedContent, setPublishedContent] = useState<Record<string, unknown>>({});
  const [property, setProperty] = useState<Record<string, unknown>>({});
  const [datesChecked, setDatesChecked] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [homeGuests, setHomeGuests] = useState("2");
  const [homeRoom, setHomeRoom] = useState("any");
  const [availabilityRooms, setAvailabilityRooms] = useState<{slug:string;name:string;availableUnits:number;nightlyRateKsh:number}[]>([]);
  const [message, setMessage] = useState("");
  const [enquiryStatus, setEnquiryStatus] = useState("");
  const [enquiryBusy, setEnquiryBusy] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/public/hotel", { cache: "no-store" }).then((response) => response.json()).then((data) => {
      if (Array.isArray(data.rooms)) setRoomData(data.rooms);
      if (data.property && typeof data.property === "object") setProperty(data.property as Record<string, unknown>);
      if (data.content && typeof data.content === "object") setPublishedContent(data.content as Record<string, unknown>);
    }).catch(() => undefined);
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setSelectedRoom(null); setGalleryIndex(null); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  async function checkDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDatesChecked(true);
    setAvailabilityRooms([]);
    if (!checkIn || !checkOut || checkOut <= checkIn) { setMessage("Choose a check-out date after your check-in date."); return; }
    setMessage("Checking live room availability…");
    try {
      const query = new URLSearchParams({ checkIn, checkOut, guests: homeGuests });
      const response = await fetch(`/api/availability?${query.toString()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Availability could not be checked.");
      const matching = homeRoom === "any" ? result.rooms : result.rooms.filter((room: {slug:string}) => room.slug === homeRoom);
      setAvailabilityRooms(matching);
      setMessage(!result.configured ? result.message : matching.length ? "Rooms available for the dates you selected." : "No rooms match those dates and preferences.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Availability could not be checked. Please try again.");
    }
  }
  async function sendEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnquiryBusy(true);
    setEnquiryStatus("");
    const formElement = event.currentTarget;
    try {
      const response = await fetch("/api/enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(formElement).entries())) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your enquiry could not be saved.");
      setEnquiryStatus(result.emailSent ? "Your enquiry has been saved and sent to the hotel." : "Your enquiry has been saved. Email notification is not configured yet.");
      formElement.reset();
    } catch (error) {
      setEnquiryStatus(error instanceof Error ? error.message : "Your enquiry could not be saved. Please try again.");
    } finally { setEnquiryBusy(false); }
  }
  const hideMenu = () => setMenuOpen(false);
  const contentRows = (key: string) => Array.isArray(publishedContent[key]) ? (publishedContent[key] as Record<string, unknown>[]).filter((row) => row && typeof row === "object") : [];
  const experiences = contentRows("experiences");
  const gallery = contentRows("gallery");
  const contentImage = (value: unknown, width = 900) => typeof value === "string" && (value.startsWith("/") || value.startsWith("https://")) ? value : typeof value === "string" && value ? image(value, width) : "";
  const price = (amount: number) => `KES ${new Intl.NumberFormat("en-KE").format(amount)}`;

  return <>
    <header className="site-header"><div className="wrap header-inner"><Brand navbar/><nav className="desktop-nav" aria-label="Main navigation"><Link className="active" href="/">Home</Link><Link href="/rooms">Rooms</Link><Link href="/experiences">Experiences</Link><Link href="/dining">Dining</Link><Link href="/gallery">Gallery</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link></nav><div className="header-actions"><Link className="pill-button header-book" href="/book">Book Now <Icon name="calendar" size={14}/></Link><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}><Icon name={menuOpen ? "close" : "menu"} size={23}/></button></div></div>{menuOpen && <nav className="mobile-nav" aria-label="Mobile navigation">{[["Rooms","/rooms"],["Experiences","/experiences"],["Dining","/dining"],["Gallery","/gallery"],["About","/about"],["Contact","/contact"]].map(([label, href]) => <Link href={href} key={href} onClick={hideMenu}>{label}</Link>)}<Link className="mobile-nav-book" href="/book" onClick={hideMenu}>Book your stay</Link></nav>}</header>
    <main>
      <section className="hero" id="home"><Image className="hero-image" src="/images/herohome.png" alt="HappyLand Hotel Diani" fill priority sizes="100vw"/><div className="wrap hero-inner"><div className="hero-copy"><div className="eyebrow">Welcome to {String(property.name || "HappyLand Hotel Diani")}</div><h1>Your Perfect Getaway <em>on the Kenyan Coast</em></h1><p>Experience comfort, warm hospitality and the easy rhythm of Diani. Find room to relax, explore the coast and make time for what matters.</p><div className="hero-actions"><a className="gold-button" href="#booking">Book Your Stay <Icon name="arrow" size={15}/></a><a className="outline-button" href="#rooms">Explore Rooms</a></div><div className="hero-location"><Icon name="map" size={14}/> {String(property.destination || "Diani, Kenya").toUpperCase()}</div></div></div><div className="hero-highlights"><div><Icon name="sun" size={22}/>Diani coastal<br/>setting</div><div><Icon name="bed" size={22}/>Comfortable<br/>accommodation</div><div><Icon name="fork" size={22}/>Warm local<br/>hospitality</div><div><Icon name="leaf" size={22}/>Room to slow<br/>down</div></div></section>
      <section className="booking-overlap wrap" id="booking" aria-label="Check your stay dates"><form className="booking-bar" onSubmit={checkDates}><div className="booking-field"><Icon name="calendar" size={21}/><div><label htmlFor="checkin">CHECK IN</label><input id="checkin" type="date" required value={checkIn} onChange={e=>setCheckIn(e.target.value)}/></div></div><div className="booking-field"><Icon name="calendar" size={21}/><div><label htmlFor="checkout">CHECK OUT</label><input id="checkout" type="date" min={checkIn||undefined} required value={checkOut} onChange={e=>setCheckOut(e.target.value)}/></div></div><div className="booking-field"><Icon name="person" size={21}/><div><label htmlFor="guests">GUESTS</label><select id="guests" value={homeGuests} onChange={e=>setHomeGuests(e.target.value)}><option value="1">1 Guest</option><option value="2">2 Guests</option><option value="3">3 Guests</option><option value="4">4 Guests</option><option value="5">5+ Guests</option></select></div></div><div className="booking-field"><Icon name="bed" size={21}/><div><label htmlFor="roomtype">ROOM TYPE</label><select id="roomtype" value={homeRoom} onChange={e=>setHomeRoom(e.target.value)}><option value="any">Any room type</option>{roomData.map(room=><option value={room.slug} key={room.slug}>{room.name}</option>)}</select></div></div><button className="booking-submit" type="submit"><Icon name="search" size={15}/> Check Availability</button></form>{datesChecked && <div className="availability-panel" role="status"><button type="button" onClick={()=>setDatesChecked(false)} aria-label="Close message"><Icon name="close" size={16}/></button><b>{message}</b><p>Selected dates: {checkIn} to {checkOut}.</p>{availabilityRooms.length>0 && <div className="availability-results"><b>Available now</b><ul>{availabilityRooms.map(room=><li key={room.slug}>{room.name} · {room.availableUnits} available · KES {new Intl.NumberFormat("en-KE").format(room.nightlyRateKsh)} per night</li>)}</ul><Link className="text-link" href="/book">Continue to booking <Icon name="arrow" size={13}/></Link></div>}</div>}</section>
      <section className="trust-strip"><div className="wrap trust-inner"><div className="trust-item"><Icon name="shield" size={29}/><span><b>Direct enquiries</b><small>Speak with the hotel team</small></span></div><div className="trust-item"><Icon name="headset" size={29}/><span><b>Warm hospitality</b><small>A thoughtful coastal welcome</small></span></div><div className="trust-item"><Icon name="map" size={27}/><span><b>Diani, Kenya</b><small>Discover the coast</small></span></div><div className="trust-item"><Icon name="star" size={27}/><span><b>Stay your way</b><small>Relax, explore, reconnect</small></span></div></div></section>
      <section className="rooms-about section" id="rooms"><div className="wrap rooms-about-grid"><div className="rooms-column"><div className="section-heading"><div><span className="section-kicker">YOUR PLACE IN DIANI</span><h2>Our Rooms <i/></h2><p>Spaces designed for relaxation, comfort and memorable coastal stays.</p></div><a className="text-link" href="#rooms">View all rooms <Icon name="arrow" size={15}/></a></div><div className="room-grid">{roomData.length ? roomData.map((room)=><article className="room-card" key={room.slug}><div className="room-image room-image-empty" aria-hidden="true"/><div className="room-body"><h3>{room.name}</h3><p>{room.description || "Contact the hotel for confirmed room details."}</p><div className="room-meta"><span><Icon name="person" size={12}/>Up to {room.maxGuests} guests</span><span>{room.inventory} rooms</span></div><div className="room-foot"><b>{room.nightlyRateKsh ? price(room.nightlyRateKsh) : "Rate on request"} / night</b><button onClick={()=>setSelectedRoom(room.slug)}>View details <Icon name="arrow" size={12}/></button></div></div></article>) : <p className="content-empty">Room types and rates will appear here once the hotel configures its inventory.</p>}</div></div><article className="about-feature" id="about"><div className="about-image"><Image src="/images/side.png" alt="A shaded swing beside the turquoise Diani shoreline" fill sizes="(max-width:760px) 42vw, 25vw"/></div><div className="about-copy"><span className="section-kicker">A LITTLE COASTAL MAGIC</span><h2>About HappyLand</h2><p>A welcoming place to settle into the coast, enjoy comfortable accommodation and make memorable moments at your own pace.</p><ul><li><Icon name="check" size={14}/>Diani coastal setting</li><li><Icon name="check" size={14}/>Comfortable accommodation</li><li><Icon name="check" size={14}/>Warm Kenyan hospitality</li><li><Icon name="check" size={14}/>Time to relax and reconnect</li></ul><a className="pill-button small-button" href="#contact">Discover HappyLand <Icon name="arrow" size={13}/></a></div></article></div></section>
      <section className="experience-section" id="experiences"><div className="wrap"><div className="section-heading"><div><span className="section-kicker">THE COAST IS CALLING</span><h2>Experience Diani</h2><p>Activities and experiences published by the hotel.</p></div><a className="text-link" href="#contact">Plan your stay <Icon name="arrow" size={15}/></a></div>{experiences.length ? <div className="experience-grid">{experiences.map((entry,index)=><article className="experience-card" key={String(entry.slug || entry.title || index)}>{contentImage(entry.image) && <Image src={contentImage(entry.image)} alt={String(entry.title || entry.name || "Hotel experience")} fill sizes="(max-width:760px) 48vw, 20vw" unoptimized/>}<div><h3>{String(entry.title || entry.name || "")}</h3><p>{String(entry.description || "")}</p></div></article>)}</div> : <p className="content-empty">No experiences have been published yet.</p>}</div></section>
      <section className="dining-section" id="dining"><div className="wrap dining-grid"><div><span className="section-kicker">A TASTE OF THE COAST</span><h2>Taste the Coast</h2><p>Good food belongs to a good getaway. Ask the HappyLand team about current dining options, meal times and locally inspired flavours during your stay.</p><div className="dining-tags"><span>Breakfast</span><span>Lunch</span><span>Dinner</span><span>Drinks</span></div><a className="pill-button" href="#contact">Explore Dining <Icon name="arrow" size={14}/></a></div><div className="dining-photo"><Image src={image("photo-1414235077428-338989a2e8c0",1100)} alt="A carefully prepared restaurant meal" fill sizes="(max-width:760px) 100vw, 55vw"/><span>Dining details and current offerings available directly from the hotel.</span></div></div></section>
      <section className="values-section"><div className="wrap"><div className="section-heading"><div><span className="section-kicker">THE HAPPYLAND FEELING</span><h2>Room for a Better Stay</h2><p>A few good reasons to make Diani your next stop.</p></div></div><div className="values-grid"><article><Icon name="map" size={22}/><h3>Prime Diani setting</h3><p>A memorable base for exploring Kenya&apos;s coast.</p></article><article><Icon name="heart" size={22}/><h3>Warm Kenyan welcome</h3><p>Hospitality with a thoughtful, personal touch.</p></article><article><Icon name="bed" size={22}/><h3>Comfortable stays</h3><p>Room to rest, recharge and feel at home.</p></article><article><Icon name="sun" size={22}/><h3>Easy coastal days</h3><p>Slow down, head out and enjoy the moment.</p></article></div></div></section>
      <section className="gallery-section" id="gallery"><div className="wrap"><div className="section-heading"><div><span className="section-kicker">PROPERTY PHOTOGRAPHY</span><h2>HappyLand Moments</h2><p>Photos published by the hotel.</p></div></div>{gallery.length ? <div className="gallery-grid">{gallery.map((entry,index)=><button type="button" key={String(entry.slug || entry.title || index)} onClick={()=>setGalleryIndex(index)} aria-label={`View ${String(entry.title || entry.name || "photo")}`}>{contentImage(entry.image) && <Image src={contentImage(entry.image)} alt={String(entry.title || entry.name || "Hotel photo")} fill sizes="(max-width:760px) 50vw, 27vw" unoptimized/>}<span>{String(entry.title || entry.name || "Photo")}</span></button>)}</div> : <p className="content-empty">No property photos have been published.</p>}</div></section>
      <section className="guest-note"><div className="wrap"><div className="quote-mark">“</div><div><h2>What Our Guests Say</h2><p>Guest reviews will appear here once approved by the hotel. We don&apos;t publish sample or placeholder testimonials.</p></div></div></section>
      <section className="location-section" id="location"><div className="wrap location-grid"><div><span className="section-kicker">FIND YOUR WAY TO THE COAST</span><h2>Find Us in Diani</h2><p>HappyLand Hotel Diani is in Diani, Kenya. Contact the hotel for the exact address, transfer options and arrival directions.</p><p className="location-fact"><Icon name="map" size={17}/> Diani, Kwale County, Kenya</p><p className="location-fact"><Icon name="phone" size={17}/> Phone and email details to be confirmed</p><a className="pill-button" href="https://maps.google.com/?q=Diani+Beach+Kenya" target="_blank" rel="noreferrer">Open Diani map <Icon name="arrow" size={14}/></a></div><div className="map-frame"><iframe title="Map of Diani Beach, Kenya" src="https://maps.google.com/maps?q=Diani%20Beach%2C%20Kenya&t=&z=12&ie=UTF8&iwloc=&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></div></div></section>
      <section className="contact-section" id="contact"><div className="wrap contact-grid"><div><span className="section-kicker">WE&apos;RE HERE TO HELP</span><h2>Get in Touch</h2><p>Questions about rooms, dates or planning your trip? Send an enquiry and the HappyLand team can help with the details.</p><div className="contact-note">Phone, email and WhatsApp details will be added once confirmed.</div></div><form className="contact-form" onSubmit={sendEnquiry}><label>Name<input name="name" required minLength={2} maxLength={120} placeholder="Your name"/></label><label>Email<input name="email" type="email" required maxLength={254} placeholder="you@example.com"/></label><label>Phone<input name="phone" type="tel" maxLength={40} placeholder="Optional"/></label><label>Preferred dates<input name="dates" maxLength={100} placeholder="When would you like to stay?"/></label><label className="full">Message<textarea name="message" required minLength={5} maxLength={5000} placeholder="Tell us a little about your stay"/></label><button className="gold-button" type="submit" disabled={enquiryBusy}>{enquiryBusy ? "Sending…" : "Send Enquiry"} <Icon name="arrow" size={14}/></button>{enquiryStatus && <p className="form-message" role="status">{enquiryStatus}</p>}</form></div></section>
    </main>
    <footer className="site-footer"><div className="wrap footer-grid"><div><Brand/><p>Where Every Stay Feels Like Paradise</p></div><div><b>Explore</b><Link href="/rooms">Rooms</Link><Link href="/experiences">Experiences</Link><Link href="/dining">Dining</Link><Link href="/gallery">Gallery</Link></div><div><b>HappyLand</b><Link href="/about">About</Link><Link href="/offers">Offers</Link><Link href="/contact">Contact</Link><Link href="/book">Book Now</Link></div><div><b>Contact</b><span>{String(property.destination || "Diani, Kenya")}</span>{typeof property.phone === "string" && property.phone && <span>{property.phone}</span>}{typeof property.email === "string" && property.email && <span>{property.email}</span>}<Link href="/contact">Get in touch</Link></div></div><div className="wrap footer-bottom"><span>© {new Date().getFullYear()} HappyLand Hotel Diani. All rights reserved.</span><span>Privacy · Terms · Booking information</span></div></footer>
    <div className="mobile-book"><a className="pill-button" href="/book"><Icon name="calendar" size={15}/> Book Your Stay</a></div>
    {selectedRoom && roomData.find((room)=>room.slug===selectedRoom) && (() => { const room=roomData.find((item)=>item.slug===selectedRoom)!; return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${room.name} details`} onClick={()=>setSelectedRoom(null)}><div className="room-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSelectedRoom(null)} aria-label="Close"><Icon name="close" size={20}/></button><span className="section-kicker">ROOM TYPE</span><h2>{room.name}</h2><p>{room.description || "Confirmed facilities and room details will be added by the hotel."}</p><p>Up to {room.maxGuests} guests · {room.inventory} rooms · {room.nightlyRateKsh ? `${price(room.nightlyRateKsh)} per night` : "Rate on request"}</p><a className="gold-button" href="#contact" onClick={()=>setSelectedRoom(null)}>Enquire about this room <Icon name="arrow" size={14}/></a></div></div>; })()}
    {galleryIndex !== null && gallery[galleryIndex] && <div className="modal-backdrop gallery-backdrop" role="dialog" aria-modal="true" aria-label={`${String(gallery[galleryIndex].title || gallery[galleryIndex].name || "Photo")}`} onClick={()=>setGalleryIndex(null)}><div className="gallery-view" onClick={e=>e.stopPropagation()}>{contentImage(gallery[galleryIndex].image,1800) && <Image src={contentImage(gallery[galleryIndex].image,1800)} alt={String(gallery[galleryIndex].title || gallery[galleryIndex].name || "Hotel photo")} fill sizes="100vw" unoptimized/>}<button className="modal-close" onClick={()=>setGalleryIndex(null)} aria-label="Close gallery"><Icon name="close" size={20}/></button><button className="gallery-arrow prev" onClick={()=>setGalleryIndex((galleryIndex+gallery.length-1)%gallery.length)} aria-label="Previous image">‹</button><button className="gallery-arrow next" onClick={()=>setGalleryIndex((galleryIndex+1)%gallery.length)} aria-label="Next image">›</button></div></div>}
  </>;
}
