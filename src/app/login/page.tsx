import type { Metadata } from "next";
import Image from "next/image";
import LoginForm from "./login-form";
import "./login.css";

export const metadata: Metadata = {
  title: "Staff sign in | HappyLand Hotel Diani",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <main className="staff-login-page">
    <section className="staff-login-card">
      <div className="staff-login-brand"><Image src="/images/logonav.png" alt="HappyLand Hotel Diani" width={218} height={65} priority/></div>
      <span className="staff-login-eyebrow">SECURE STAFF ACCESS</span>
      <h1>Welcome back</h1>
      <p className="staff-login-intro">Sign in to continue to HappyLand Hotel operations.</p>
      <LoginForm/>
      <p className="staff-login-footer"><span/> Private hotel operations <i/> Diani Beach, Kenya</p>
    </section>
  </main>;
}
