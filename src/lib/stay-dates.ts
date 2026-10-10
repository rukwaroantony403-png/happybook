export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function validStay(checkIn: string, checkOut: string) {
  if (checkOut <= checkIn) return false;
  const nights = (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000;
  const dianiToday = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return nights >= 1 && nights <= 60 && checkIn >= dianiToday;
}
