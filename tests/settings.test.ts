import { describe, expect, it } from "vitest";
import { appendClosedTabs, removeClosedTab } from "../src/core/closed-tabs";
import {
  clampCheckIntervalMinutes,
  clampThresholdHours,
  sanitizeSettings,
} from "../src/core/settings";
import { DEFAULT_SETTINGS } from "../src/core/types";

describe("clampThresholdHours", () => {
  it("clamps into [1, 720] and rounds", () => {
    expect(clampThresholdHours(0)).toBe(1);
    expect(clampThresholdHours(-5)).toBe(1);
    expect(clampThresholdHours(1000)).toBe(720);
    expect(clampThresholdHours(12.4)).toBe(12);
    expect(clampThresholdHours("36")).toBe(36);
  });
  it("falls back to default on garbage", () => {
    expect(clampThresholdHours(Number.NaN)).toBe(DEFAULT_SETTINGS.thresholdHours);
    expect(clampThresholdHours("abc")).toBe(DEFAULT_SETTINGS.thresholdHours);
    expect(clampThresholdHours(undefined)).toBe(DEFAULT_SETTINGS.thresholdHours);
  });
});

describe("clampCheckIntervalMinutes", () => {
  it("clamps into [1, 60] and rounds", () => {
    expect(clampCheckIntervalMinutes(0)).toBe(1);
    expect(clampCheckIntervalMinutes(61)).toBe(60);
    expect(clampCheckIntervalMinutes(7.6)).toBe(8);
    expect(clampCheckIntervalMinutes("15")).toBe(15);
  });
  it("falls back to the default of 10 on garbage", () => {
    expect(clampCheckIntervalMinutes(Number.NaN)).toBe(10);
    expect(clampCheckIntervalMinutes(undefined)).toBe(10);
  });
});

describe("sanitizeSettings", () => {
  it("returns defaults for undefined", () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
  it("drops non-string whitelist entries and coerces types", () => {
    expect(
      sanitizeSettings({
        thresholdHours: "5",
        whitelist: ["a.com", 3, null],
        excludeGrouped: "yes",
        checkIntervalMinutes: "30",
      }),
    ).toEqual({
      thresholdHours: 5,
      whitelist: ["a.com"],
      excludeGrouped: false,
      checkIntervalMinutes: 30,
    });
  });
});

describe("closed tabs list", () => {
  const e = (n: number) => ({ url: `https://x/${n}`, title: String(n), closedAt: n });
  it("prepends newest first and caps", () => {
    const list = appendClosedTabs([e(1), e(2)], [e(3), e(4)], 3);
    expect(list.map((x) => x.closedAt)).toEqual([3, 4, 1]);
  });
  it("removes by identity (url + closedAt)", () => {
    expect(removeClosedTab([e(1), e(2), e(3)], e(2)).map((x) => x.closedAt)).toEqual([1, 3]);
  });
  it("is a no-op when the entry is gone", () => {
    expect(removeClosedTab([e(1), e(3)], e(2)).map((x) => x.closedAt)).toEqual([1, 3]);
  });
  it("removes only the first of identical entries", () => {
    expect(removeClosedTab([e(1), e(1)], e(1))).toHaveLength(1);
  });
});
