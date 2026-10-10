import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicHotelSnapshot } from "@/lib/booking-store";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ room: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { room: slug } = await params; const room = getPublicHotelSnapshot().rooms.find((item) => item.slug === slug);
  return room ? { title: room.name, description: `${room.name} at HappyLand Hotel Diani. Current inventory and nightly rate.` } : {};
}
export default async function RoomDetailsPage({ params }: Props) {
  const { room: slug } = await params; const room = getPublicHotelSnapshot().rooms.find((item) => item.slug === slug); if (!room) notFound();
  return <section className="interior-content"><div className="wrap"><div className="room-detail-head"><div><div className="interior-breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/rooms">Rooms</Link><span>/</span>{room.name}</div><span className="section-kicker">ROOM DETAILS</span><h1 className="interior-heading-title">{room.name}</h1><p className="room-detail-lead">{room.description || "Contact the hotel to confirm amenities and room policies."}</p></div><Link className="gold-button" href="/book">Check availability <span aria-hidden="true">→</span></Link></div><div className="feature-list"><div><b>Maximum guests</b><span>{room.maxGuests}</span></div><div><b>Inventory</b><span>{room.inventory}</span></div><div><b>Nightly rate</b><span>KSh {new Intl.NumberFormat("en-KE").format(room.nightlyRateKsh)}</span></div></div><div className="content-note">Additional facilities and room policies will be published after the hotel confirms them.</div></div></section>;
}
