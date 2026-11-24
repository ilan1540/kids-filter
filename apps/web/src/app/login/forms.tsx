"use client";

import { useActionState, useState } from "react";
import { loginAction, signupAction } from "../actions";

export function LoginForms() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, login, loggingIn] = useActionState(loginAction, undefined);
  const [signupState, signup, signingUp] = useActionState(signupAction, undefined);

  return (
    <div className="card stack">
      <div className="row">
        <button className={`btn sm ${mode === "login" ? "" : "ghost"}`} onClick={() => setMode("login")}>התחברות</button>
        <button className={`btn sm ${mode === "signup" ? "" : "ghost"}`} onClick={() => setMode("signup")}>הרשמה</button>
      </div>
      {mode === "login" ? (
        <form action={login} className="stack">
          <label>מייל<input name="email" type="email" required autoComplete="email" dir="ltr" /></label>
          <label>סיסמה<input name="password" type="password" required autoComplete="current-password" dir="ltr" /></label>
          {loginState?.error && <p className="msg-error">{loginState.error}</p>}
          <button className="btn" disabled={loggingIn}>{loggingIn ? "מתחבר..." : "התחברות"}</button>
        </form>
      ) : (
        <form action={signup} className="stack">
          <label>שם (לא חובה)<input name="name" autoComplete="name" /></label>
          <label>מייל<input name="email" type="email" required autoComplete="email" dir="ltr" /></label>
          <label>סיסמה (8 תווים לפחות)<input name="password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" /></label>
          {signupState?.error && <p className="msg-error">{signupState.error}</p>}
          <button className="btn" disabled={signingUp}>{signingUp ? "יוצר חשבון..." : "יצירת חשבון"}</button>
        </form>
      )}
    </div>
  );
}
