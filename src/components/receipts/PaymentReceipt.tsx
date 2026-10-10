"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type ReceiptCharge = { description: string; quantity: number; unitPriceKsh: number; amountKsh: number };
type ReceiptData = {
  paymentReference: string;
  receiptNumber: string;
  reservationReference: string;
  amountKsh: number;
  method: string;
  transactionReference: string | null;
  status: string;
  recorder: string;
  createdAt: string;
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  roomLabel: string;
  nights: number;
  charges: ReceiptCharge[];
  totalChargesKsh: number;
  paidBeforeKsh: number;
  pendingPaymentsKsh: number;
  balanceDueKsh: number;
};

const currency = (amount: number) => `Ksh ${new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;

function smallNumberWords(number: number): string {
  const ones = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (number < 20) return ones[number];
  if (number < 100) return `${tens[Math.floor(number / 10)]}${number % 10 ? `-${ones[number % 10]}` : ""}`;
  if (number < 1000) return `${ones[Math.floor(number / 100)]} Hundred${number % 100 ? ` ${smallNumberWords(number % 100)}` : ""}`;
  for (const [value, label] of [[1_000_000_000, "Billion"], [1_000_000, "Million"], [1000, "Thousand"]] as const) {
    if (number >= value) return `${smallNumberWords(Math.floor(number / value))} ${label}${number % value ? ` ${smallNumberWords(number % value)}` : ""}`;
  }
  return "";
}

function amountInWords(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0) return "Amount unavailable";
  return `${smallNumberWords(amount)} Kenyan Shillings Only`;
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatIssuedAt(value: string) {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(date);
}

export function PaymentReceiptDialog({ reference, autoPrint, onClose }: { reference: string; autoPrint?: boolean; onClose: () => void }) {
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState("");
  const autoPrintStarted = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/payments/${encodeURIComponent(reference)}/receipt`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Receipt could not be loaded.");
        setReceipt(result.receipt as ReceiptData);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name !== "AbortError") setError(requestError.message);
      });
    return () => controller.abort();
  }, [reference]);

  useEffect(() => {
    if (!receipt || !autoPrint || autoPrintStarted.current) return;
    autoPrintStarted.current = true;
    const timer = window.setTimeout(() => window.print(), 100);
    return () => window.clearTimeout(timer);
  }, [autoPrint, receipt]);
  const paidToDateKsh = receipt ? receipt.paidBeforeKsh + (receipt.status === "verified" ? receipt.amountKsh : 0) : 0;
  const pendingToDateKsh = receipt ? receipt.pendingPaymentsKsh + (receipt.status === "pending" ? receipt.amountKsh : 0) : 0;

  return <div className="receipt-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="receipt-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-preview-title">
      <header className="receipt-preview-controls">
        <div><span className="module-crumb">PAYMENT RECEIPT</span><h2 id="receipt-preview-title">{receipt ? receipt.receiptNumber : "Receipt preview"}</h2></div>
        <div><button type="button" className="outline-btn" onClick={onClose}>Close</button><button type="button" className="primary-btn" onClick={() => window.print()} disabled={!receipt}>Print receipt</button></div>
      </header>
      {error ? <p className="receipt-load-error" role="alert">{error}</p> : !receipt ? <p className="receipt-load-error" role="status">Loading saved payment receipt…</p> : <article id="payment-receipt" className="payment-receipt">
        <svg className="receipt-palm receipt-palm-left" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 96Q56 56 51 23M51 25Q26 16 12 7Q32 6 50 20M51 25Q66 7 89 4Q76 21 53 28M50 23Q42 4 40 0Q56 6 54 23M52 28Q77 24 98 31Q77 38 53 31M50 29Q27 31 4 43Q26 45 51 33" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"/></svg>
        <svg className="receipt-palm receipt-palm-right" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 96Q56 56 51 23M51 25Q26 16 12 7Q32 6 50 20M51 25Q66 7 89 4Q76 21 53 28M50 23Q42 4 40 0Q56 6 54 23M52 28Q77 24 98 31Q77 38 53 31M50 29Q27 31 4 43Q26 45 51 33" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"/></svg>
        <header className="receipt-letterhead">
          <div className="receipt-branding">
            <Image src="/images/logo.png" alt="HappyLand Hotel Diani" width={1920} height={512} priority/>
            <div className="receipt-hotel-contact"><b>0729896065</b><span>Diani Beach, Ukunda</span></div>
          </div>
          <div className="receipt-title-block">
            <h1>RECEIPT</h1>
            <span>{receipt.receiptNumber}</span>
            <small className={`receipt-payment-status ${receipt.status}`}>{receipt.status.replaceAll("-", " ").toUpperCase()}</small>
          </div>
        </header>
        <section className="receipt-stay-details" aria-label="Guest and stay details">
          <div className="receipt-detail receipt-room"><b>Room / Apartment No.:</b><span>{receipt.roomLabel}</span></div>
          <div className="receipt-detail receipt-issued"><b>Date:</b><span>{formatIssuedAt(receipt.createdAt)}</span></div>
          <div className="receipt-detail"><b>Check-In:</b><span>{formatDate(receipt.checkIn)}</span></div>
          <div className="receipt-detail"><b>Check-Out:</b><span>{formatDate(receipt.checkOut)}</span></div>
          <div className="receipt-detail receipt-guest"><b>Received From:</b><span>{receipt.guestName}</span></div>
          <div className="receipt-detail"><b>Phone No.:</b><span>{receipt.guestPhone}</span></div>
          <div className="receipt-detail receipt-method"><b>Payment Method:</b><span>{receipt.method === "Online payment" ? "Other" : receipt.method === "Bank transfer" ? "Bank Transfer" : receipt.method}</span></div>
          {receipt.transactionReference && <div className="receipt-detail receipt-transaction"><b>Transaction Ref:</b><span>{receipt.transactionReference}</span></div>}
        </section>
        <table className="receipt-charge-table" style={{ "--receipt-charge-count": Math.max(5, receipt.charges.length) } as CSSProperties}>
          <thead><tr><th>No.</th><th>Description</th><th>Qty</th><th>Unit Price (Ksh)</th><th>Amount (Ksh)</th></tr></thead>
          <tbody>
            {receipt.charges.map((charge, index) => <tr key={`${charge.description}-${index}`}>
              <td>{index + 1}</td><td>{charge.description}</td><td>{charge.quantity}</td><td>{currency(charge.unitPriceKsh)}</td><td>{currency(charge.amountKsh)}</td>
            </tr>)}
            {Array.from({ length: Math.max(0, 5 - receipt.charges.length) }, (_, index) => <tr key={`empty-${index}`} aria-hidden="true">
              <td>{receipt.charges.length + index + 1}</td><td></td><td></td><td></td><td></td>
            </tr>)}
          </tbody>
        </table>
        <section className="receipt-total-details">
          <div className="receipt-words"><b>Amount in Words:</b><span>{amountInWords(receipt.amountKsh)}</span></div>
          <div className={`receipt-settlement${pendingToDateKsh > 0 ? " has-pending" : ""}`} aria-label="Payment and balance summary">
            <div><span>Total charges</span><b>{currency(receipt.totalChargesKsh)}</b></div>
            <div><span>Verified paid to date</span><b>{currency(paidToDateKsh)}</b></div>
            <div><span>This transaction</span><b>{currency(receipt.amountKsh)}</b></div>
            {pendingToDateKsh > 0 && <div><span>Pending verification</span><b>{currency(pendingToDateKsh)}</b></div>}
            <div className="receipt-balance"><span>{receipt.status === "pending" ? "Balance if verified" : "Balance due"}</span><b>{currency(receipt.balanceDueKsh)}</b></div>
          </div>
          <div className="receipt-received-by"><b>Recorded By:</b><span>{receipt.recorder}</span></div>
        </section>
        <svg className="receipt-wave" viewBox="0 0 1200 70" preserveAspectRatio="none" aria-hidden="true">
          <path fill="#d7a52f" d="M0 8 Q160 47 330 28 T650 38 T980 46 T1200 20 V70 H0Z"/>
          <path fill="#075748" d="M0 18 Q160 56 330 37 T650 47 T980 55 T1200 29 V70 H0Z"/>
        </svg>
      </article>}
      <div id="payment-watermark" aria-hidden="true"><Image src="/images/logo.png" alt="" width={1920} height={512}/></div>
      <p className="receipt-print-note">For printing: choose A4 paper, Portrait, Actual size / 100%, and disable browser headers and footers. The 210 × 99 mm receipt is printed at the top of the page; receipt content has approximately 6 mm inset margins.</p>
    </section>
  </div>;
}
