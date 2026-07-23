# mcplint

Static, design-level linting for MCP tool surfaces. Deterministic, offline, and it never calls an LLM.

This is a monorepo:

| Package | What it is |
| --- | --- |
| [`packages/core`](packages/core) | The linter — 19 rules, the scoring engine, and the `mcplint` CLI. Publishable to npm. |
| [`apps/web`](apps/web) | The hosted playground: paste a `tools/list` dump or point it at a remote MCP URL, get a score and an audit. |

## Quick start

```bash
npm install
npm run build          # builds core (the web app imports it)

npm test               # every package
npm run dev            # the web app on http://localhost:3000
```

The web app runs with no cloud accounts configured: reports are held in memory, rate limiting is off,
and no analytics are sent. Copy `apps/web/.env.example` to `.env.local` to wire up the real services.
See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the production account, migration, publishing, and smoke-test
checklist.

## Releases

Production releases are semver Git tags (bare `X.Y.Z`, no `v` prefix — see `.npmrc`). From a clean
`mcp-playground-web` branch:

```bash
# Bump root, mcplint, and @mcplint/web together
npm version patch --workspaces --include-workspace-root

# Or bump one workspace plus the root
npm version patch -w @mcplint/web --include-workspace-root
npm version patch -w mcplint --include-workspace-root

git push origin HEAD --follow-tags
```

Use `minor` or `major` instead of `patch` when appropriate. Full runbook: [`DEPLOYMENT.md`](DEPLOYMENT.md).

## The CLI

```bash
npm run mcplint -- --stdio "node dist/server.js"
npm run mcplint -- https://example.com/mcp
npm run mcplint -- snapshot.json
```

See [`packages/core/README.md`](packages/core/README.md) for the full CLI, config, and scoring model,
and [`packages/core/docs/rules.md`](packages/core/docs/rules.md) for the rule catalogue.

## Hosted MCP server

The web app also serves a stateless Streamable HTTP MCP endpoint at `/api/mcp`. It exposes one
read-only tool, `check_mcp_server`, which accepts either a public HTTPS MCP URL (plus optional
headers) or an inline `tools/list` snapshot. The result includes structured composite/category
scores, footprint stats, and findings.

Each protocol request gets a fresh MCP server and transport. Tool inputs and captured schemas are
not written to the report store. See `/install` in the running web app for current Cursor, VS Code,
Claude, Windsurf, and generic client configurations.

## What the web app does and does not do

- **Ingest** is paste-a-dump or connect-to-an-https-URL. It never spawns a process, so stdio servers
  are a job for the CLI.
- **Remote capture is SSRF-guarded** ([`apps/web/lib/ssrf.ts`](apps/web/lib/ssrf.ts)): https only, every
  resolved address must be public unicast, the socket is pinned to the vetted IP so DNS rebinding
  cannot move it, and redirects are re-validated at every hop.
- **Reports are unlisted by default** — an unguessable URL, `noindex`, deleted after 30 days unless
  the owner opts them public. Anyone with an unlisted URL can view it.
- **The MCP endpoint is stateless** — unlike the interactive report workflow, it returns a report
  directly and does not persist the input, captured schemas, or result.
- **Everything is free.** The `GATE_FINDINGS` flag and `projectReport()` exist so a paid tier *could*
  withhold the audit while leaving the score free. It is off, and no billing exists.
