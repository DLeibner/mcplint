"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

/**
 * The demand test. Everything on this page is already free — this asks whether
 * anyone wants the things that would justify charging (history, CI, diffs).
 *
 * It takes no payment and promises no date. If nobody clicks, we have learned
 * what we needed to know for the cost of a form.
 */
export function AuditCta({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="panel" style={{ marginTop: "2rem" }}>
        <p className="hint">Noted — we&apos;ll email you if this gets built. Nothing else, ever.</p>
      </div>
    );
  }

  return (
    <div className="panel" style={{ marginTop: "2rem" }}>
      {!open ? (
        <div className="row" style={{ marginTop: 0 }}>
          <p className="hint" style={{ maxWidth: "48ch" }}>
            Want to track this server over time, diff two runs, or fail a CI build when the score
            drops? That doesn&apos;t exist yet.
          </p>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              setOpen(true);
              track("cta_clicked", { id, cta: "audit_tracking" });
            }}
          >
            I&apos;d use that
          </button>
        </div>
      ) : (
        <form
          className="row"
          style={{ marginTop: 0 }}
          onSubmit={async (event) => {
            event.preventDefault();
            await fetch("/api/interest", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email, runId: id })
            });
            track("interest_submitted", { id });
            setDone(true);
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email"
            style={{
              flex: 1,
              minWidth: "16rem",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              color: "var(--text)",
              padding: "0.6rem 0.75rem",
              font: "inherit"
            }}
          />
          <button className="primary" type="submit">
            Tell me when it ships
          </button>
        </form>
      )}
    </div>
  );
}
