# Production release runbook

Production releases are immutable Git tags. `.github/workflows/release.yml` verifies the tag,
deploys and smoke-tests the web app, publishes the npm package with provenance, and then publishes
the remote server metadata to the official MCP Registry. A failure stops every downstream job.

## Release order

1. **Verify** — require a `v<semver>` tag on `mcp-playground-web`; check all four versions; install
   the frozen pnpm lockfile; typecheck; run all Vitest unit/protocol tests; run Playwright Chromium;
   build; validate `server.json`; run npm pack/publish dry runs; and save the checked package
   tarball.
2. **Deploy** — pull the linked Vercel production settings, build with pinned Vercel CLI 56.3.2,
   deploy the prebuilt output, and smoke-test the actual production origin.
3. **Publish npm** — publish the verified `mcplint` tarball as public with GitHub OIDC and npm
   provenance. If that exact immutable version already exists, a rerun skips it.
4. **Publish MCP Registry metadata** — validate `server.json`, authenticate the
   `io.github.dleibner` namespace with GitHub OIDC, and publish it. An existing exact version is
   skipped, so reruns never overwrite registry metadata.

The npm and MCP Registry jobs cannot run until the production deployment and its `/`, `/install`,
`/rules`, MCP `initialize`, `tools/list`, and snapshot `tools/call` checks have passed.

## One-time GitHub setup

Create a GitHub Environment named exactly `production` in `DLeibner/mcplint`:

- Add a required reviewer.
- Prevent self-review if another maintainer is available.
- Restrict deployment tags to `v*`.
- Keep the `mcp-playground-web` branch protected and require CI before release commits are pushed.

Add these **Environment secrets** to `production` (not repository variables and never committed):

| Name | Value |
| --- | --- |
| `VERCEL_TOKEN` | A least-privilege Vercel access token that can deploy this project |
| `VERCEL_ORG_ID` | The linked Vercel team/account ID |
| `VERCEL_PROJECT_ID` | The linked Vercel project ID |

Add this **Environment variable**:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The canonical HTTPS production origin, currently `https://mcplint.vercel.app` |

`NEXT_PUBLIC_SITE_URL` must be an origin only: no path, query, fragment, or trailing route. The
release smoke test also requires `server.json` to advertise this same origin.

Do not add `NPM_TOKEN`, `NODE_AUTH_TOKEN`, or an MCP Registry token. The two publishing jobs use
short-lived GitHub OIDC credentials and request `id-token: write` only on those jobs.

## One-time Vercel and data-service setup

A Vercel project must be imported and linked once **before** `VERCEL_ORG_ID` and
`VERCEL_PROJECT_ID` exist. From the monorepo root:

```bash
pnpm dlx vercel@56.3.2 login
pnpm dlx vercel@56.3.2 link --repo
cat .vercel/project.json
```

Select the `DLeibner/mcplint` repository and the web project. `.vercel/project.json` supplies
`orgId` and `projectId`; copy those values to the GitHub Environment secrets above. `.vercel/` is
gitignored and must stay uncommitted.

Configure the Vercel project:

- Root Directory: `apps/web`
- Include source files outside the Root Directory: enabled
- Framework: Next.js
- Node.js: 22
- Install Command: `cd ../.. && pnpm install --frozen-lockfile`
- Build Command:
  `cd ../.. && pnpm --filter mcplint build && pnpm --filter @mcplint/web build`
- Output Directory: `.next`

Configure these Vercel **Production** environment variables:

```text
NEXT_PUBLIC_SITE_URL=https://mcplint.vercel.app
DATABASE_URL=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
IP_HASH_SALT=...
CRON_SECRET=...
GATE_FINDINGS=false
NEXT_PUBLIC_POSTHOG_KEY=...       # optional
NEXT_PUBLIC_POSTHOG_HOST=...      # optional
```

Create the Neon database and apply the checked-in schema once:

```bash
export DATABASE_URL='the Neon connection string'
pnpm --filter @mcplint/web db:migrate
```

