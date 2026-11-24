"use client";

import { useActionState } from "react";
import { createChildAction } from "../actions";

export function AddChildForm() {
  const [state, action, pending] = useActionState(createChildAction, undefined);
  return (
    <form action={action} className="inline">
      <label>שם<input name="name" required maxLength={40} /></label>
      <label>שנת לידה<input name="birthYear" type="number" required min={2005} max={new Date().getFullYear()} placeholder="2017" dir="ltr" /></label>
      <button className="btn" disabled={pending}>הוספה</button>
      {state?.error && <p className="msg-error" style={{ flexBasis: "100%" }}>{state.error}</p>}
    </form>
  );
}
