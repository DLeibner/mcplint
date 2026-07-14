"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

type Mode = "paste" | "url";

export function LintForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("paste");
  const [pasted, setPasted] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    let body: unknown;
    if (mode === "paste") {
      try {
        body = { mode: "paste", snapshot: JSON.parse(pasted) };
      } catch {
        setError("That isn't valid JSON. Paste the response to a tools/list call, or the output of `mcplint --dump`.");
        return;
      }
    } else {
      body = { mode: "url", url };
    }

    setBusy(true);
    track("lint_started", { mode });
    try {
      const response = await fetch("/api/lint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        track("lint_failed", { mode, status: response.status });
        setError(data.error ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      track("lint_succeeded", { mode });
      router.push(`/r/${data.id}`);
    } catch {
      track("lint_failed", { mode, status: 0 });
      setError("Could not reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className="tab"
          aria-selected={mode === "paste"}
          onClick={() => setMode("paste")}
        >
          Paste tools/list
        </button>
        <button
          type="button"
          role="tab"
          className="tab"
          aria-selected={mode === "url"}
          onClick={() => setMode("url")}
        >
          Remote MCP URL
        </button>
      </div>

      {mode === "paste" ? (
        <>
          <textarea
            rows={10}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={'{\n  "tools": [\n    { "name": "search_hotels", "description": "…" }\n  ]\n}'}
            spellCheck={false}
            aria-label="tools/list JSON"
          />
          <div className="row">
            <p className="hint">
              The JSON never leaves your report. Nothing is indexed, and you can delete it.
            </p>
            <button className="primary" type="submit" disabled={busy || !pasted.trim()}>
              {busy ? "Auditing…" : "Audit surface"}
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/mcp"
            aria-label="MCP server URL"
          />
          <div className="row">
            <p className="hint">
              https only. We connect, read <code>tools/list</code>, and disconnect — no tool is ever
              called.
            </p>
            <button className="primary" type="submit" disabled={busy || !url.trim()}>
              {busy ? "Connecting…" : "Audit surface"}
            </button>
          </div>
        </>
      )}

      {error && <div className="error-box">{error}</div>}
    </form>
  );
}