Create Upstash Redis and generate independent secrets:

```bash
openssl rand -hex 32 # IP_HASH_SALT
openssl rand -hex 32 # CRON_SECRET
```

Remote URL audits intentionally fail closed without Upstash. Report persistence falls back to
memory without Neon and is not durable. Apply future production database migrations before tagging
a release; the release workflow deliberately does not mutate the database.

The CLI workflow performs the production deployment. Disable automatic Vercel Git production
deployments if they would create a second, unverified production path.

## One-time npm setup

The package `mcplint` does not yet exist on npm. npm cannot attach a Trusted Publisher to a package
until a package record exists, so a one-time interactive bootstrap publish is unavoidable. Do this
from a disposable copy and publish version `0.0.0`, leaving this repository at `0.1.0`:

```bash
tmp="$(mktemp -d)"
git clone --local . "$tmp/mcplint"
cd "$tmp/mcplint"
corepack enable
pnpm install --frozen-lockfile
npm version 0.0.0 --no-git-tag-version
pnpm --filter mcplint build
npm login
npm publish ./packages/core --access public
npm deprecate mcplint@0.0.0 "Bootstrap release; use 0.1.0 or newer."
npm logout
cd -
rm -rf "$tmp"
```

This uses an interactive npm session, not a long-lived CI token. Confirm the package owner is the
npm account that will administer releases.

Then open the `mcplint` package settings on npmjs.com and configure its one Trusted Publisher:

- Provider: GitHub Actions
- Organization or user: `DLeibner`
- Repository: `mcplint`
- Workflow filename: `release.yml` — filename only, exact case, including `.yml`
- Environment: `production` — exact case
- Allowed action: `npm publish`

Trusted Publisher configuration must point to the exact workflow filename and Environment or OIDC
authentication will fail. The workflow uses a GitHub-hosted runner, npm 12.0.1, `id-token: write`,
public access, and provenance. Do not store an npm token in GitHub.

## One-time MCP Registry setup

No Registry secret is required. The official Registry supports GitHub Actions OIDC for the personal
`io.github.dleibner/*` namespace. The repository owner must be the `DLeibner` GitHub account; the
namespace comparison is case-normalized. The workflow uses the checksum-verified
`mcp-publisher` v1.8.0 binary and runs:

```bash
mcp-publisher validate server.json
mcp-publisher login github-oidc
mcp-publisher publish server.json
```

The Registry is still in preview and may make breaking schema/API changes or reset data. If its
OIDC or schema behavior changes, update and re-verify the pinned publisher and checksum before the
next release. Registry publication is downstream of both the live endpoint smoke test and npm.

## Create a release

Start clean and up to date on the release branch:

```bash
git switch mcp-playground-web
git pull --ff-only origin mcp-playground-web
git status --short
```

Choose exactly one version increment. `npm version` runs the repository's synchronization script,
updates the root package, `packages/core/package.json`, `apps/web/package.json`, and `server.json`,
stages those generated changes, creates the version commit, and creates the `v<version>` Git tag.
The repository `.npmrc` prevents a `package-lock.json`; pnpm remains the package manager.

```bash
npm version patch
# or: npm version minor
# or: npm version major
```

Review the commit and tag, then push the branch and annotated tag together:

```bash
git show --stat --decorate HEAD
git push origin mcp-playground-web --follow-tags
```

Never create or force-move a release tag by hand. Never rerun `npm version` after a partial release;
rerun the existing GitHub Actions workflow instead. npm and Registry exact versions are immutable
and the workflow safely skips versions that already exist.

## Post-release checks

The workflow performs automated route and MCP protocol smoke tests. After it succeeds:

```bash
npx mcplint@<version> --help
npx mcplint@<version> /path/to/a-sanitised-snapshot.json
```

Also confirm the npm package page shows provenance, the Vercel production alias targets the new
deployment, and the exact `io.github.dleibner/mcplint` version appears in the official MCP Registry.
Do not announce a release until all three external systems agree.
