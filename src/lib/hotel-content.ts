export function hotelPhoto(id: string, width = 1100) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
}
