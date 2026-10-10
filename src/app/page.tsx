import type { Metadata } from "next";
import { HotelOperations } from "./operations/hotel-operations";

export const metadata: Metadata = {
  title: "Hotel Operations | HappyLand Hotel Diani",
  description: "Hotel operations dashboard for HappyLand Hotel Diani.",
};

export default function Home() {
  return <HotelOperations initialSection="Dashboard" />;
}
