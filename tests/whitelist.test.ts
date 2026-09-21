import { describe, expect, it } from "vitest";
import { isWhitelisted, normalizePattern, parseWhitelist } from "../src/core/whitelist";

describe("normalizePattern", () => {
  it("lowercases and trims", () => {
    expect(normalizePattern("  Example.COM ")).toBe("example.com");
  });
  it("strips wildcard prefix", () => {
    expect(normalizePattern("*.example.com")).toBe("example.com");
  });
  it("accepts pasted URLs", () => {
    expect(normalizePattern("https://Foo.example.com:8443/path?q=1#x")).toBe("foo.example.com");
  });
  it("converts IDN hosts to punycode so they match URL.hostname", () => {
    expect(normalizePattern("日本語.jp")).toBe("xn--wgv71a119e.jp");
    expect(normalizePattern("*.日本語.jp")).toBe("xn--wgv71a119e.jp");
  });
  it("rejects hosts the URL parser cannot handle", () => {
    expect(normalizePattern("a b.com")).toBeNull();
  });
  it("ignores blank lines and comments", () => {
    expect(normalizePattern("")).toBeNull();
    expect(normalizePattern("   ")).toBeNull();
    expect(normalizePattern("# comment")).toBeNull();
  });
});

describe("parseWhitelist", () => {
  it("dedupes and drops junk", () => {
    expect(parseWhitelist("a.com\n*.a.com\n\n# x\nB.org\r\n")).toEqual(["a.com", "b.org"]);
  });
});

describe("isWhitelisted", () => {
  const wl = ["example.com", "internal.corp"];
  it("matches exact host", () => {
    expect(isWhitelisted("https://example.com/", wl)).toBe(true);
  });
  it("matches subdomains", () => {
    expect(isWhitelisted("https://deep.sub.example.com/x", wl)).toBe(true);
  });
  it("does not match suffix-similar hosts", () => {
    expect(isWhitelisted("https://notexample.com/", wl)).toBe(false);
    expect(isWhitelisted("https://example.com.evil.net/", wl)).toBe(false);
  });
  it("is case-insensitive", () => {
    expect(isWhitelisted("https://WWW.EXAMPLE.COM/", wl)).toBe(true);
  });
  it("matches IDN tabs against an IDN whitelist entry", () => {
    const list = parseWhitelist("日本語.jp");
    expect(isWhitelisted("https://日本語.jp/page", list)).toBe(true);
    expect(isWhitelisted("https://sub.日本語.jp/", list)).toBe(true);
  });
  it("handles invalid URLs and empty lists", () => {
    expect(isWhitelisted("not a url", wl)).toBe(false);
    expect(isWhitelisted("https://example.com/", [])).toBe(false);
  });
});
