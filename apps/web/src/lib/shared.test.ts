import { describe, expect, it } from "vitest";
import { parsePlaylistId, parseVideoId } from "@kids/shared";

describe("parseVideoId", () => {
  it.each([
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("%s", (input, id) => expect(parseVideoId(input)).toBe(id));
  it("rejects other sites and junk", () => {
    expect(parseVideoId("https://vimeo.com/123")).toBeNull();
    expect(parseVideoId("hello")).toBeNull();
  });
});

describe("parsePlaylistId", () => {
  it("reads a playlist URL", () => {
    expect(parsePlaylistId("https://www.youtube.com/playlist?list=PLabcdefghijkl12")).toBe("PLabcdefghijkl12");
  });
  it("accepts a bare id", () => expect(parsePlaylistId("PLabcdefghijkl12")).toBe("PLabcdefghijkl12"));
});
