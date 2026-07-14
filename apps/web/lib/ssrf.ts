import { lookup as dnsLookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

/**
 * SSRF guard for user-supplied MCP endpoints.
 *
 * We fetch arbitrary URLs supplied by anonymous strangers from inside our own
 * network. The threat is not a weird URL — it is a URL that resolves to
 * something only *we* can reach: 127.0.0.1, a VPC neighbour, or the cloud
 * metadata endpoint at 169.254.169.254 that hands out credentials.
 *
 * The posture here is default-deny. We do not enumerate bad ranges and allow
 * the rest; we allow exactly one thing — a globally routable unicast address —
 * and reject everything else, including every flavour of IPv6 tunnel that can
 * smuggle an IPv4 address inside it.
 */

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

/** IPv6 ranges that embed an IPv4 address, which must be unwrapped and re-checked. */
const V4_IN_V6_RANGES = new Set(["ipv4Mapped", "rfc6145", "rfc6052", "6to4", "teredo"]);

/**
 * True unless `ip` is a globally routable unicast address.
 *
 * Rejects loopback, private, link-local (metadata!), CGNAT, multicast,
 * broadcast, and reserved space — and unwraps IPv4-in-IPv6 forms so that
 * `::ffff:127.0.0.1` cannot sneak past a naive v6 check.
 */
export function isBlockedAddress(ip: string): boolean {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(ip);
  } catch {
    return true; // unparseable: deny
  }

  if (parsed.kind() === "ipv6") {
    const v6 = parsed as ipaddr.IPv6;
    if (V4_IN_V6_RANGES.has(v6.range())) {
      // Unwrap the embedded IPv4 and judge *that*. `toIPv4Address` only works
      // for genuinely mapped addresses; anything else we refuse outright.
      if (!v6.isIPv4MappedAddress()) return true;
      return isBlockedAddress(v6.toIPv4Address().toString());
    }
  }

  // Default-deny: `unicast` is the only range we are willing to talk to.
  return parsed.range() !== "unicast";
}

export interface PinnedAddress {
  address: string;
  family: 4 | 6;
}

/**
 * Resolve `hostname` and assert every address it maps to is public.
 *
 * We check *all* records, not just the first: a host that resolves to both a
 * public and a private address is an attack, not a misconfiguration.
 *
 * Returns the address we intend to connect to, so the caller can pin the socket
 * to it. Re-resolving later would reopen the DNS-rebinding hole this closes.
 */
export async function resolvePublicAddress(hostname: string): Promise<PinnedAddress> {
  // `URL.hostname` keeps the brackets on an IPv6 literal ("[::1]"), which no IP
  // parser accepts. Strip them, or `https://[::1]/` would slip past the literal
  // check and be handed to DNS instead of being recognised as loopback.
  const host = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  // A bare IP literal in the URL never hits DNS — validate it directly.
  if (ipaddr.isValid(host)) {
    if (isBlockedAddress(host)) {
      throw new SsrfError(`Refusing to connect to non-public address ${host}.`);
    }
    const kind = ipaddr.parse(host).kind();
    return { address: host, family: kind === "ipv6" ? 6 : 4 };
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dnsLookup(host, { all: true });
  } catch {
    throw new SsrfError(`Could not resolve ${host}.`);
  }
  if (records.length === 0) throw new SsrfError(`${hostname} resolved to no addresses.`);

  for (const record of records) {
    if (isBlockedAddress(record.address)) {
      throw new SsrfError(
        `${hostname} resolves to the non-public address ${record.address}; refusing to connect.`
      );
    }
  }

  const first = records[0]!;
  return { address: first.address, family: first.family === 6 ? 6 : 4 };
}

/** Scheme check. `https` only — plaintext would let a MITM redirect us inward. */
export function assertAllowedUrl(url: URL): void {
  if (url.protocol !== "https:") {
    throw new SsrfError(`Only https:// endpoints are supported (got "${url.protocol}").`);
  }
}
