import type { Metadata } from "next";
import { InteriorPage, SectionHeading } from "@/components/interior-page";
import { EnquiryForm } from "@/components/hotel-forms";
import { getPublicHotelSnapshot } from "@/lib/booking-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact", description: "Contact HappyLand Hotel Diani with questions about your stay, room options and visiting Diani, Kenya." };
export default function ContactPage() {
  const property = getPublicHotelSnapshot().property;
  return <><InteriorPage eyebrow="Get in touch" title="We would love to hear from you" intro="Questions about a stay, room details or planning your trip? Send an enquiry and the HappyLand team can help with the information you need." image="/images/herohome.png" imageAlt={property.name}/><section className="interior-content"><div className="wrap"><SectionHeading eyebrow="CONTACT HAPPYLAND" title="How can we help?" text="Share a little about your trip and what you would like to know."/><div className="page-contact-grid"><aside className="page-contact-details"><h3>Find us</h3><p>{property.name}<br/>{property.destination || ""}</p>{property.phone && <p><a href={`tel:${property.phone}`}>{property.phone}</a></p>}{property.email && <p><a href={`mailto:${property.email}`}>{property.email}</a></p>}{!property.phone && !property.email && <p>Contact details have not been published yet.</p>}<a href="https://maps.google.com/?q=Diani+Beach+Kenya" target="_blank" rel="noreferrer">Open Diani on Google Maps →</a></aside><EnquiryForm/></div></div></section></>;
}
