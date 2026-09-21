import { DEFAULT_SETTINGS, type Settings, type TabSnapshot } from "../src/core/types";

export const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
export const HOUR = 60 * 60 * 1000;

let nextId = 1;

export function tab(overrides: Partial<TabSnapshot> = {}): TabSnapshot {
  const id = overrides.id ?? nextId++;
  return {
    id,
    windowId: 1,
    url: `https://example.org/${id}`,
    title: `Tab ${id}`,
    pinned: false,
    active: false,
    audible: false,
    groupId: -1,
    lastAccessed: NOW - 24 * HOUR, // stale by default
    ...overrides,
  };
}

export function settings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}
