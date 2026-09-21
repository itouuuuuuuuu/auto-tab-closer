/** Runtime messages between popup and background. */
export type Message = { type: "checkNow" } | { type: "getNextCheck" } | { type: "clearBadge" };

export interface CheckNowResponse {
  closed: number;
}

export interface NextCheckResponse {
  /** Epoch ms of the next scheduled check, or null when paused. */
  scheduledTime: number | null;
}

export function sendMessage<T>(msg: Message): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}
