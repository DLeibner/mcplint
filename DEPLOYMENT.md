# Deployment runbook

The application is ready to deploy, but production accounts and credentials are
deliberately not created or stored by the repository.

## 1. Authenticate services

Create accounts for:

- Vercel, connected to the `DLeibner/mcplint` GitHub repository
- Neon Postgres
- Upstash Redis
- npm, with 2FA or trusted publishing
- PostHog, optional but recommended for launch attribution

Authenticate locally rather than pasting credentials into issues or chat:

```bash
npx vercel login
npm login
```

## 2. Create data services

Create one Neon database and run the checked-in migration:

```bash
export DATABASE_URL='the Neon connection string'
pnpm --filter @mcplint/web db:migrate
```

Create one Upstash Redis database. Keep its REST URL and REST token.

Generate independent secrets:

```bash
openssl rand -hex 32 # IP_HASH_SALT
openssl rand -hex 32 # CRON_SECRET
```

## 3. Create the Vercel project

Import the GitHub repository with these settings:

- Root Directory: `apps/web`
- Include source files outside the Root Directory: enabled
- Framework: Next.js
- Node.js: 22
- Install Command: `cd ../.. && pnpm install --frozen-lockfile`
- Build Command:
  `cd ../.. && pnpm --filter mcplint build && pnpm --filter @mcplint/web build`
- Output Directory: `.next`

Configure these production environment variables:

```text
NEXT_PUBLIC_SITE_URL=https://the-final-production-origin
DATABASE_URL=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
IP_HASH_SALT=...
CRON_SECRET=...
GATE_FINDINGS=false
NEXT_PUBLIC_POSTHOG_KEY=...       # optional
NEXT_PUBLIC_POSTHOG_HOST=...      # optional
```

Remote URL audits intentionally fail closed in production until Upstash is
configured. Report persistence falls back to memory without Neon and therefore
must not be described as durable.

## 4. Publish the CLI

The unscoped package name `mcplint` is currently available. From a clean,
authenticated npm session:

```bash
pnpm --filter mcplint build
cd packages/core
npm publish --access public
```

After publishing, verify from a directory outside the repository:

```bash
npx mcplint@0.1.0 --help
npx mcplint@0.1.0 /path/to/a/sanitised-snapshot.json
```

## 5. Publish MCP metadata

Update `server.json` if the final Vercel origin differs from
`https://mcplint.vercel.app`, then verify the deployed endpoint before registry
publication.

```bash
npx @modelcontextprotocol/inspector https://the-final-production-origin/api/mcp
mcp-publisher login github
mcp-publisher publish
```

The official registry is in preview. Registry publication comes after the
endpoint is public, not before.

## 6. Production smoke tests

Verify all of the following before removing launch gates:

1. Paste the seeded snapshot and open the resulting unlisted report.
2. Change the report to public, back to unlisted, then delete it.
3. Audit an approved public HTTPS MCP endpoint.
4. Initialize `/api/mcp`, list tools, and call `check_mcp_server`.
5. Open the Cursor and VS Code install links from `/install`.
6. Confirm the exact installed Grafana prompt uses a snapshot when client
   context exposes schemas and asks for an endpoint or JSON when it does not.
7. Confirm the purge cron rejects requests without `CRON_SECRET`.
8. Inspect analytics payloads and confirm they contain attribution fields but
   no schemas, findings, server names, raw URLs, or credentials.

Do not publish launch posts until the application has remained stable for the
required release window and every post-specific capture gate has passed.
