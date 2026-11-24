import { describe, expect, it, vi } from "vitest";
import type { Classification } from "@kids/shared";
import { DEFAULT_RULES, decide, decideFromClassification, decideWithoutAI, normalize, type DecideInput, type Rules } from "./decide";

const meta = {
  videoId: "abcdefghijk",
  channelId: "UC_channel",
  title: "שיר ילדים על חיות",
  description: "שיר מצחיק",
  tags: ["ילדים", "שירים"],
  embeddable: true,
};

function input(rules: Partial<Rules> = {}, extra: Partial<DecideInput> = {}): DecideInput {
  return { rules: { ...DEFAULT_RULES, ...rules }, meta, override: null, inActiveList: false, ...extra };
}

const safe: Classification = { topics: ["none"], ageRating: 3, confidence: 0.95, language: "he" };

describe("rule 1: parent override", () => {
  it("allows when the parent approved, even on a blocked channel", () => {
    const d = decideWithoutAI(input({ blockedChannels: ["UC_channel"] }, { override: { allowed: true } }));
    expect(d).toEqual({ result: "ALLOWED", reason: "override_allowed" });
  });
  it("blocks when the parent blocked, even if it is in a list", () => {
    const d = decideWithoutAI(input({ listOnly: true }, { override: { allowed: false }, inActiveList: true }));
    expect(d).toEqual({ result: "BLOCKED", reason: "override_blocked" });
  });
});

describe("embeddable", () => {
  it("blocks videos that cannot be embedded", () => {
    const d = decideWithoutAI({ ...input(), meta: { ...meta, embeddable: false } });
    expect(d?.reason).toBe("not_embeddable");
  });
});

describe("rule 2: list-only mode", () => {
  it("allows a video from an active list", () => {
    expect(decideWithoutAI(input({ listOnly: true }, { inActiveList: true }))?.result).toBe("ALLOWED");
  });
  it("asks for approval for anything else, without checking channels", () => {
    const d = decideWithoutAI(input({ listOnly: true, allowedChannels: ["UC_channel"] }));
    expect(d).toEqual({ result: "NEEDS_APPROVAL", reason: "not_in_list" });
  });
  it("never calls the classifier", async () => {
    const classify = vi.fn();
    await decide(input({ listOnly: true }), classify);
    expect(classify).not.toHaveBeenCalled();
  });
  it("allows a listed video outside list-only mode too", () => {
    expect(decideWithoutAI(input({}, { inActiveList: true }))?.reason).toBe("in_list");
  });
});

describe("rule 3: blocked channel", () => {
  it("blocks", () => {
    expect(decideWithoutAI(input({ blockedChannels: ["UC_channel"] }))?.reason).toBe("channel_blocked");
  });
  it("wins over the same channel being allowed", () => {
    const d = decideWithoutAI(input({ blockedChannels: ["UC_channel"], allowedChannels: ["UC_channel"] }));
    expect(d?.result).toBe("BLOCKED");
  });
});

describe("rule 4: allowed channel / allowlist-only", () => {
  it("allows an allowed channel without AI", async () => {
    const classify = vi.fn();
    const d = await decide(input({ allowedChannels: ["UC_channel"] }), classify);
    expect(d.reason).toBe("channel_allowed");
    expect(classify).not.toHaveBeenCalled();
  });
  it("asks for approval for other channels in allowlist-only mode", () => {
    expect(decideWithoutAI(input({ allowlistOnly: true }))?.result).toBe("NEEDS_APPROVAL");
  });
});

describe("rule 5: blocked keywords", () => {
  it("matches the title", () => {
    const d = decideWithoutAI(input({ blockedKeywords: ["חיות"] }));
    expect(d).toEqual({ result: "BLOCKED", reason: "keyword_blocked", detail: "חיות" });
  });
  it("matches tags, case-insensitively", () => {
    const d = decideWithoutAI({ ...input({ blockedKeywords: ["PRANK"] }), meta: { ...meta, tags: ["funny prank"] } });
    expect(d?.reason).toBe("keyword_blocked");
  });
  it("ignores niqqud", () => {
    expect(normalize("שִׁיר")).toBe("שיר");
    expect(decideWithoutAI(input({ blockedKeywords: ["שִׁיר"] }))?.reason).toBe("keyword_blocked");
  });
  it("ignores empty keywords", () => {
    expect(decideWithoutAI(input({ blockedKeywords: ["  "] }))).toBeNull();
  });
});

describe("rules 6–8: AI classification", () => {
  const rules = DEFAULT_RULES;
  it("blocks a blocked topic", () => {
    const d = decideFromClassification(rules, { ...safe, topics: ["scary"] });
    expect(d).toEqual({ result: "BLOCKED", reason: "topic_blocked", detail: "scary" });
  });
  it("does not block a topic the parent did not block", () => {
    expect(decideFromClassification(rules, { ...safe, topics: ["language"] }).result).toBe("ALLOWED");
  });
  it("blocks an age rating above the limit", () => {
    expect(decideFromClassification(rules, { ...safe, ageRating: 12 }).reason).toBe("age_rating");
  });
  it("allows an age rating equal to the limit", () => {
    expect(decideFromClassification(rules, { ...safe, ageRating: 7 }).result).toBe("ALLOWED");
  });
  it("asks for approval on low confidence", () => {
    expect(decideFromClassification(rules, { ...safe, confidence: 0.5 })).toEqual({
      result: "NEEDS_APPROVAL",
      reason: "low_confidence",
    });
  });
  it("blocks before checking confidence (when in doubt, block)", () => {
    expect(decideFromClassification(rules, { ...safe, topics: ["violence"], confidence: 0.4 }).result).toBe("BLOCKED");
  });
  it("allows a safe video", async () => {
    const d = await decide(input(), async () => safe);
    expect(d).toEqual({ result: "ALLOWED", reason: "ok" });
  });
});
