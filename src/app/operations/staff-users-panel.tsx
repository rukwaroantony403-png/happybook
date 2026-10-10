"use client";

import { useCallback, useEffect, useState } from "react";

type StaffRole = "admin" | "manager" | "receptionist" | "chief-accountant";
type StaffUser = { id: string; username: string; fullName: string; role: StaffRole };
const roleNames: Record<StaffRole, string> = { admin: "Administrator", manager: "Manager", receptionist: "Receptionist", "chief-accountant": "Chief accountant" };
const roleDescriptions: Record<StaffRole, string> = {
  admin: "Full access, including staff accounts and deleting records.",
  manager: "Full system access, except deleting rooms and reservations.",
  receptionist: "Full system access; cannot verify or reject payments.",
  "chief-accountant": "Full system access, including payment verification.",
};

export function StaffUsersPanel() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const adminCount = users.filter((user) => user.role === "admin").length;
  const adminLimitReached = adminCount >= 2;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Staff accounts could not be loaded.");
      setUsers(Array.isArray(result.users) ? result.users : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Staff accounts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadUsers(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  async function addUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(values.entries())),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Staff account could not be created.");
      form.reset();
      setMessage(`${result.user.fullName} was added as ${roleNames[result.user.role as StaffRole]}.`);
      await loadUsers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Staff account could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="staff-users-panel" aria-labelledby="staff-users-title">
    <header className="staff-users-heading">
      <div><span className="module-crumb">ACCESS &amp; SECURITY</span><h2 id="staff-users-title">Staff accounts</h2><p>Add a secure sign-in and assign the right hotel role. Passwords are stored as one-way hashes.</p></div>
      <span className="staff-user-count">{users.length} {users.length === 1 ? "account" : "accounts"} · {adminCount}/2 admins</span>
    </header>
    <div className="staff-role-cards">{(Object.keys(roleNames) as StaffRole[]).map((role) => <article key={role} className={`staff-role-card ${role}`}><b>{roleNames[role]}</b><p>{roleDescriptions[role]}</p></article>)}</div>
    <div className="staff-users-layout">
      <form className="staff-user-form" onSubmit={(event) => void addUser(event)}>
        <h3>Create a staff account</h3>
        <p>Use a unique username and a strong, individual password.</p>
        <label>Full name<input name="fullName" required minLength={2} maxLength={100} autoComplete="name" placeholder="e.g. Amina Hassan"/></label>
        <label>Username<input name="username" required minLength={3} maxLength={40} pattern="[A-Za-z0-9._-]+" autoComplete="off" placeholder="e.g. amina.hassan"/></label>
        <label>Role<select name="role" defaultValue="receptionist">{(Object.keys(roleNames) as StaffRole[]).map((role) => <option key={role} value={role} disabled={role === "admin" && adminLimitReached}>{roleNames[role]}{role === "admin" ? " (maximum 2)" : ""}</option>)}</select></label>
        {adminLimitReached && <small>Two administrator accounts are already active. Other staff roles are not limited by this cap.</small>}
        <label>Password<input name="password" required type="password" minLength={12} maxLength={128} autoComplete="new-password" aria-describedby="staff-password-hint" placeholder="At least 12 characters"/></label>
        <small id="staff-password-hint">At least 12 characters, including a number. Share it securely with the new staff member.</small>
        <button className="primary-btn" disabled={saving}>{saving ? "Creating account…" : "Add staff member"}</button>
        {error && <p className="staff-user-error" role="alert">{error}</p>}
        {message && <p className="staff-user-success" role="status">{message}</p>}
      </form>
      <section className="staff-user-list" aria-label="Active staff accounts">
        <h3>Active team</h3><p>Accounts use role-based payment and deletion controls.</p>
        {loading ? <p className="staff-user-empty" role="status">Loading staff accounts…</p> : users.length ? <ul>{users.map((user) => <li key={user.id}><span className="staff-user-avatar" aria-hidden="true">{user.fullName.trim().slice(0, 1).toUpperCase()}</span><span className="staff-user-details"><b>{user.fullName}</b><small>@{user.username}</small></span><span className={`staff-role-pill ${user.role}`}>{roleNames[user.role]}</span></li>)}</ul> : <p className="staff-user-empty">No active accounts were found.</p>}
      </section>
    </div>
  </section>;
}
