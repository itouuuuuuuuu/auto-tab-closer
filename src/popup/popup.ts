import type { ClosedTab } from "../core/types";
import { localizeDocument, t } from "../shared/i18n";
import {
  type CheckNowResponse,
  type ClosedTabsResponse,
  type NextCheckResponse,
  sendMessage,
} from "../shared/messages";
import {
  LOCAL_KEYS,
  loadClosedTabs,
  loadEnabled,
  loadSettings,
  saveEnabled,
} from "../shared/storage";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const enabledInput = $<HTMLInputElement>("enabled");
const enabledLabel = $("enabledLabel");
const thresholdEl = $("threshold");
const nextCheckEl = $("nextCheck");
const checkNowBtn = $<HTMLButtonElement>("checkNow");
const checkResultEl = $("checkResult");
const clearAllBtn = $<HTMLButtonElement>("clearAll");
const closedEmptyEl = $("closedEmpty");
const closedListEl = $<HTMLUListElement>("closedList");
const openOptionsBtn = $<HTMLButtonElement>("openOptions");

let closedTabs: ClosedTab[] = [];
let restoring = false;

/**
 * Favicon via Chrome's own cache (chrome-extension://<id>/_favicon/), which
 * never hits the network. Requires the "favicon" permission.
 */
function faviconUrl(pageUrl: string): string {
  const u = new URL(chrome.runtime.getURL("/_favicon/"));
  u.searchParams.set("pageUrl", pageUrl);
  u.searchParams.set("size", "16");
  return u.toString();
}

async function init(): Promise<void> {
  localizeDocument();

  const [enabled, settings] = await Promise.all([loadEnabled(), loadSettings()]);
  enabledInput.checked = enabled;
  renderEnabled(enabled);
  thresholdEl.textContent = t("popupThreshold", String(settings.thresholdHours));

  await Promise.all([renderNextCheck(), refreshClosedTabs()]);
  // Opening the popup acknowledges the badge.
  void sendMessage<undefined>({ type: "clearBadge" });
}

function renderEnabled(enabled: boolean): void {
  enabledLabel.textContent = t(enabled ? "popupEnabled" : "popupPaused");
}

async function renderNextCheck(): Promise<void> {
  const res = await sendMessage<NextCheckResponse | undefined>({ type: "getNextCheck" });
  const scheduled = res?.scheduledTime ?? null;
  if (scheduled === null) {
    nextCheckEl.textContent = t("popupNextCheckPaused");
    return;
  }
  const minutes = Math.max(0, Math.ceil((scheduled - Date.now()) / 60_000));
  nextCheckEl.textContent = t("popupNextCheck", String(minutes));
}

async function refreshClosedTabs(): Promise<void> {
  closedTabs = await loadClosedTabs();
  renderClosedTabs();
}

function renderClosedTabs(): void {
  closedListEl.replaceChildren();
  const hasItems = closedTabs.length > 0;
  closedEmptyEl.hidden = hasItems;
  clearAllBtn.hidden = !hasItems;

  for (const tab of closedTabs) {
    const li = document.createElement("li");

    const img = document.createElement("img");
    img.src = faviconUrl(tab.url);
    img.alt = "";
    img.addEventListener("error", () => {
      img.hidden = true;
    });

    const text = document.createElement("div");
    text.className = "text";
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = tab.title;
    title.title = tab.title;
    const url = document.createElement("span");
    url.className = "url muted";
    url.textContent = tab.url;
    url.title = tab.url;
    text.append(title, url);

    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "link";
    restore.textContent = t("popupRestore");
    restore.disabled = restoring;
    restore.addEventListener("click", () => void restoreTab(tab));

    li.append(img, text, restore);
    closedListEl.append(li);
  }
}

async function restoreTab(tab: ClosedTab): Promise<void> {
  // Ignore a second click before the first restore finishes.
  if (restoring) return;
  restoring = true;
  renderClosedTabs();
  try {
    // The background owns the list and serialises all writes to it.
    const res = await sendMessage<ClosedTabsResponse | undefined>({
      type: "restoreClosedTab",
      tab,
    });
    closedTabs = res?.closedTabs ?? (await loadClosedTabs());
  } finally {
    restoring = false;
    renderClosedTabs();
  }
}

// Keep the list in sync when the background closes tabs while the popup is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && LOCAL_KEYS.closedTabs in changes && !restoring) {
    void refreshClosedTabs();
  }
});

enabledInput.addEventListener("change", async () => {
  const enabled = enabledInput.checked;
  await saveEnabled(enabled);
  renderEnabled(enabled);
  // Give the background a moment to (re)arm the alarm before reading it back.
  setTimeout(() => void renderNextCheck(), 150);
});

checkNowBtn.addEventListener("click", async () => {
  checkNowBtn.disabled = true;
  try {
    const res = await sendMessage<CheckNowResponse | undefined>({ type: "checkNow" });
    checkResultEl.textContent = t("popupChecked", String(res?.closed ?? 0));
    checkResultEl.hidden = false;
    await refreshClosedTabs();
    void sendMessage<undefined>({ type: "clearBadge" });
  } finally {
    checkNowBtn.disabled = false;
  }
});

clearAllBtn.addEventListener("click", async () => {
  clearAllBtn.disabled = true;
  try {
    const res = await sendMessage<ClosedTabsResponse | undefined>({ type: "clearClosedTabs" });
    closedTabs = res?.closedTabs ?? (await loadClosedTabs());
    renderClosedTabs();
  } finally {
    clearAllBtn.disabled = false;
  }
});

openOptionsBtn.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

void init();
