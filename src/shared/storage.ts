import { sanitizeSettings } from "../core/settings";
import type { ClosedTab, Settings } from "../core/types";

export const SYNC_KEYS = {
  settings: "settings",
} as const;

export const LOCAL_KEYS = {
  enabled: "enabled",
  closedTabs: "closedTabs",
  badgeCount: "badgeCount",
} as const;

/** chrome.storage.session is cleared when the browser restarts, which gives us the "reset on restart" behaviour for free. */
export const SESSION_KEYS = {
  /** Fallback last-activated timestamps keyed by tab id (string). */
  accessTimes: "accessTimes",
  /** Epoch ms when this browser session started; nothing counts as older than this. */
  sessionStartedAt: "sessionStartedAt",
} as const;

export async function loadSettings(): Promise<Settings> {
  const data = await chrome.storage.sync.get(SYNC_KEYS.settings);
  return sanitizeSettings(data[SYNC_KEYS.settings]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [SYNC_KEYS.settings]: sanitizeSettings(settings) });
}

export async function loadEnabled(): Promise<boolean> {
  const data = await chrome.storage.local.get(LOCAL_KEYS.enabled);
  const v = data[LOCAL_KEYS.enabled];
  return typeof v === "boolean" ? v : true;
}

export async function saveEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [LOCAL_KEYS.enabled]: enabled });
}

export async function loadClosedTabs(): Promise<ClosedTab[]> {
  const data = await chrome.storage.local.get(LOCAL_KEYS.closedTabs);
  const v = data[LOCAL_KEYS.closedTabs];
  return Array.isArray(v) ? (v as ClosedTab[]) : [];
}

export async function saveClosedTabs(list: ClosedTab[]): Promise<void> {
  await chrome.storage.local.set({ [LOCAL_KEYS.closedTabs]: list });
}

export async function loadBadgeCount(): Promise<number> {
  const data = await chrome.storage.local.get(LOCAL_KEYS.badgeCount);
  const v = data[LOCAL_KEYS.badgeCount];
  return typeof v === "number" ? v : 0;
}

export async function saveBadgeCount(count: number): Promise<void> {
  await chrome.storage.local.set({ [LOCAL_KEYS.badgeCount]: count });
}

export type AccessTimes = Record<string, number>;

export async function loadAccessTimes(): Promise<AccessTimes> {
  const data = await chrome.storage.session.get(SESSION_KEYS.accessTimes);
  const v = data[SESSION_KEYS.accessTimes];
  return v && typeof v === "object" ? (v as AccessTimes) : {};
}

export async function saveAccessTimes(times: AccessTimes): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEYS.accessTimes]: times });
}

export async function loadSessionStartedAt(): Promise<number | null> {
  const data = await chrome.storage.session.get(SESSION_KEYS.sessionStartedAt);
  const v = data[SESSION_KEYS.sessionStartedAt];
  return typeof v === "number" ? v : null;
}

export async function saveSessionStartedAt(ts: number): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEYS.sessionStartedAt]: ts });
}
