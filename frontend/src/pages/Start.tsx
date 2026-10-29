import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import { useAuth } from "../auth";
import { Button, Card, ErrorLine, Field, Notice, inputCls } from "../components/ui";

export function Start() {
  const { user, signIn, continueAsGuest, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={user.onboarding_complete ? "/app" : "/app/onboarding"} replace />;

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); nav("/app/onboarding"); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); void run(() => signIn(mode, email, password)); };

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <h1 className="text-3xl font-semibold text-deep">Welcome</h1>
      <p className="mt-2 text-muted">Choose how you'd like to begin. You can change this later.</p>

      <Card className="mt-6" aria-labelledby="guest-h">
        <h2 id="guest-h" className="text-lg font-semibold text-deep">Continue as a guest</h2>
        <p className="mt-1 text-muted">No email needed. Chat history is off by default. Guest data stays linked to this browser, so signing out without an account means you can't get back to it.</p>
        <Button className="mt-4" disabled={busy} onClick={() => void run(continueAsGuest)}>Continue as guest</Button>
      </Card>

      <Card className="mt-5" aria-labelledby="acct-h">
        <h2 id="acct-h" className="text-lg font-semibold text-deep">{mode === "register" ? "Create an account" : "Sign in"}</h2>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <Field label="Email"><input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password" hint={mode === "register" ? "At least 8 characters." : undefined}>
            <input className={inputCls} type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 8 : 1}
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <ErrorLine message={error} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy}>{mode === "register" ? "Create account" : "Sign in"}</Button>
            <button type="button" className="min-h-11 text-deep underline underline-offset-2" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(null); }}>
              {mode === "register" ? "I already have an account" : "Create an account instead"}
            </button>
          </div>
        </form>
      </Card>

      <div className="mt-5">
        <Notice>
          <strong className="font-semibold">Prototype notice.</strong> This build uses simple local authentication and is not production-secure.
          Don't use a password you use anywhere else.
        </Notice>
      </div>
    </main>
  );
}
