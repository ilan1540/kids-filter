import { z } from "zod";

/** Topics the classifier can flag. Parents choose which of these are blocked. */
export const TOPICS = [
  "violence",
  "scary",
  "sexual",
  "language",
  "drugs",
  "gambling",
  "dangerous_challenges",
  "none",
] as const;
export const Topic = z.enum(TOPICS);
export type Topic = z.infer<typeof Topic>;

/** Structured output the AI classifier must return. */
export const Classification = z.object({
  topics: z.array(Topic),
  ageRating: z.number().int().min(0).max(18),
  confidence: z.number().min(0).max(1),
  language: z.string(),
});
export type Classification = z.infer<typeof Classification>;

export const WATCH_RESULTS = ["ALLOWED", "BLOCKED", "NEEDS_APPROVAL"] as const;
export type WatchResult = (typeof WATCH_RESULTS)[number];

/** Machine-readable reason codes, translated to Hebrew in the apps. */
export const REASONS = [
  "override_allowed",
  "override_blocked",
  "not_embeddable",
  "in_list",
  "not_in_list",
  "channel_blocked",
  "channel_allowed",
  "channel_not_allowed",
  "keyword_blocked",
  "topic_blocked",
  "age_rating",
  "low_confidence",
  "ok",
] as const;
export type Reason = (typeof REASONS)[number];

export interface Decision {
  result: WatchResult;
  reason: Reason;
  /** Extra detail for the parent, e.g. the keyword or topic that matched. */
  detail?: string;
}

export const REASON_HE: Record<Reason, string> = {
  override_allowed: "ההורה אישר את הסרטון",
  override_blocked: "ההורה חסם את הסרטון",
  not_embeddable: "לא ניתן לנגן את הסרטון באפליקציה",
  in_list: "הסרטון ברשימה מאושרת",
  not_in_list: "הסרטון לא נמצא ברשימה המאושרת",
  channel_blocked: "הערוץ חסום",
  channel_allowed: "ערוץ מורשה",
  channel_not_allowed: "הערוץ עדיין לא אושר",
  keyword_blocked: "נמצאה מילה חסומה",
  topic_blocked: "נושא שההורה חסם",
  age_rating: "מתאים לגיל מבוגר יותר",
  low_confidence: "לא בטוחים שהסרטון מתאים",
  ok: "מותר",
};

// ---------- API input schemas (shared by dashboard and kids app) ----------

export const CreateChildInput = z.object({
  name: z.string().trim().min(1).max(40),
  birthYear: z.number().int().min(2000).max(2100),
});

export const RuleSetInput = z.object({
  maxAgeRating: z.number().int().min(0).max(18),
  blockedTopics: z.array(Topic.exclude(["none"])),
  blockedKeywords: z.array(z.string().trim().min(1).max(60)).max(200),
  allowedChannels: z.array(z.string().min(1)).max(500),
  blockedChannels: z.array(z.string().min(1)).max(500),
  allowlistOnly: z.boolean(),
  listOnly: z.boolean(),
  dailyMinutes: z.number().int().min(0).max(1440).nullable(),
});
export type RuleSetInput = z.infer<typeof RuleSetInput>;

export const CreateListInput = z.object({
  name: z.string().trim().min(1).max(60),
  /** A YouTube playlist URL or id to import. Optional. */
  playlist: z.string().trim().min(1).optional(),
});

export const UpdateListInput = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  isActive: z.boolean().optional(),
});

export const AddListItemInput = z.object({
  /** A YouTube URL or a bare 11-char video id. */
  video: z.string().trim().min(1),
});

export const ReorderListInput = z.object({
  videoIds: z.array(z.string()).min(1),
});

export const PairInput = z.object({
  code: z.string().regex(/^\d{6}$/),
  fcmToken: z.string().optional(),
});

export const CreateRequestInput = z.object({
  videoId: z.string().min(1),
});

export const DecideRequestInput = z.object({
  status: z.enum(["APPROVED", "DENIED"]),
  /** On approve: also allow the whole channel from now on. */
  alwaysAllowChannel: z.boolean().optional(),
  /** On approve: also add the video to this list. */
  addToListId: z.string().optional(),
});

export const EventsInput = z.object({
  events: z
    .array(
      z.object({
        type: z.enum(["watch", "bypass_attempt"]),
        videoId: z.string().optional(),
        seconds: z.number().int().min(0).max(86400).optional(),
        detail: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(100),
});

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Extracts a YouTube video id from a URL or returns the id itself. */
export function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (VIDEO_ID.test(s)) return s;
  try {
    const url = new URL(s);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return VIDEO_ID.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "music.youtube.com") {
      const v = url.searchParams.get("v");
      if (v && VIDEO_ID.test(v)) return v;
      const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

/** Extracts a YouTube playlist id from a URL or returns the id itself. */
export function parsePlaylistId(input: string): string | null {
  const s = input.trim();
  if (/^(PL|UU|LL|FL|OL)[A-Za-z0-9_-]{10,}$/.test(s)) return s;
  try {
    const list = new URL(s).searchParams.get("list");
    return list && /^[A-Za-z0-9_-]{12,}$/.test(list) ? list : null;
  } catch {
    return null;
  }
}
