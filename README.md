# mcplint

Static, design-level linting for MCP tool surfaces. Deterministic, offline, and it never calls an LLM.

This is a monorepo:

| Package | What it is |
| --- | --- |
| [`packages/core`](packages/core) | The linter — 19 rules, the scoring engine, and the `mcplint` CLI. Publishable to npm. |
| [`apps/web`](apps/web) | The hosted playground: paste a `tools/list` dump or point it at a remote MCP URL, get a score and an audit. |

## Quick start

```bash
corepack enable pnpm
pnpm install
pnpm build          # builds core (the web app imports it)

pnpm test           # every package
pnpm dev            # the web app on http://localhost:3000
```

The web app runs with no cloud accounts configured: reports are held in memory, rate limiting is off,
and no analytics are sent. Copy `apps/web/.env.example` to `.env.local` to wire up the real services.

## The CLI

```bash
pnpm --filter mcplint exec tsx src/cli.ts --stdio "node dist/server.js"
pnpm --filter mcplint exec tsx src/cli.ts https://example.com/mcp
pnpm --filter mcplint exec tsx src/cli.ts snapshot.json
```

See [`packages/core/README.md`](packages/core/README.md) for the full CLI, config, and scoring model,
and [`packages/core/docs/rules.md`](packages/core/docs/rules.md) for the rule catalogue.

## What the web app does and does not do

- **Ingest** is paste-a-dump or connect-to-an-https-URL. It never spawns a process, so stdio servers
  are a job for the CLI.
- **Remote capture is SSRF-guarded** ([`apps/web/lib/ssrf.ts`](apps/web/lib/ssrf.ts)): https only, every
  resolved address must be public unicast, the socket is pinned to the vetted IP so DNS rebinding
  cannot move it, and redirects are re-validated at every hop.
- **Reports are private by default** — an unguessable URL, `noindex`, deleted after 30 days unless the
  owner opts them public.
- **Everything is free.** The `GATE_FINDINGS` flag and `projectReport()` exist so a paid tier *could*
  withhold the audit while leaving the score free. It is off, and no billing exists.
