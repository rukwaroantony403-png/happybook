import type { Metadata } from "next";
import { InteriorPage, SectionHeading } from "@/components/interior-page";
import { BookingRequestForm } from "@/components/hotel-forms";
import { hotelPhoto } from "@/lib/hotel-content";

export const metadata: Metadata = { title: "Book Your Stay", description: "Check configured room availability and confirm a stay at HappyLand Hotel Diani." };
export default function BookPage() {
  return <><InteriorPage eyebrow="Book your stay" title="Your Diani escape starts here" intro="Choose your dates, check configured room inventory and confirm your reservation online." image={hotelPhoto("photo-1571896349842-33c89424de2d", 1800)} imageAlt="A tropical resort beside the coast"/><section className="interior-content"><div className="wrap"><SectionHeading eyebrow="DIRECT BOOKING" title="Check dates and book" text="Reservations are confirmed instantly when configured room stock is available. No payment is collected by this website yet."/><div className="booking-page-grid"><BookingRequestForm/><aside className="booking-summary"><span className="section-kicker">BOOKING DETAILS</span><h3>Secure your dates</h3><p>Your room is reserved only after you receive a booking reference on screen. Availability is checked again when you confirm, to guard against overlapping bookings.</p><p>Nightly rates and inventory are maintained by hotel staff in the protected admin dashboard. Payment arrangements are handled separately with the hotel.</p><a className="text-link" href="/contact">Contact the hotel with a question →</a></aside></div></div></section></>;
}
