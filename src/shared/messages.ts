import type { ClosedTab } from "../core/types";

/** Runtime messages between popup and background. */
export type Message =
  | { type: "checkNow" }
  | { type: "getNextCheck" }
  /** Open the tab again and drop it from the recently-closed list. */
  | { type: "restoreClosedTab"; tab: ClosedTab }
  | { type: "clearClosedTabs" };

export interface CheckNowResponse {
  closed: number;
}

export interface NextCheckResponse {
  /** Epoch ms of the next scheduled check, or null when paused. */
  scheduledTime: number | null;
}

export interface ClosedTabsResponse {
  closedTabs: ClosedTab[];
}

export function sendMessage<T>(msg: Message): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}
