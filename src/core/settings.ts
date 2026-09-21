import { DEFAULT_SETTINGS, MAX_THRESHOLD_HOURS, MIN_THRESHOLD_HOURS, type Settings } from "./types";

export function clampThresholdHours(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.thresholdHours;
  const int = Math.round(n);
  return Math.min(MAX_THRESHOLD_HOURS, Math.max(MIN_THRESHOLD_HOURS, int));
}

/** Coerce arbitrary stored data into a valid Settings object. */
export function sanitizeSettings(raw: unknown): Settings {
  const obj = (raw ?? {}) as Partial<Record<keyof Settings, unknown>>;
  const whitelist = Array.isArray(obj.whitelist)
    ? obj.whitelist.filter((s): s is string => typeof s === "string")
    : DEFAULT_SETTINGS.whitelist;
  return {
    thresholdHours: clampThresholdHours(obj.thresholdHours),
    whitelist,
    excludeGrouped:
      typeof obj.excludeGrouped === "boolean"
        ? obj.excludeGrouped
        : DEFAULT_SETTINGS.excludeGrouped,
  };
}
