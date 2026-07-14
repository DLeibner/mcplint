import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { assertAllowedUrl, isBlockedAddress, resolvePublicAddress, SsrfError } from "./ssrf";

const mocks = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));

describe("isBlockedAddress", () => {
  const blocked = [
    ["loopback v4", "127.0.0.1"],
    ["loopback v4, non-canonical", "127.1.2.3"],
    ["cloud metadata endpoint", "169.254.169.254"],
    ["link-local v4", "169.254.0.1"],
    ["private 10/8", "10.0.0.1"],
    ["private 172.16/12", "172.16.31.9"],
    ["private 192.168/16", "192.168.1.1"],
    ["CGNAT 100.64/10", "100.64.0.1"],
    ["unspecified v4", "0.0.0.0"],
    ["broadcast", "255.255.255.255"],
    ["multicast v4", "224.0.0.1"],
    ["loopback v6", "::1"],
    ["unspecified v6", "::"],
    ["unique-local v6", "fd00::1"],
    ["link-local v6", "fe80::1"],
    ["multicast v6", "ff02::1"],
    ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
    ["IPv4-mapped metadata", "::ffff:169.254.169.254"],
    ["IPv4-mapped private", "::ffff:10.0.0.1"],
    ["garbage", "not-an-ip"]
  ] as const;

  for (const [label, ip] of blocked) {
    it(`blocks ${label} (${ip})`, () => {
      expect(isBlockedAddress(ip)).toBe(true);
    });
  }

  const allowed = [
    ["public v4", "1.1.1.1"],
    ["public v4", "93.184.216.34"],
    ["public v6", "2606:4700:4700::1111"]
  ] as const;

  for (const [label, ip] of allowed) {
    it(`allows ${label} (${ip})`, () => {
      expect(isBlockedAddress(ip)).toBe(false);
    });
  }
});

describe("assertAllowedUrl", () => {
  it("rejects plaintext http", () => {
    expect(() => assertAllowedUrl(new URL("http://example.com/mcp"))).toThrow(SsrfError);
  });

  it("rejects non-http schemes", () => {
    expect(() => assertAllowedUrl(new URL("file:///etc/passwd"))).toThrow(SsrfError);
    expect(() => assertAllowedUrl(new URL("gopher://example.com/"))).toThrow(SsrfError);
  });

  it("allows https", () => {
    expect(() => assertAllowedUrl(new URL("https://example.com/mcp"))).not.toThrow();
  });
});

describe("resolvePublicAddress", () => {
  beforeEach(() => mocks.lookup.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("rejects a hostname whose DNS resolves to loopback", async () => {
    mocks.lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(resolvePublicAddress("evil.example.com")).rejects.toThrow(SsrfError);
  });

  it("rejects a hostname that resolves to the metadata endpoint", async () => {
    mocks.lookup.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);
    await expect(resolvePublicAddress("metadata.example.com")).rejects.toThrow(/non-public/);
  });

  it("rejects when ANY record is private, even if another is public", async () => {
    mocks.lookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 }
    ]);
    await expect(resolvePublicAddress("split.example.com")).rejects.toThrow(SsrfError);
  });

  it("rejects an IP literal for a private address without touching DNS", async () => {
    await expect(resolvePublicAddress("127.0.0.1")).rejects.toThrow(SsrfError);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  // `new URL("https://[::1]/").hostname` is "[::1]", brackets included. If those
  // are not stripped, the literal check misses and the address gets handed to
  // DNS — which is not a check at all. Blocked-by-accident is not blocked.
  it("rejects a bracketed IPv6 loopback literal as an address, not via DNS", async () => {
    await expect(resolvePublicAddress("[::1]")).rejects.toThrow(/non-public address ::1/);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("rejects a bracketed IPv4-mapped loopback literal", async () => {
    await expect(resolvePublicAddress("[::ffff:127.0.0.1]")).rejects.toThrow(/non-public/);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("accepts a bracketed public IPv6 literal", async () => {
    await expect(resolvePublicAddress("[2606:4700:4700::1111]")).resolves.toEqual({
      address: "2606:4700:4700::1111",
      family: 6
    });
  });

  it("returns the pinned address for a public hostname", async () => {
    mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(resolvePublicAddress("example.com")).resolves.toEqual({
      address: "93.184.216.34",
      family: 4
    });
  });

  it("rejects a host that resolves to nothing", async () => {
    mocks.lookup.mockResolvedValue([]);
    await expect(resolvePublicAddress("void.example.com")).rejects.toThrow(SsrfError);
  });
});
