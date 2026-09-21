/** Subset of chrome.tabs.Tab that the selection logic depends on. */
export interface TabSnapshot {
  id: number;
  windowId: number;
  url: string;
  title: string;
  favIconUrl?: string;
  pinned: boolean;
  active: boolean;
  audible: boolean;
  /** chrome.tabGroups.TAB_GROUP_ID_NONE (-1) when not grouped. */
  groupId: number;
  /** Epoch ms of last activation, or undefined when unknown. */
  lastAccessed: number | undefined;
}

export interface Settings {
  /** Inactivity threshold in hours (integer, 1..720). */
  thresholdHours: number;
  /** One hostname pattern per entry, e.g. "example.com" or "*.example.com". */
  whitelist: string[];
  /** When true, tabs that belong to a tab group are never closed. */
  excludeGrouped: boolean;
}

export interface ClosedTab {
  url: string;
  title: string;
  favIconUrl?: string;
  closedAt: number;
}

export const TAB_GROUP_ID_NONE = -1;
export const MIN_THRESHOLD_HOURS = 1;
export const MAX_THRESHOLD_HOURS = 720;
export const DEFAULT_THRESHOLD_HOURS = 12;
export const MAX_CLOSED_TABS = 100;
export const CHECK_INTERVAL_MINUTES = 5;

export const DEFAULT_SETTINGS: Settings = {
  thresholdHours: DEFAULT_THRESHOLD_HOURS,
  whitelist: [],
  excludeGrouped: false,
};

export const HOUR_MS = 60 * 60 * 1000;
