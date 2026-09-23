import {
  DEFAULT_SETTINGS,
  MAX_CHECK_INTERVAL_MINUTES,
  MAX_THRESHOLD_HOURS,
  MIN_CHECK_INTERVAL_MINUTES,
  MIN_THRESHOLD_HOURS,
  type Settings,
} from "./types";

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function clampThresholdHours(value: unknown): number {
  return clampInt(value, MIN_THRESHOLD_HOURS, MAX_THRESHOLD_HOURS, DEFAULT_SETTINGS.thresholdHours);
}

export function clampCheckIntervalMinutes(value: unknown): number {
  return clampInt(
    value,
    MIN_CHECK_INTERVAL_MINUTES,
    MAX_CHECK_INTERVAL_MINUTES,
    DEFAULT_SETTINGS.checkIntervalMinutes,
  );
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
    checkIntervalMinutes: clampCheckIntervalMinutes(obj.checkIntervalMinutes),
  };
}
