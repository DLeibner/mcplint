import { Agent, fetch as undiciFetch } from "undici";
import type { LookupFunction } from "node:net";
import { assertAllowedUrl, resolvePublicAddress, SsrfError, type PinnedAddress } from "./ssrf";

export const MAX_REDIRECTS = 3;
export const MAX_BODY_BYTES = 5 * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Force every connection attempt onto the single address we already validated.
 *
 * This is the part that defeats DNS rebinding. Validating the DNS answer and
 * then calling `fetch` would re-resolve the name, and an attacker controlling
 * the zone can answer "public" the first time and "127.0.0.1" the second. By
 * handing undici a lookup that ignores the hostname entirely, the socket cannot
 * land anywhere except the address we vetted.
 */
function pinnedLookup(pinned: PinnedAddress): LookupFunction {
  return ((_hostname: string, options: unknown, callback: unknown) => {
    const cb = callback as (
      err: NodeJS.ErrnoException | null,
      address: string | Array<{ address: string; family: number }>,
      family?: number
    ) => void;
    const all = (options as { all?: boolean } | undefined)?.all;
    if (all) cb(null, [{ address: pinned.address, family: pinned.family }]);
    else cb(null, pinned.address, pinned.family);
  }) as unknown as LookupFunction;
}

/** Abort oversized responses and release the per-request connection pool. */
function capBody(
  body: ReadableStream<Uint8Array> | null,
  onDone: () => Promise<void>
): ReadableStream<Uint8Array> | null {
  if (!body) {
    void onDone();
    return null;
  }
  const reader = body.getReader();
  let seen = 0;
  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    await onDone();
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          await release();
          return;
        }
        seen += value.byteLength;
        if (seen > MAX_BODY_BYTES) {
          await reader.cancel();
          controller.error(new SsrfError(`Response exceeded ${MAX_BODY_BYTES} bytes.`));
          await release();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
        await release();
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        await release();
      }
    }
  });
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * A `fetch` that will only ever talk to public internet addresses.
 *
 * Handed to `McpCapture.fromHttp` so the MCP SDK's transport inherits every
 * guarantee below without knowing anything about them:
 *   - https only
 *   - hostname resolves exclusively to public unicast addresses
 *   - the socket is pinned to a pre-validated IP (no rebinding)
 *   - redirects are followed by hand and re-validated at every hop
 *   - bounded time and bounded body
 */
export function createGuardedFetch(): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    let url = new URL(input instanceof Request ? input.url : String(input));

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      assertAllowedUrl(url);
      const pinned = await resolvePublicAddress(url.hostname);

      const agent = new Agent({
        connect: { lookup: pinnedLookup(pinned) },
        headersTimeout: REQUEST_TIMEOUT_MS,
        bodyTimeout: REQUEST_TIMEOUT_MS
      });

      let response: Awaited<ReturnType<typeof undiciFetch>>;
      try {
        response = await undiciFetch(url, {
          ...(init as Parameters<typeof undiciFetch>[1]),
          redirect: "manual",
          dispatcher: agent
        });
      } catch (error) {
        await agent.close();
        throw error;
      }

      if (!isRedirect(response.status)) {
        const body = capBody(
          response.body as ReadableStream<Uint8Array> | null,
          async () => agent.close()
        );
        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers as unknown as HeadersInit
        });
      }

      // A public URL that 302s to http://169.254.169.254/ is the classic bypass.
      // Every hop goes back through the full check, from the top.
      const location = response.headers.get("location");
      await response.body?.cancel();
      await agent.close();
      if (!location) throw new SsrfError("Redirect without a Location header.");
      url = new URL(location, url);
    }

    throw new SsrfError(`Exceeded ${MAX_REDIRECTS} redirects.`);
  }) as typeof fetch;
}
