import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv[2] === "--check";
const expectedTag = checkOnly ? process.argv[3] : undefined;
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

if (!checkOnly && process.argv.length > 2) {
  throw new Error("Usage: node scripts/sync-version.mjs [--check [v<semver>]]");
}
if (checkOnly && process.argv.length > 4) {
  throw new Error("Usage: node scripts/sync-version.mjs [--check [v<semver>]]");
}
if (existsSync(resolve(repositoryRoot, "package-lock.json"))) {
  throw new Error("package-lock.json is not allowed; this repository uses pnpm.");
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  writeFileSync(resolve(repositoryRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

const rootPackage = readJson("package.json");
const version = rootPackage.version;
if (typeof version !== "string" || !semverPattern.test(version)) {
  throw new Error(`Root package version is not valid SemVer: ${String(version)}`);
}

const targets = [
  ["packages/core/package.json", readJson("packages/core/package.json")],
  ["apps/web/package.json", readJson("apps/web/package.json")],
  ["server.json", readJson("server.json")]
];

if (checkOnly) {
  const mismatches = targets
    .filter(([, metadata]) => metadata.version !== version)
    .map(([path, metadata]) => `${path} has ${String(metadata.version)}, expected ${version}`);

  if (expectedTag !== undefined && expectedTag !== `v${version}`) {
    mismatches.push(`tag is ${expectedTag}, expected v${version}`);
  }
  if (mismatches.length > 0) {
    throw new Error(`Release metadata is not synchronized:\n- ${mismatches.join("\n- ")}`);
  }

  console.log(`Release metadata is synchronized at ${version}.`);
} else {
  for (const [path, metadata] of targets) {
    metadata.version = version;
    writeJson(path, metadata);
  }
  console.log(`Synchronized release metadata to ${version}.`);
}
