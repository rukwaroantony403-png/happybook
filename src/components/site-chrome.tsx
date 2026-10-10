"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  ["Home", "/"],
  ["Rooms", "/rooms"],
  ["Experiences", "/experiences"],
  ["Dining", "/dining"],
  ["Gallery", "/gallery"],
  ["About", "/about"],
  ["Contact", "/contact"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link className="brand" href="/" aria-label="HappyLand Hotel Diani home">
          <Image className="brand-logo brand-logo-nav" src="/images/logonav.png" alt="HappyLand Hotel Diani" width={1920} height={512} sizes="220px" priority />
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navItems.map(([label, href]) => <Link className={pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) ? "active" : undefined} href={href} key={href}>{label}</Link>)}
        </nav>
        <div className="header-actions">
          <Link className="pill-button header-book" href="/book">Book Now</Link>
          <button className="menu-button" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}>
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">{menuOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
      </div>
      {menuOpen && <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.slice(1).map(([label, href]) => <Link href={href} key={href} onClick={() => setMenuOpen(false)}>{label}</Link>)}
        <Link className="mobile-nav-book" href="/book" onClick={() => setMenuOpen(false)}>Book your stay</Link>
      </nav>}
    </header>
  );
}

export function SiteFooter() {
  const [property, setProperty] = useState<Record<string, string>>({});
  useEffect(() => { fetch("/api/public/hotel", { cache: "no-store" }).then((response) => response.json()).then((data) => setProperty(data.property || {})).catch(() => undefined); }, []);
  return <footer className="site-footer">
    <div className="wrap footer-grid">
      <div><Link className="brand" href="/" aria-label="HappyLand Hotel Diani home"><Image className="brand-logo" src="/images/logo.png" alt="HappyLand Hotel Diani" width={1280} height={1024} sizes="120px" /></Link><p>Where Every Stay Feels Like Paradise</p></div>
      <div><b>Explore</b><Link href="/rooms">Rooms</Link><Link href="/experiences">Experiences</Link><Link href="/dining">Dining</Link><Link href="/gallery">Gallery</Link></div>
      <div><b>HappyLand</b><Link href="/about">About</Link><Link href="/offers">Offers</Link><Link href="/contact">Contact</Link><Link href="/book">Book Now</Link></div>
      <div><b>Contact</b><span>{property.destination || "Diani, Kenya"}</span>{property.phone && <span>{property.phone}</span>}{property.email && <span>{property.email}</span>}<Link href="/contact">Get in touch</Link></div>
    </div>
    <div className="wrap footer-bottom"><span>© {new Date().getFullYear()} HappyLand Hotel Diani. All rights reserved.</span><span>Privacy · Terms · Booking information</span></div>
  </footer>;
}
