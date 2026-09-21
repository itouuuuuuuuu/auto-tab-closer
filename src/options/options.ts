import { clampThresholdHours } from "../core/settings";
import { MAX_THRESHOLD_HOURS, MIN_THRESHOLD_HOURS } from "../core/types";
import { parseWhitelist } from "../core/whitelist";
import { localizeDocument } from "../shared/i18n";
import { loadSettings, saveSettings } from "../shared/storage";

const form = document.getElementById("form") as HTMLFormElement;
const thresholdInput = document.getElementById("threshold") as HTMLInputElement;
const whitelistInput = document.getElementById("whitelist") as HTMLTextAreaElement;
const excludeGroupedInput = document.getElementById("excludeGrouped") as HTMLInputElement;
const savedEl = document.getElementById("saved") as HTMLElement;

let savedTimer: ReturnType<typeof setTimeout> | undefined;

async function init(): Promise<void> {
  localizeDocument();
  thresholdInput.min = String(MIN_THRESHOLD_HOURS);
  thresholdInput.max = String(MAX_THRESHOLD_HOURS);

  const settings = await loadSettings();
  thresholdInput.value = String(settings.thresholdHours);
  whitelistInput.value = settings.whitelist.join("\n");
  excludeGroupedInput.checked = settings.excludeGrouped;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const thresholdHours = clampThresholdHours(thresholdInput.valueAsNumber);
  const whitelist = parseWhitelist(whitelistInput.value);
  await saveSettings({ thresholdHours, whitelist, excludeGrouped: excludeGroupedInput.checked });

  // Reflect normalisation (clamping, whitelist cleanup) back into the form.
  thresholdInput.value = String(thresholdHours);
  whitelistInput.value = whitelist.join("\n");

  savedEl.hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => {
    savedEl.hidden = true;
  }, 2000);
});

void init();
