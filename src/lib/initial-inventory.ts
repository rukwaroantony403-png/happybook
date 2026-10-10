export type InitialPhysicalRoom = {
  code: string;
  categorySlug: "studio" | "1-bedroom" | "2-bedroom";
  maxGuests: number;
  nightlyRateKsh: number;
};

export const initialPhysicalRooms: InitialPhysicalRoom[] = [
  ...["A3", "C3", "D3", "E1", "F1"].map((code) => ({ code, categorySlug: "studio" as const, maxGuests: 2, nightlyRateKsh: 7000 })),
  ...["A1", "B1", "C1", "D1", "A4", "B4", "C4", "D4", "E3", "F3"].map((code) => ({ code, categorySlug: "1-bedroom" as const, maxGuests: 3, nightlyRateKsh: 12500 })),
  ...["A2", "C2", "D2", "E2", "F2"].map((code) => ({ code, categorySlug: "2-bedroom" as const, maxGuests: 5, nightlyRateKsh: 20000 })),
];

export const initialRoomAmenities = [
  "Comfortable bed",
  "Private bathroom",
  "Wi-Fi",
  "TV",
  "Air conditioning or fan",
  "Kitchenette",
  "Refrigerator",
  "Cooking facilities where applicable",
  "Wardrobe",
  "Bed linen",
  "Towels",
  "Hot/cold shower",
  "Dining/seating area",
  "Power outlets",
  "Housekeeping",
];

export const initialRoomCategories = [
  {
    slug: "studio",
    name: "Bedsitter / Studio",
    description: "Enjoy a comfortable and private studio-style stay at HappyLand Hotel Diani. These compact, practical units are ideal for solo travellers or couples looking for an affordable and relaxing base near the Diani coast. The space combines sleeping, living and essential amenities in one convenient accommodation.",
  },
  {
    slug: "1-bedroom",
    name: "1 Bedroom Apartment",
    description: "Relax in a spacious one-bedroom accommodation designed for couples, small families and longer stays. Enjoy a private bedroom, comfortable living space and the convenience of a home-like environment while staying in Diani.",
  },
  {
    slug: "2-bedroom",
    name: "2 Bedroom Apartment",
    description: "Enjoy extra space and privacy in our two-bedroom accommodation, ideal for families, couples travelling together or groups of friends. With separate bedrooms and a comfortable shared living space, it provides the flexibility of a home away from home in Diani.",
  },
];

export const initialRoomCombinations = [
  {
    slug: "three-bedroom-a2-a3",
    name: "3 Bedroom Apartment",
    displayName: "3 Bedroom · A2 + A3",
    unitCodes: ["A2", "A3"],
    maxGuests: 8,
    nightlyRateKsh: 35000,
    description: "Enjoy a spacious three-bedroom accommodation designed for larger families or groups travelling together, with room to gather and relax during a Diani stay.",
  },
  {
    slug: "three-bedroom-c2-c3",
    name: "3 Bedroom Apartment",
    displayName: "3 Bedroom · C2 + C3",
    unitCodes: ["C2", "C3"],
    maxGuests: 8,
    nightlyRateKsh: 35000,
    description: "Enjoy the flexibility and space of a three-bedroom stay, with room for families and groups to relax together while enjoying privacy during their time in Diani.",
  },
  {
    slug: "three-bedroom-d2-d3",
    name: "3 Bedroom Apartment",
    displayName: "3 Bedroom · D2 + D3",
    unitCodes: ["D2", "D3"],
    maxGuests: 8,
    nightlyRateKsh: 35000,
    description: "Experience a spacious three-bedroom stay designed for families and groups who want additional room and privacy while enjoying a relaxing visit to HappyLand Hotel Diani.",
  },
];
