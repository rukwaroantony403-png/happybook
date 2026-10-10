import type { Metadata } from "next";
import { InteriorPage, SectionHeading } from "@/components/interior-page";
import GalleryWall from "@/components/gallery-wall";

export const metadata: Metadata = { title: "Gallery", description: "View photographs published by HappyLand Hotel Diani." };
export default function GalleryPage() {
  return <><InteriorPage eyebrow="Property gallery" title="HappyLand photographs" intro="View photographs published by the hotel." image="/images/herohome.png" imageAlt="HappyLand Hotel Diani"/><section className="interior-content"><div className="wrap"><SectionHeading eyebrow="PHOTO GALLERY" title="Hotel photographs" text="Only images added to the hotel's published content appear here."/><GalleryWall/></div></section></>;
}
