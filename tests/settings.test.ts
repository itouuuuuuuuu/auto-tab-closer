import { describe, expect, it } from "vitest";
import { appendClosedTabs, removeClosedTab } from "../src/core/closed-tabs";
import { clampThresholdHours, sanitizeSettings } from "../src/core/settings";
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
      }),
    ).toEqual({ thresholdHours: 5, whitelist: ["a.com"], excludeGrouped: false });
  });
});

describe("closed tabs list", () => {
  const e = (n: number) => ({ url: `https://x/${n}`, title: String(n), closedAt: n });
  it("prepends newest first and caps", () => {
    const list = appendClosedTabs([e(1), e(2)], [e(3), e(4)], 3);
    expect(list.map((x) => x.closedAt)).toEqual([3, 4, 1]);
  });
  it("removes by index", () => {
    expect(removeClosedTab([e(1), e(2), e(3)], 1).map((x) => x.closedAt)).toEqual([1, 3]);
  });
});
