import type { Metadata } from "next";
import { InteriorPage, SectionHeading } from "@/components/interior-page";
import { getPublicHotelSnapshot } from "@/lib/booking-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Experiences in Diani", description: "Experiences published by HappyLand Hotel Diani." };
export default function ExperiencesPage() {
  const content = getPublicHotelSnapshot().content as Record<string, unknown> | null;
  const experiences = Array.isArray(content?.experiences) ? content.experiences.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
  return <><InteriorPage eyebrow="Experience Diani" title="Hotel experiences" intro="Activities and experiences shown here are managed by the hotel." image="/images/herohome.png" imageAlt="HappyLand Hotel Diani"/><section className="interior-content"><div className="wrap"><SectionHeading eyebrow="EXPERIENCES" title="Available experiences" text="Ask the hotel about details for your travel dates."/>{experiences.length ? <div className="public-room-list">{experiences.map((item, index) => <article className="public-room-card" key={String(item.slug || item.title || index)}><div><h3>{String(item.title || item.name || "Experience")}</h3><p>{String(item.description || "")}</p></div></article>)}</div> : <p className="content-empty">No experiences have been published.</p>}</div></section></>;
}
