import { appendClosedTabs, removeClosedTab } from "../core/closed-tabs";
import { selectTabsToClose } from "../core/select-tabs";
import type { ClosedTab, TabSnapshot } from "../core/types";
import type {
  CheckNowResponse,
  ClosedTabsResponse,
  Message,
  NextCheckResponse,
} from "../shared/messages";
import {
  LOCAL_KEYS,
  loadAccessTimes,
  loadClosedTabs,
  loadEnabled,
  loadSessionStartedAt,
  loadSettings,
  SYNC_KEYS,
  saveAccessTimes,
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
}

/** Create, re-create (when the interval changed) or clear the alarm to match settings. */
async function syncAlarm(): Promise<void> {
  const [enabled, settings, existing] = await Promise.all([
    loadEnabled(),
    loadSettings(),
    chrome.alarms.get(ALARM_NAME),
  ]);
  const interval = settings.checkIntervalMinutes;
  if (enabled) {
    if (existing?.periodInMinutes === interval) return;
    // create() replaces an existing alarm with the same name.
    await chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: interval,
      periodInMinutes: interval,
    });
  } else if (existing) {
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

  // Remove one tab at a time. chrome.tabs.remove(ids[]) is not atomic: it
  // closes tabs in order and stops at the first failure, so a batch call could
  // close tabs without telling us which ones succeeded.
  const closedTabs: TabSnapshot[] = [];
  for (const t of toClose) {
    try {
      await chrome.tabs.remove(t.id);
      closedTabs.push(t);
    } catch {
      // Tab vanished between query and remove; ignore.
    }
  }
  if (closedTabs.length === 0) return 0;

  const entries: ClosedTab[] = closedTabs.map((t) => ({
    url: t.url,
    title: t.title || t.url,
    closedAt: now,
  }));
  await updateClosedTabs((list) => appendClosedTabs(list, entries));

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
    pinned: t.pinned,
    active: t.active,
    audible: t.audible ?? false,
    groupId: t.groupId ?? -1,
    lastAccessed,
  };
}

// ---------------------------------------------------------------------------
// Recently-closed list: every write goes through one queue
// ---------------------------------------------------------------------------

// The service worker is the only writer of `closedTabs`; the popup asks it via
// messages. Chaining every read-modify-write onto this promise serialises
// appends (runCheck), single removals (restore) and clears, so no writer can
// overwrite another's result.
let closedTabsQueue: Promise<unknown> = Promise.resolve();

function updateClosedTabs(mutate: (list: ClosedTab[]) => ClosedTab[]): Promise<ClosedTab[]> {
  const run = closedTabsQueue.then(async () => {
    const next = mutate(await loadClosedTabs());
    await saveClosedTabs(next);
    return next;
  });
  // Keep the chain alive even if one step throws.
  closedTabsQueue = run.catch(() => undefined);
  return run;
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
    case "restoreClosedTab": {
      await chrome.tabs.create({ url: message.tab.url, active: false });
      const closedTabs = await updateClosedTabs((list) => removeClosedTab(list, message.tab));
      const res: ClosedTabsResponse = { closedTabs };
      return res;
    }
    case "clearClosedTabs": {
      const closedTabs = await updateClosedTabs(() => []);
      const res: ClosedTabsResponse = { closedTabs };
      return res;
    }
  }
}

// Re-arm / clear the alarm whenever the popup flips the toggle or the check
// interval changes in the options page.
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    (area === "local" && LOCAL_KEYS.enabled in changes) ||
    (area === "sync" && SYNC_KEYS.settings in changes)
  ) {
    void syncAlarm();
  }
});

// Service workers can be restarted without onStartup firing; make sure the
// alarm exists whenever this script is evaluated.
void syncAlarm();
