import type { Metadata } from "next";
import Link from "next/link";
import { InteriorPage, SectionHeading } from "@/components/interior-page";
import { getPublicHotelSnapshot } from "@/lib/booking-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rooms & Suites", description: "Explore configured room types, rates and availability at HappyLand Hotel Diani." };
const money = (value: number) => `KSh ${new Intl.NumberFormat("en-KE").format(value)}`;

export default function RoomsPage() {
  const rooms = getPublicHotelSnapshot().rooms;
  return <><InteriorPage eyebrow="Stay in comfort" title="A room for your Diani escape" intro="Room inventory and rates shown here are managed by the hotel." image="/images/herohome.png" imageAlt="HappyLand Hotel Diani"/><section className="interior-content"><div className="wrap"><SectionHeading eyebrow="ROOMS & SUITES" title="Configured room types" text="Rates and guest limits come from the hotel's current room setup."/>{rooms.length ? <div className="public-room-list">{rooms.map((room) => <article className="public-room-card" key={room.slug}><div><h3>{room.name}</h3><p>{room.maxGuests} guests maximum · {room.inventory} rooms</p></div><strong>{money(room.nightlyRateKsh)} / night</strong><Link className="text-link" href={`/rooms/${room.slug}`}>View details →</Link></article>)}</div> : <p className="content-empty">No room types have been configured yet. Please contact the hotel for availability.</p>}</div></section></>;
}
