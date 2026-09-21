import { HOUR_MS, type Settings, TAB_GROUP_ID_NONE, type TabSnapshot } from "./types";
import { isWhitelisted } from "./whitelist";

export interface SelectionInput {
  tabs: readonly TabSnapshot[];
  settings: Settings;
  /** Current time, epoch ms. */
  now: number;
}

/**
 * Pure function: decides which tabs should be closed right now.
 *
 * A tab is closed only when ALL of the following hold:
 * - it is not pinned
 * - it is not the active tab of its window
 * - it is not playing audio
 * - it is not the last remaining tab of its window
 * - it is not grouped (when `excludeGrouped` is on)
 * - its hostname is not whitelisted
 * - its lastAccessed is known and older than the threshold
 */
export function selectTabsToClose({ tabs, settings, now }: SelectionInput): TabSnapshot[] {
  const thresholdMs = settings.thresholdHours * HOUR_MS;
  const cutoff = now - thresholdMs;

  const tabsPerWindow = new Map<number, number>();
  for (const t of tabs) {
    tabsPerWindow.set(t.windowId, (tabsPerWindow.get(t.windowId) ?? 0) + 1);
  }

  const result: TabSnapshot[] = [];
  // Track how many tabs remain per window so we never empty a window.
  const remaining = new Map(tabsPerWindow);

  for (const tab of tabs) {
    if (!isStale(tab, cutoff)) continue;
    if (isProtected(tab, settings)) continue;
    const left = remaining.get(tab.windowId) ?? 0;
    if (left <= 1) continue;
    remaining.set(tab.windowId, left - 1);
    result.push(tab);
  }
  return result;
}

export function isStale(tab: TabSnapshot, cutoff: number): boolean {
  if (tab.lastAccessed === undefined || !Number.isFinite(tab.lastAccessed)) return false;
  return tab.lastAccessed <= cutoff;
}

export function isProtected(tab: TabSnapshot, settings: Settings): boolean {
  if (tab.pinned) return true;
  if (tab.active) return true;
  if (tab.audible) return true;
  if (settings.excludeGrouped && tab.groupId !== TAB_GROUP_ID_NONE) return true;
  if (isWhitelisted(tab.url, settings.whitelist)) return true;
  return false;
}
