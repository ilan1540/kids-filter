import type { Classification, Decision } from "@kids/shared";

/** The subset of RuleSet the engine reads. */
export interface Rules {
  maxAgeRating: number;
  blockedTopics: string[];
  blockedKeywords: string[];
  allowedChannels: string[];
  blockedChannels: string[];
  allowlistOnly: boolean;
  listOnly: boolean;
}

/** The subset of YouTube metadata the engine reads. */
export interface VideoMeta {
  videoId: string;
  channelId: string;
  title: string;
  description: string;
  tags: string[];
  embeddable: boolean;
}

export interface DecideInput {
  rules: Rules;
  meta: VideoMeta;
  /** The parent's manual decision for this video, if any. */
  override?: { allowed: boolean } | null;
  /** Whether the video is in one of the child's active lists. */
  inActiveList: boolean;
}

export const MIN_CONFIDENCE = 0.7;

export const DEFAULT_RULES: Rules = {
  maxAgeRating: 7,
  blockedTopics: ["violence", "scary", "sexual", "drugs", "gambling", "dangerous_challenges"],
  blockedKeywords: [],
  allowedChannels: [],
  blockedChannels: [],
  allowlistOnly: false,
  listOnly: false,
};

/** Lowercases and strips Hebrew niqqud so "מִלָּה" matches "מילה". */
export function normalize(s: string): string {
  return s.normalize("NFKD").replace(/[֑-ׇ̀-ͯ]/g, "").toLowerCase();
}

function findKeyword(meta: VideoMeta, keywords: string[]): string | undefined {
  if (keywords.length === 0) return undefined;
  const haystack = normalize([meta.title, meta.description, ...meta.tags].join("\n"));
  return keywords.find((k) => {
    const needle = normalize(k).trim();
    return needle.length > 0 && haystack.includes(needle);
  });
}

/**
 * Rules 1–5: everything that can be decided without the AI classifier.
 * Returns null when the decision needs a classification.
 */
export function decideWithoutAI({ rules, meta, override, inActiveList }: DecideInput): Decision | null {
  // 1. The parent's own decision always wins.
  if (override) {
    return override.allowed
      ? { result: "ALLOWED", reason: "override_allowed" }
      : { result: "BLOCKED", reason: "override_blocked" };
  }
  // A video that can't be embedded can't play in our player at all.
  if (!meta.embeddable) return { result: "BLOCKED", reason: "not_embeddable" };

  // 2. List-only mode: the active lists are the whole world.
  if (rules.listOnly) {
    return inActiveList
      ? { result: "ALLOWED", reason: "in_list" }
      : { result: "NEEDS_APPROVAL", reason: "not_in_list" };
  }
  // A video the parent put in a list is approved even outside list-only mode.
  if (inActiveList) return { result: "ALLOWED", reason: "in_list" };

  // 3. Blocked channel.
  if (rules.blockedChannels.includes(meta.channelId)) {
    return { result: "BLOCKED", reason: "channel_blocked" };
  }
  // 4. Allowed channel, or allowlist-only mode.
  if (rules.allowedChannels.includes(meta.channelId)) {
    return { result: "ALLOWED", reason: "channel_allowed" };
  }
  if (rules.allowlistOnly) return { result: "NEEDS_APPROVAL", reason: "channel_not_allowed" };

  // 5. Blocked keywords in title, description or tags.
  const keyword = findKeyword(meta, rules.blockedKeywords);
  if (keyword) return { result: "BLOCKED", reason: "keyword_blocked", detail: keyword };

  return null;
}

/** Rules 6–8: decide from the AI classification. */
export function decideFromClassification(rules: Rules, cls: Classification): Decision {
  // 6. Blocked topic or age rating above the limit.
  const topic = cls.topics.find((t) => t !== "none" && rules.blockedTopics.includes(t));
  if (topic) return { result: "BLOCKED", reason: "topic_blocked", detail: topic };
  if (cls.ageRating > rules.maxAgeRating) {
    return { result: "BLOCKED", reason: "age_rating", detail: String(cls.ageRating) };
  }
  // 7. When in doubt, ask the parent.
  if (cls.confidence < MIN_CONFIDENCE) return { result: "NEEDS_APPROVAL", reason: "low_confidence" };
  // 8. Otherwise allowed.
  return { result: "ALLOWED", reason: "ok" };
}

/** The full engine. `classify` is only called when rules 1–5 don't decide. */
export async function decide(
  input: DecideInput,
  classify: () => Promise<Classification>,
): Promise<Decision> {
  return decideWithoutAI(input) ?? decideFromClassification(input.rules, await classify());
}
