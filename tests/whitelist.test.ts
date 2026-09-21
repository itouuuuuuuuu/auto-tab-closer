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
  it("handles invalid URLs and empty lists", () => {
    expect(isWhitelisted("not a url", wl)).toBe(false);
    expect(isWhitelisted("https://example.com/", [])).toBe(false);
  });
});
