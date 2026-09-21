import { appendClosedTabs } from "../core/closed-tabs";
import { selectTabsToClose } from "../core/select-tabs";
import { CHECK_INTERVAL_MINUTES, type ClosedTab, type TabSnapshot } from "../core/types";
import type { CheckNowResponse, Message, NextCheckResponse } from "../shared/messages";
import {
  LOCAL_KEYS,
  loadAccessTimes,
  loadBadgeCount,
  loadClosedTabs,
  loadEnabled,
  loadSessionStartedAt,
  loadSettings,
  saveAccessTimes,
  saveBadgeCount,
  saveClosedTabs,
  saveSessionStartedAt,
} from "../shared/storage";

const ALARM_NAME = "auto-tab-closer:check";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  await startSession();
});

chrome.runtime.onStartup.addListener(async () => {
  await startSession();
});

/** Mark "now" as the floor for every tab and (re)arm the alarm. */
async function startSession(): Promise<void> {
  const now = Date.now();
  await saveSessionStartedAt(now);
  const tabs = await chrome.tabs.query({});
  const times: Record<string, number> = {};
  for (const t of tabs) {
    if (t.id !== undefined) times[String(t.id)] = now;
  }
  await saveAccessTimes(times);
  await syncAlarm();
  await refreshBadge();
}

async function syncAlarm(): Promise<void> {
  const enabled = await loadEnabled();
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (enabled && !existing) {
    await chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: CHECK_INTERVAL_MINUTES,
      periodInMinutes: CHECK_INTERVAL_MINUTES,
    });
  } else if (!enabled && existing) {
    await chrome.alarms.clear(ALARM_NAME);
  }
}

// ---------------------------------------------------------------------------
// Access-time tracking (fallback for tabs without lastAccessed)
// ---------------------------------------------------------------------------

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const times = await loadAccessTimes();
  times[String(tabId)] = Date.now();
  await saveAccessTimes(times);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const times = await loadAccessTimes();
  if (String(tabId) in times) {
    delete times[String(tabId)];
    await saveAccessTimes(times);
  }
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.id === undefined) return;
  const times = await loadAccessTimes();
  times[String(tab.id)] = Date.now();
  await saveAccessTimes(times);
});

// ---------------------------------------------------------------------------
// Periodic check
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  if (!(await loadEnabled())) return;
  await runCheck();
});

async function runCheck(): Promise<number> {
  const now = Date.now();
  const [settings, rawTabs, accessTimes, sessionStartedAt] = await Promise.all([
    loadSettings(),
    chrome.tabs.query({}),
    loadAccessTimes(),
    loadSessionStartedAt(),
  ]);

  // If the service worker was evicted and storage.session is empty (should not
  // happen, but be defensive) treat this moment as the session start.
  const floor = sessionStartedAt ?? now;
  if (sessionStartedAt === null) await saveSessionStartedAt(now);

  const tabs = rawTabs.flatMap((t) => {
    const snap = toSnapshot(t, accessTimes, floor);
    return snap ? [snap] : [];
  });

  const toClose = selectTabsToClose({ tabs, settings, now });
  if (toClose.length === 0) return 0;

  const ids = toClose.map((t) => t.id);
  // Close in one call; if any id is already gone Chrome rejects the whole call,
  // so fall back to one-by-one on failure.
  let closedTabs: TabSnapshot[] = [];
  try {
    await chrome.tabs.remove(ids);
    closedTabs = toClose;
  } catch {
    for (const t of toClose) {
      try {
        await chrome.tabs.remove(t.id);
        closedTabs.push(t);
      } catch {
        // Tab vanished between query and remove; ignore.
      }
    }
  }
  if (closedTabs.length === 0) return 0;

  const entries: ClosedTab[] = closedTabs.map((t) => {
    const e: ClosedTab = { url: t.url, title: t.title || t.url, closedAt: now };
    if (t.favIconUrl) e.favIconUrl = t.favIconUrl;
    return e;
  });
  const existing = await loadClosedTabs();
  await saveClosedTabs(appendClosedTabs(existing, entries));

  const badge = await loadBadgeCount();
  await saveBadgeCount(badge + closedTabs.length);
  await refreshBadge();

  return closedTabs.length;
}

function toSnapshot(
  t: chrome.tabs.Tab,
  accessTimes: Record<string, number>,
  floor: number,
): TabSnapshot | null {
  if (t.id === undefined || t.windowId === undefined) return null;
  const fromApi = typeof t.lastAccessed === "number" ? t.lastAccessed : undefined;
  const fromTracking = accessTimes[String(t.id)];
  const raw = fromApi ?? fromTracking;
  const lastAccessed = raw === undefined ? undefined : Math.max(raw, floor);
  return {
    id: t.id,
    windowId: t.windowId,
    url: t.url ?? t.pendingUrl ?? "",
    title: t.title ?? "",
    ...(t.favIconUrl ? { favIconUrl: t.favIconUrl } : {}),
    pinned: t.pinned,
    active: t.active,
    audible: t.audible ?? false,
    groupId: t.groupId ?? -1,
    lastAccessed,
  };
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

async function refreshBadge(): Promise<void> {
  const count = await loadBadgeCount();
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  if (count > 0) {
    await chrome.action.setBadgeBackgroundColor({ color: "#4F6DF5" });
  }
}

// ---------------------------------------------------------------------------
// Messaging with popup
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err: unknown) => {
      console.error("[auto-tab-closer] message failed", err);
      sendResponse(undefined);
    });
  return true; // keep the channel open for the async response
});

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case "checkNow": {
      const closed = await runCheck();
      const res: CheckNowResponse = { closed };
      return res;
    }
    case "getNextCheck": {
      const alarm = await chrome.alarms.get(ALARM_NAME);
      const res: NextCheckResponse = { scheduledTime: alarm ? alarm.scheduledTime : null };
      return res;
    }
    case "clearBadge": {
      await saveBadgeCount(0);
      await refreshBadge();
      return undefined;
    }
  }
}

// Re-arm / clear the alarm whenever the popup flips the toggle.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && LOCAL_KEYS.enabled in changes) {
    void syncAlarm();
  }
});

// Service workers can be restarted without onStartup firing; make sure the
// alarm exists whenever this script is evaluated.
void syncAlarm();
