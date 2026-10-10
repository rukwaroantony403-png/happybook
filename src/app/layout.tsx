import type { Metadata } from "next";
import "./operations.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.HOTEL_SITE_URL || "https://booking.happylandhoteldiani.co.ke"),
  title: {
    default: "HappyLand Hotel Diani | Hotel Operations",
    template: "%s | HappyLand Hotel Diani",
  },
  description: "Hotel operations and booking management for HappyLand Hotel Diani.",
  keywords: ["Hotels in Diani", "Hotel in Diani Beach", "Diani Beach accommodation", "Hotels in Diani Kenya", "Beach hotel Diani", "Where to stay in Diani", "Diani hotel booking"],
  openGraph: {
    title: "HappyLand Hotel Diani — Hotel Operations",
    description: "Hotel operations and booking management system.",
    type: "website",
    locale: "en_KE",
    images: [{ url: "/images/herohome.png", width: 1600, height: 900, alt: "HappyLand Hotel Diani" }],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
