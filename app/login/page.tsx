"use client";
import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = "/admin";
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: "48px auto" }}>
      <p className="kicker">PGLU Forms · Admin</p>
      <h2 style={{ marginTop: 6 }}>Sign in</h2>
      <p className="lede">
        The admin area is protected. Enter the app password to manage lists,
        forms, and responses.
      </p>
      <form onSubmit={submit} style={{ marginTop: 24, borderTop: "1px solid var(--line-dark)", paddingTop: 20 }}>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && (
          <div className="notice error" role="alert">
            <span className="notice-kicker">Error</span>
            {error}
          </div>
        )}
        <button className="btn block" type="submit" disabled={busy || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        Registrants don&apos;t need to sign in — form links are open to anyone
        with the link.
      </p>
    </div>
  );
}
