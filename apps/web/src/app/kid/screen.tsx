"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Item = { videoId: string; title: string; thumbnail: string | null };
type Home = { child: { id: string; name: string }; lists: { id: string; name: string; items: Item[] }[] };

const TOKEN_KEY = "kids-filter:deviceToken";

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function writeToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: stays paired for this tab only */
  }
}

export function KidScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [home, setHome] = useState<Home | null>(null);
  const [playing, setPlaying] = useState<{ listId: string; index: number } | null>(null);

  useEffect(() => {
    setToken(readToken());
    setReady(true);
  }, []);

  const load = useCallback(async (t: string) => {
    const res = await fetch("/api/videos/home", { headers: { authorization: `Bearer ${t}` }, cache: "no-store" });
    if (res.status === 401) {
      writeToken(null);
      setToken(null);
      setHome(null);
      return;
    }
    if (res.ok) setHome(await res.json());
  }, []);

  // Load now, then refresh when the tab comes back and every minute, so new buttons show up.
  useEffect(() => {
    if (!token) return;
    load(token);
    fetch("/api/devices/heartbeat", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" });
    const onFocus = () => load(token);
    window.addEventListener("focus", onFocus);
    const timer = setInterval(() => load(token), 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [token, load]);

  if (!ready) return <div className="kid" />;

  if (!token) {
    return (
      <Pair
        initialCode={params.get("code") ?? ""}
        onPaired={(t) => {
          writeToken(t);
          setToken(t);
          router.replace("/kid");
        }}
      />
    );
  }

  const list = playing ? home?.lists.find((l) => l.id === playing.listId) : null;
  const item = list && playing ? list.items[playing.index] : null;

  return (
    <div className="kid">
      <h1>{home ? `שלום ${home.child.name}! 👋` : "טוען..."}</h1>
      {home && home.lists.every((l) => l.items.length === 0) && (
        <p style={{ textAlign: "center", fontSize: 20 }}>עוד אין כאן סרטונים. בקשו מאבא או אמא להוסיף 😊</p>
      )}
      {home?.lists
        .filter((l) => l.items.length > 0)
        .map((l) => (
          <section key={l.id} className="kid-section">
            {home.lists.filter((x) => x.items.length > 0).length > 1 && <h2>{l.name}</h2>}
            <div className="kid-grid">
              {l.items.map((it, index) => (
                <button key={it.videoId} className="kid-btn" onClick={() => setPlaying({ listId: l.id, index })}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.thumbnail ?? `https://i.ytimg.com/vi/${it.videoId}/hqdefault.jpg`} alt="" />
                  <span>{it.title}</span>
                </button>
              ))}
            </div>
          </section>
        ))}

      {item && list && playing && (
        <Player
          key={item.videoId}
          item={item}
          token={token}
          hasNext={playing.index < list.items.length - 1}
          onNext={() => setPlaying({ ...playing, index: playing.index + 1 })}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  );
}

function Pair({ initialCode, onPaired }: { initialCode: string; onPaired: (token: string) => void }) {
  const [code, setCode] = useState(initialCode.replace(/\D/g, "").slice(0, 6));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = useCallback(
    async (c: string) => {
      setPending(true);
      setError(null);
      const res = await fetch("/api/devices/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      setPending(false);
      if (!res.ok) {
        setError("הקוד לא נכון או שפג תוקפו. בקשו קוד חדש מההורה.");
        return;
      }
      const { deviceToken } = (await res.json()) as { deviceToken: string };
      onPaired(deviceToken);
    },
    [onPaired],
  );

  // A code in the link (from the parent's "open on this device" button) pairs right away.
  const autoTried = useRef(false);
  useEffect(() => {
    if (!autoTried.current && /^\d{6}$/.test(initialCode)) {
      autoTried.current = true;
      submit(initialCode);
    }
  }, [initialCode, submit]);

  return (
    <div className="kid">
      <form
        className="pair"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d{6}$/.test(code)) submit(code);
        }}
      >
        <h1 style={{ margin: 0 }}>🎬 הסרטונים שלי</h1>
        <p>מקלידים את הקוד שההורה קיבל בדשבורד</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          aria-label="קוד חיבור"
        />
        {error && <p className="msg-error">{error}</p>}
        <button className="btn" style={{ fontSize: 20 }} disabled={pending || code.length !== 6}>
          {pending ? "מתחבר..." : "כניסה"}
        </button>
      </form>
    </div>
  );
}

// ---- YouTube IFrame Player ----

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => { destroy(): void }; PlayerState: { ENDED: number } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytReady: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (ytReady) return ytReady;
  ytReady = new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return ytReady;
}

function Player({ item, token, hasNext, onNext, onClose }: {
  item: Item;
  token: string;
  hasNext: boolean;
  onNext: () => void;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ended, setEnded] = useState(false);
  const started = useRef(Date.now());

  useEffect(() => {
    let player: { destroy(): void } | null = null;
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || !host.current || !window.YT) return;
      const el = document.createElement("div");
      host.current.appendChild(el);
      player = new window.YT.Player(el, {
        videoId: item.videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1, fs: 1, iv_load_policy: 3 },
        events: {
          // Cover YouTube's end screen so the child doesn't see recommended videos.
          onStateChange: (e: { data: number }) => {
            if (e.data === window.YT!.PlayerState.ENDED) setEnded(true);
          },
        },
      });
    });
    const startedAt = started.current;
    return () => {
      cancelled = true;
      player?.destroy();
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      fetch("/api/events", {
        method: "POST",
        keepalive: true,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ events: [{ type: "watch", videoId: item.videoId, seconds }] }),
      }).catch(() => {});
    };
  }, [item.videoId, token]);

  return (
    <div className="player">
      <div className="player-bar">
        <button className="btn" onClick={onClose}>→ חזרה</button>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
        <span />
      </div>
      <div className="player-frame" ref={host} style={{ position: "relative" }}>
        {ended && (
          <div className="ended">
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ fontSize: 28 }}>הסרטון נגמר 🎉</div>
              <div className="row" style={{ justifyContent: "center" }}>
                {hasNext && <button className="btn" style={{ fontSize: 20 }} onClick={onNext}>לסרטון הבא</button>}
                <button className="btn ghost" style={{ fontSize: 20, color: "#fff" }} onClick={onClose}>חזרה לכפתורים</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
