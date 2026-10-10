import type { Metadata } from "next";
import { InteriorPage, SectionHeading } from "@/components/interior-page";
import { getPublicHotelSnapshot } from "@/lib/booking-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Special Offers", description: "Current offers published by HappyLand Hotel Diani." };
export default function OffersPage() {
  const content = getPublicHotelSnapshot().content as Record<string, unknown> | null;
  const offers = Array.isArray(content?.offers) ? content.offers.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
  return <><InteriorPage eyebrow="Offers & escapes" title="Current hotel offers" intro="Offers shown here are managed by the hotel." image="/images/herohome.png" imageAlt="HappyLand Hotel Diani"/><section className="interior-content"><div className="wrap"><SectionHeading eyebrow="CURRENT OFFERS" title="Available offers" text="Dates, prices and terms are provided with each published offer."/>{offers.length ? <div className="public-room-list">{offers.map((offer, index) => <article className="public-room-card" key={String(offer.slug || offer.title || index)}><div><h3>{String(offer.title || offer.name || "Offer")}</h3><p>{String(offer.description || "")}</p></div></article>)}</div> : <p className="content-empty">No current offers have been published.</p>}</div></section></>;
}
