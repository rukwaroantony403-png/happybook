import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HotelOperations } from "../hotel-operations";
import type { Section } from "../../operations-live";

const sections = {
  reservations: "Reservations",
  notifications: "Notifications",
  checkouts: "Check-outs Today",
  rooms: "Rooms",
  guests: "Guests",
  "front-desk": "Check-in / Check-out",
  payments: "Payments",
  housekeeping: "Housekeeping",
  maintenance: "Maintenance",
  "guest-services": "Guest Services",
  inventory: "Inventory",
  reports: "Reports",
  expenses: "Expenses",
  suppliers: "Suppliers",
  settings: "Settings",
} as const satisfies Record<string, Section>;

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }): Promise<Metadata> {
  const { module } = await params;
  const title = sections[module as keyof typeof sections];
  return title ? { title: `${title} | HappyLand Hotel Diani` } : {};
}

export default async function OperationsModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const section = sections[module as keyof typeof sections];
  if (!section) notFound();
  return <HotelOperations initialSection={section} />;
}
