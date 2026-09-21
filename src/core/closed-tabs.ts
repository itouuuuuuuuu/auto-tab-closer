import { type ClosedTab, MAX_CLOSED_TABS } from "./types";

/** Prepend new entries, newest first, and cap the list. */
export function appendClosedTabs(
  existing: readonly ClosedTab[],
  added: readonly ClosedTab[],
  max: number = MAX_CLOSED_TABS,
): ClosedTab[] {
  return [...added, ...existing].slice(0, max);
}

export function removeClosedTab(list: readonly ClosedTab[], index: number): ClosedTab[] {
  return list.filter((_, i) => i !== index);
}
