"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addVideoAction, createListAction, createPairingCodeAction, deleteChildAction } from "../../../actions";

export function AddVideoForm({ listId }: { listId: string }) {
  const [state, action, pending] = useActionState(addVideoAction.bind(null, listId), undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="inline">
      <label style={{ flex: "3 1 260px" }}>
        קישור לסרטון YouTube
        <input name="video" required placeholder="https://www.youtube.com/watch?v=..." dir="ltr" />
      </label>
      <label>
        שם לכפתור (לא חובה)
        <input name="title" maxLength={80} />
      </label>
      <button className="btn" disabled={pending}>{pending ? "מוסיף..." : "הוספה"}</button>
      {state?.error && <p className="msg-error" style={{ flexBasis: "100%" }}>{state.error}</p>}
      {state?.ok && <p className="msg-ok" style={{ flexBasis: "100%" }}>{state.ok}</p>}
    </form>
  );
}

export function AddListForm({ childId }: { childId: string }) {
  const [state, action, pending] = useActionState(createListAction.bind(null, childId), undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="inline">
      <label>שם הרשימה<input name="name" required maxLength={60} /></label>
      <button className="btn" disabled={pending}>יצירה</button>
      {state?.error && <p className="msg-error" style={{ flexBasis: "100%" }}>{state.error}</p>}
    </form>
  );
}

export function PairPanel({ childId, childName }: { childId: string; childName: string }) {
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  async function generate() {
    setPending(true);
    setError(null);
    const res = await createPairingCodeAction(childId);
    setPending(false);
    if ("error" in res) setError(res.error);
    else setCode(res);
  }

  const kidUrl = code ? `${origin}/kid?code=${code.code}` : `${origin}/kid`;
  return (
    <div className="card stack">
      <div>
        <h2>מסך הצפייה של {childName}</h2>
        <p className="muted small">
          במכשיר של הילד/ה פותחים את <a href="/kid" dir="ltr">{origin}/kid</a> ומקלידים קוד חד-פעמי. המכשיר נשאר מחובר עד שתנתקו אותו.
        </p>
      </div>
      {code ? (
        <div className="stack" style={{ justifyItems: "center" }}>
          <div className="code">{code.code}</div>
          <p className="muted small">בתוקף 10 דקות, עד {new Date(code.expiresAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</p>
          <div className="row">
            <a className="btn" href={kidUrl} target="_blank" rel="noreferrer">לפתוח את מסך הילד במכשיר הזה</a>
            <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(kidUrl)}>העתקת קישור</button>
          </div>
        </div>
      ) : (
        <div>
          <button className="btn" onClick={generate} disabled={pending}>{pending ? "יוצר..." : "קוד חיבור למכשיר"}</button>
        </div>
      )}
      {error && <p className="msg-error">{error}</p>}
    </div>
  );
}

/** A destructive button with a browser confirm. `action` is "deleteChild:<id>". */
export function ConfirmButton({ action, label, confirm: question }: { action: string; label: string; confirm: string }) {
  const [, id] = action.split(":");
  return (
    <form
      action={() => deleteChildAction(id)}
      onSubmit={(e) => {
        if (!window.confirm(question)) e.preventDefault();
      }}
    >
      <button className="btn danger sm">{label}</button>
    </form>
  );
}
