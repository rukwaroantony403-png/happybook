"use client";

import { useState } from "react";

function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/";
  return value;
}

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Sign-in failed. Check your details and try again.");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.replace(safeReturnPath(next));
    } catch {
      setError("Could not connect to the hotel system. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="staff-login-form" onSubmit={(event) => void signIn(event)}>
    <label>Username<input name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required autoFocus/></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required/></label>
    {error && <p className="staff-login-error" role="alert">{error}</p>}
    <button type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}<span aria-hidden="true">→</span></button>
  </form>;
}
