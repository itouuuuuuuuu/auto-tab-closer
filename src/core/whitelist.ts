/**
 * Whitelist matching.
 *
 * Each pattern is a hostname. A bare hostname ("example.com") matches itself and
 * every subdomain ("www.example.com"). The explicit "*.example.com" form is
 * accepted too and behaves identically. Matching is case-insensitive.
 */

export function normalizePattern(raw: string): string | null {
  let p = raw.trim().toLowerCase();
  if (p === "" || p.startsWith("#")) return null;
  // Tolerate people pasting URLs.
  p = p.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  p = p.split(/[/?#]/, 1)[0] ?? "";
  p = p.replace(/:\d+$/, "");
  if (p.startsWith("*.")) p = p.slice(2);
  p = p.replace(/^\.+|\.+$/g, "");
  if (p === "") return null;
  // Run it through the URL parser so the stored form matches what
  // `new URL(tabUrl).hostname` yields at match time (IDN -> punycode, etc.).
  try {
    const host = new URL(`http://${p}/`).hostname;
    return host === "" ? null : host;
  } catch {
    return null;
  }
}

export function parseWhitelist(text: string): string[] {
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const p = normalizePattern(line);
    if (p) seen.add(p);
  }
  return [...seen];
}

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function hostMatches(hostname: string, pattern: string): boolean {
  return hostname === pattern || hostname.endsWith(`.${pattern}`);
}

export function isWhitelisted(url: string, whitelist: readonly string[]): boolean {
  if (whitelist.length === 0) return false;
  const host = hostnameOf(url);
  if (!host) return false;
  return whitelist.some((p) => hostMatches(host, p));
}
