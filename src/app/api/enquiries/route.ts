import { storeEnquiry } from "@/lib/booking-store";
import { sendEnquiryEmail } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";
  const dates = typeof data.dates === "string" ? data.dates.trim() : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";
  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || phone.length > 40 || dates.length > 100 || message.length < 5 || message.length > 5000) {
    return Response.json({ error: "Check your name, email and message, then try again." }, { status: 400 });
  }
  const enquiry = { name, email, phone, dates, message };
  try {
    storeEnquiry(enquiry);
  } catch (error) {
    console.error("Enquiry could not be saved", error);
    return Response.json({ error: "We could not save your enquiry. Please try again." }, { status: 500 });
  }
  let emailSent = false;
  try {
    emailSent = await sendEnquiryEmail(enquiry);
  } catch (error) {
    console.error("Enquiry saved; email delivery failed", error);
  }
  return Response.json({ received: true, emailSent }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
