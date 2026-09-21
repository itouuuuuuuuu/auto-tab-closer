import { describe, expect, it } from "vitest";
import { selectTabsToClose } from "../src/core/select-tabs";
import { HOUR, NOW, settings, tab } from "./helpers";

const ids = (tabs: { id: number }[]) => tabs.map((t) => t.id).sort((a, b) => a - b);

describe("selectTabsToClose", () => {
  it("closes tabs older than the threshold and keeps fresh ones", () => {
    const stale = tab({ id: 1, lastAccessed: NOW - 13 * HOUR });
    const fresh = tab({ id: 2, lastAccessed: NOW - 11 * HOUR });
    const anchor = tab({ id: 3, active: true, lastAccessed: NOW });
    const result = selectTabsToClose({
      tabs: [stale, fresh, anchor],
      settings: settings(),
      now: NOW,
    });
    expect(ids(result)).toEqual([1]);
  });

  it("treats exactly-at-threshold as stale", () => {
    const edge = tab({ id: 1, lastAccessed: NOW - 12 * HOUR });
    const anchor = tab({ id: 2, active: true });
    expect(
      ids(selectTabsToClose({ tabs: [edge, anchor], settings: settings(), now: NOW })),
    ).toEqual([1]);
  });

  it("respects a custom threshold", () => {
    const t1 = tab({ id: 1, lastAccessed: NOW - 2 * HOUR });
    const anchor = tab({ id: 2, active: true });
    expect(
      ids(
        selectTabsToClose({
          tabs: [t1, anchor],
          settings: settings({ thresholdHours: 1 }),
          now: NOW,
        }),
      ),
    ).toEqual([1]);
    expect(
      ids(
        selectTabsToClose({
          tabs: [t1, anchor],
          settings: settings({ thresholdHours: 3 }),
          now: NOW,
        }),
      ),
    ).toEqual([]);
  });

  it("never closes pinned tabs", () => {
    const pinned = tab({ id: 1, pinned: true });
    const anchor = tab({ id: 2, active: true });
    expect(selectTabsToClose({ tabs: [pinned, anchor], settings: settings(), now: NOW })).toEqual(
      [],
    );
  });

  it("never closes the active tab of a window even if stale", () => {
    const active = tab({ id: 1, active: true, lastAccessed: NOW - 100 * HOUR });
    const other = tab({ id: 2 });
    expect(
      ids(selectTabsToClose({ tabs: [active, other], settings: settings(), now: NOW })),
    ).toEqual([2]);
  });

  it("never closes tabs playing audio", () => {
    const audible = tab({ id: 1, audible: true });
    const anchor = tab({ id: 2, active: true });
    expect(selectTabsToClose({ tabs: [audible, anchor], settings: settings(), now: NOW })).toEqual(
      [],
    );
  });

  it("never empties a window", () => {
    // Window 1: single stale, non-active tab (e.g. window in background).
    const lonely = tab({ id: 1, windowId: 1 });
    // Window 2: two stale tabs -> may close only one.
    const a = tab({ id: 2, windowId: 2 });
    const b = tab({ id: 3, windowId: 2 });
    const result = selectTabsToClose({ tabs: [lonely, a, b], settings: settings(), now: NOW });
    expect(result).toHaveLength(1);
    expect(result[0]?.windowId).toBe(2);
  });

  it("keeps grouped tabs only when excludeGrouped is on", () => {
    const grouped = tab({ id: 1, groupId: 42 });
    const anchor = tab({ id: 2, active: true });
    expect(
      ids(
        selectTabsToClose({
          tabs: [grouped, anchor],
          settings: settings({ excludeGrouped: true }),
          now: NOW,
        }),
      ),
    ).toEqual([]);
    expect(
      ids(
        selectTabsToClose({
          tabs: [grouped, anchor],
          settings: settings({ excludeGrouped: false }),
          now: NOW,
        }),
      ),
    ).toEqual([1]);
  });

  it("keeps whitelisted hosts including subdomains", () => {
    const wl = tab({ id: 1, url: "https://app.slack.com/client" });
    const other = tab({ id: 2, url: "https://news.ycombinator.com/" });
    const anchor = tab({ id: 3, active: true });
    const result = selectTabsToClose({
      tabs: [wl, other, anchor],
      settings: settings({ whitelist: ["slack.com"] }),
      now: NOW,
    });
    expect(ids(result)).toEqual([2]);
  });

  it("does not close tabs whose lastAccessed is unknown", () => {
    const unknown = tab({ id: 1, lastAccessed: undefined });
    const anchor = tab({ id: 2, active: true });
    expect(selectTabsToClose({ tabs: [unknown, anchor], settings: settings(), now: NOW })).toEqual(
      [],
    );
  });

  it("returns nothing for an empty tab list", () => {
    expect(selectTabsToClose({ tabs: [], settings: settings(), now: NOW })).toEqual([]);
  });
});
