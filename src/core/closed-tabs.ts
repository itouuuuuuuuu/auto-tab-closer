import { type ClosedTab, MAX_CLOSED_TABS } from "./types";

/** Prepend new entries, newest first, and cap the list. */
export function appendClosedTabs(
  existing: readonly ClosedTab[],
  added: readonly ClosedTab[],
  max: number = MAX_CLOSED_TABS,
): ClosedTab[] {
  return [...added, ...existing].slice(0, max);
}

/** Two entries are the same tab when both url and closedAt match. */
export function sameClosedTab(a: ClosedTab, b: ClosedTab): boolean {
  return a.url === b.url && a.closedAt === b.closedAt;
}

/** Remove the first entry identical to `target`; returns the list unchanged when absent. */
export function removeClosedTab(list: readonly ClosedTab[], target: ClosedTab): ClosedTab[] {
  const index = list.findIndex((e) => sameClosedTab(e, target));
  return index === -1 ? [...list] : list.filter((_, i) => i !== index);
}
