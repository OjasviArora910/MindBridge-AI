import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type User } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Chip, ErrorLine, Notice, PageTitle, Spinner } from "../components/ui";
import { CONCERNS, DURATIONS, FEELINGS, labelFor } from "../content";
import { useLoad } from "../hooks";

function Switch({ label, help, checked, onChange }: { label: string; help: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div><p className="font-medium" id={`sw-${label}`}>{label}</p><p className="mt-1 text-sm text-muted">{help}</p></div>
      <button role="switch" aria-checked={checked} aria-labelledby={`sw-${label}`} onClick={() => onChange(!checked)}
        className={`relative mt-1 h-8 w-14 shrink-0 rounded-full border transition-colors ${checked ? "border-deep bg-deep" : "border-[#9fb0b8] bg-white"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full transition-all ${checked ? "left-7 bg-white" : "left-0.5 bg-[#9fb0b8]"}`} />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

interface Ctx { personalization_enabled: boolean; onboarding: { stress_level: number | null; feelings: string[]; main_concern: string | null; duration: string | null } | null;
  recent_mood_checkins_used: number; chat_history_saved: boolean; note: string }

export function Settings() {
  const { user, setUser, signOut } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const ctx = useLoad(() => api<Ctx>("/data/context"));

  if (!user) return null;

  async function update(patch: Partial<User>) {
    setError(null); setMsg(null);
    try { setUser(await api<User>("/preferences", { method: "PATCH", json: patch })); void ctx.reload(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "We couldn't save that setting."); }
  }

  async function act(fn: () => Promise<unknown>, done: string) {
    setError(null); setMsg(null);
    try { await fn(); setMsg(done); void ctx.reload(); } catch (e) { setError(e instanceof ApiError ? e.message : "That didn't work. Please try again."); }
  }

  async function exportData() {
    await act(async () => {
      const data = await api<unknown>("/data/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "mindbridge-my-data.json"; a.click(); URL.revokeObjectURL(url);
    }, "Your data export has been downloaded.");
  }

  async function deleteAccount() {
    if (window.prompt("This permanently deletes your account and everything in it. Type DELETE to confirm.") !== "DELETE") return;
    try { await api("/data/all", { method: "DELETE" }); signOut(); nav("/"); }
    catch (e) { setError(e instanceof ApiError ? e.message : "We couldn't delete your account. Please try again."); }
  }

  return (
    <div>
      <PageTitle title="Settings & privacy" intro="You decide what's saved and what's used. Changes apply right away." />
      <div aria-live="polite">{msg && <div className="mb-4"><Notice>{msg}</Notice></div>}<ErrorLine message={error} /></div>

      <Card aria-labelledby="priv-h">
        <h2 id="priv-h" className="text-lg font-semibold text-deep">Privacy controls</h2>
        <div className="divide-y divide-line">
          <Switch label="Save my chat history" checked={user.save_chat_history} onChange={(v) => void update({ save_chat_history: v })}
            help="Off by default. When off, conversations aren't stored on the server and are gone when you leave the page." />
          <Switch label="Personalize with my answers and check-ins" checked={user.personalization_enabled} onChange={(v) => void update({ personalization_enabled: v })}
            help="Lets the chat and home screen use your onboarding answers and recent mood ratings. Turn off for fully generic replies." />
          <Switch label="Allow sharing my messages with the AI provider" checked={user.share_with_ai_provider} onChange={(v) => void update({ share_with_ai_provider: v })}
            help="Only matters when a real external AI service is connected: your messages would be sent to it to write replies. Off by default. In development mock mode nothing leaves the server. Your data isn't used to train models by default." />
        </div>
      </Card>

      <Card className="mt-6" aria-labelledby="style-h">
        <h2 id="style-h" className="text-lg font-semibold text-deep">Style</h2>
        <fieldset className="mt-3"><legend className="mb-2 text-sm font-medium">Reply length</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {(["short", "medium", "long"] as const).map((l) => <Chip key={l} role="radio" selected={user.response_length === l} onClick={() => void update({ response_length: l })}>{l[0].toUpperCase() + l.slice(1)}</Chip>)}
          </div>
        </fieldset>
        <fieldset className="mt-4"><legend className="mb-2 text-sm font-medium">Language</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            <Chip role="radio" selected onClick={() => undefined}>English</Chip>
            <span className="inline-flex min-h-11 items-center rounded-full border border-dashed border-line px-4 text-muted">हिन्दी · coming soon</span>
          </div>
        </fieldset>
        <fieldset className="mt-4"><legend className="mb-2 text-sm font-medium">Region for support options</legend>
          <p className="mb-2 text-sm text-muted">We never guess your location. This only decides which support numbers we show.</p>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {([["IN", "India"], ["US", "United States"], ["OTHER", "Another country"]] as const).map(([k, l]) => <Chip key={k} role="radio" selected={user.region === k} onClick={() => void update({ region: k })}>{l}</Chip>)}
          </div>
        </fieldset>
      </Card>

      <Card className="mt-6" aria-labelledby="ctx-h">
        <h2 id="ctx-h" className="text-lg font-semibold text-deep">What's saved for personalization</h2>
        {ctx.loading && <Spinner />}
        {ctx.data && (
          <div className="mt-2 space-y-2">
            {ctx.data.onboarding ? (
              <ul className="list-disc pl-5">
                <li>Self-rated intensity at the start: {ctx.data.onboarding.stress_level ?? "skipped"}</li>
                <li>Feelings: {ctx.data.onboarding.feelings.map((f) => labelFor(FEELINGS, f)).join(", ") || "skipped"}</li>
                <li>Main concern: {labelFor(CONCERNS, ctx.data.onboarding.main_concern) || "skipped"}</li>
                <li>How long: {labelFor(DURATIONS, ctx.data.onboarding.duration) || "skipped"}</li>
              </ul>
            ) : <p className="text-muted">No onboarding answers are saved.</p>}
            <p className="text-sm text-muted">{ctx.data.personalization_enabled ? `${ctx.data.recent_mood_checkins_used} check-in(s) from the last 7 days can be used in chat.` : "Personalization is off, so none of this is used."} {ctx.data.note}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/app/onboarding" className="inline-flex min-h-11 items-center rounded-full border border-line bg-mist px-5 font-medium text-deep">Edit my answers</Link>
              <Button variant="soft" onClick={() => void act(() => api("/data/context", { method: "DELETE" }), "Saved answers deleted.")}>Delete saved answers</Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="mt-6" aria-labelledby="data-h">
        <h2 id="data-h" className="text-lg font-semibold text-deep">Your data</h2>
        <p className="mt-2 text-sm text-muted">Mood, sleep and diary entries stay until you delete them. Deleting your account removes everything permanently.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="soft" onClick={() => void exportData()}>Download my data</Button>
          <Button variant="soft" onClick={() => void act(() => api("/chat/conversations", { method: "DELETE" }), "All saved conversations deleted.")}>Delete saved conversations</Button>
          <Button variant="soft" onClick={() => void deleteAccount()}>Delete my account</Button>
        </div>
      </Card>

      <Card className="mt-6" aria-labelledby="acct-h">
        <h2 id="acct-h" className="text-lg font-semibold text-deep">Account</h2>
        <p className="mt-2 text-muted">{user.is_guest ? "You're using a guest account." : `Signed in as ${user.email}.`}</p>
        <Button className="mt-3" variant="soft" onClick={() => { signOut(); nav("/"); }}>Sign out</Button>
        <div className="mt-4"><Notice>Prototype build: simple local authentication, not production-secure. MindBridge AI is an AI companion. It isn't a therapist, can't diagnose or treat, and isn't an emergency service.</Notice></div>
      </Card>
    </div>
  );
}
