import { LintForm } from "@/components/LintForm";

export default function HomePage() {
  return (
    <main>
      <h1>Your tools cost tokens in every single conversation.</h1>
      <p className="lede">
        Every MCP server ships its whole <code>tools/list</code> payload into the model&apos;s context
        before the user has typed a word. mcplint measures that footprint, then statically audits the
        tool surface for the design smells that make agents pick the wrong tool — naming drift, CRUD
        mirrors, overlapping descriptions, unbounded lists.
      </p>

      <LintForm />

      <h2>What it checks</h2>
      <p className="lede">
        Nineteen rules across six categories. Tier 1 is hygiene — missing descriptions, loose schemas,
        absent annotations. Tier 2 is the interesting half: design. Whether your surface mirrors your
        REST API instead of your users&apos; intents, whether two tools are confusable, whether an enum
        is buried in prose where the model can&apos;t see it.{" "}
        <a href="/rules">Read the rule catalogue →</a>
      </p>

      <h2>It runs locally too</h2>
      <p className="lede">
        The site is a wrapper around a CLI. For a server on stdio, or one you&apos;d rather not paste
        anywhere, run it yourself:
      </p>
      <div className="panel">
        <code style={{ fontFamily: "var(--mono)", fontSize: "0.85rem" }}>
          npx mcplint --stdio &quot;node dist/server.js&quot;
        </code>
      </div>
    </main>
  );
}
