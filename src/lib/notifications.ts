import "server-only";
import nodemailer from "nodemailer";

function getMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
}

export async function sendBookingEmails(booking: {
  reference: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  name: string;
  email: string;
  totalKsh: number;
}) {
  const mailer = getMailer();
  const hotelEmail = process.env.HOTEL_NOTIFICATION_EMAIL;
  const from = process.env.SMTP_FROM;
  if (!mailer || !hotelEmail || !from) return false;
  const total = new Intl.NumberFormat("en-KE").format(booking.totalKsh);
  await Promise.all([
    mailer.sendMail({
      from,
      to: booking.email,
      subject: `HappyLand booking confirmed · ${booking.reference}`,
      text: `Hello ${booking.name},\n\nYour reservation is confirmed.\nReference: ${booking.reference}\nRoom: ${booking.roomName}\nDates: ${booking.checkIn} to ${booking.checkOut}\nGuests: ${booking.guests}\nStay total: KES ${total}\n\nTo make a partial or full M-Pesa payment, first call +254 729 896 065 to confirm the hotel's current payment details. After paying, submit the amount and M-Pesa transaction code for staff verification at https://happylandhoteldiani.co.ke/payment?reference=${encodeURIComponent(booking.reference)}.\n\nA payment is not counted as received until hotel staff verify the transaction.`,
    }),
    mailer.sendMail({
      from,
      to: hotelEmail,
      subject: `New reservation · ${booking.reference}`,
      text: `Reference: ${booking.reference}\nGuest: ${booking.name}\nEmail: ${booking.email}\nRoom: ${booking.roomName}\nDates: ${booking.checkIn} to ${booking.checkOut}\nGuests: ${booking.guests}\nStay total: KES ${total}`,
    }),
  ]);
  return true;
}

export async function sendEnquiryEmail(enquiry: { name: string; email: string; phone?: string; dates?: string; message: string }) {
  const mailer = getMailer();
  const hotelEmail = process.env.HOTEL_NOTIFICATION_EMAIL;
  const from = process.env.SMTP_FROM;
  if (!mailer || !hotelEmail || !from) return false;
  await mailer.sendMail({
    from,
    to: hotelEmail,
    replyTo: enquiry.email,
    subject: `Website enquiry from ${enquiry.name}`,
    text: `Name: ${enquiry.name}\nEmail: ${enquiry.email}\nPhone: ${enquiry.phone || "Not provided"}\nPreferred dates: ${enquiry.dates || "Not provided"}\n\n${enquiry.message}`,
  });
  return true;
}
