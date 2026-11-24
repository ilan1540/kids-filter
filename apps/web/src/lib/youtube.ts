import type { VideoMeta } from "./decide";

const API = "https://www.googleapis.com/youtube/v3";

export interface FullVideoMeta extends VideoMeta {
  channelTitle: string;
  categoryId: string | null;
  thumbnail: string | null;
  madeForKids: boolean | null;
  defaultLanguage: string | null;
}

export class YouTubeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function yt<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new YouTubeError(`YouTube ${path} failed: ${res.status}`, res.status);
  return res.json() as Promise<T>;
}

interface Thumbs {
  default?: { url: string };
  medium?: { url: string };
  high?: { url: string };
}

interface VideoItem {
  id: string;
  snippet: {
    channelId: string;
    channelTitle: string;
    title: string;
    description: string;
    tags?: string[];
    categoryId?: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
    thumbnails: Thumbs;
  };
  status: { embeddable: boolean; madeForKids?: boolean; privacyStatus: string };
}

function toMeta(v: VideoItem): FullVideoMeta {
  const t = v.snippet.thumbnails;
  return {
    videoId: v.id,
    channelId: v.snippet.channelId,
    channelTitle: v.snippet.channelTitle,
    title: v.snippet.title,
    description: v.snippet.description ?? "",
    tags: v.snippet.tags ?? [],
    categoryId: v.snippet.categoryId ?? null,
    thumbnail: t.high?.url ?? t.medium?.url ?? t.default?.url ?? null,
    embeddable: v.status.embeddable && v.status.privacyStatus !== "private",
    madeForKids: v.status.madeForKids ?? null,
    defaultLanguage: v.snippet.defaultLanguage ?? v.snippet.defaultAudioLanguage ?? null,
  };
}

/**
 * Without an API key we fall back to oEmbed: title and thumbnail only, no quota.
 * oEmbed answers 401/403 for videos that can't be embedded and 404 for missing ones.
 */
async function fetchOEmbed(id: string): Promise<FullVideoMeta | null> {
  const watch = `https://www.youtube.com/watch?v=${id}`;
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const o = (await res.json()) as { title: string; author_name: string; author_url: string };
  return {
    videoId: id,
    channelId: o.author_url,
    channelTitle: o.author_name,
    title: o.title,
    description: "",
    tags: [],
    categoryId: null,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    embeddable: true,
    madeForKids: null,
    defaultLanguage: null,
  };
}

export const hasApiKey = () => !!process.env.YOUTUBE_API_KEY;

/** videos.list: 1 quota unit for up to 50 ids. Falls back to oEmbed when there is no API key. */
export async function fetchVideosMeta(ids: string[]): Promise<FullVideoMeta[]> {
  if (!hasApiKey()) {
    const metas = await Promise.all(ids.map(fetchOEmbed));
    return metas.filter((m): m is FullVideoMeta => !!m);
  }
  const out: FullVideoMeta[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const data = await yt<{ items: VideoItem[] }>("videos", {
      part: "snippet,status",
      id: chunk.join(","),
      maxResults: "50",
    });
    out.push(...data.items.map(toMeta));
  }
  return out;
}

export async function fetchVideoMeta(id: string): Promise<FullVideoMeta | null> {
  const [meta] = await fetchVideosMeta([id]);
  return meta ?? null;
}

/** search.list: 100 quota units. Returns video ids only. */
export async function searchVideoIds(q: string, max = 15): Promise<string[]> {
  const data = await yt<{ items: { id: { videoId?: string } }[] }>("search", {
    part: "id",
    type: "video",
    q,
    maxResults: String(max),
    safeSearch: "strict",
    videoEmbeddable: "true",
    relevanceLanguage: "he",
    regionCode: "IL",
  });
  return data.items.map((i) => i.id.videoId).filter((id): id is string => !!id);
}

/** playlistItems.list: 1 unit per 50 videos. */
export async function fetchPlaylistVideoIds(playlistId: string, limit = 200): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const data = await yt<{ items: { contentDetails: { videoId: string } }[]; nextPageToken?: string }>(
      "playlistItems",
      { part: "contentDetails", playlistId, maxResults: "50", ...(pageToken ? { pageToken } : {}) },
    );
    ids.push(...data.items.map((i) => i.contentDetails.videoId));
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < limit);
  return ids.slice(0, limit);
}

/** commentThreads.list: 1 unit. Comments are often disabled on kids' videos, so failures are ignored. */
export async function fetchTopComments(videoId: string, max = 20): Promise<string[]> {
  try {
    const data = await yt<{ items: { snippet: { topLevelComment: { snippet: { textOriginal: string } } } }[] }>(
      "commentThreads",
      { part: "snippet", videoId, maxResults: String(max), order: "relevance", textFormat: "plainText" },
    );
    return data.items.map((i) => i.snippet.topLevelComment.snippet.textOriginal.slice(0, 300));
  } catch {
    return [];
  }
}
