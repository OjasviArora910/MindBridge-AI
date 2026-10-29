import { useState } from "react";
import { api, ApiError, type Resources, type Thought, type ThoughtInput } from "../api";
import { ResourceList } from "../components/Support";
import { Button, Card, ErrorLine, Field, Notice, PageTitle, Spinner, inputCls } from "../components/ui";
import { useLoad } from "../hooks";

const STEPS = [
  { key: "situation", title: "Situation", prompt: "What happened? Just the facts, as if describing a scene." },
  { key: "automatic_thought", title: "Automatic thought", prompt: "What went through your mind?" },
  { key: "emotion", title: "Emotion", prompt: "What did you feel?" },
  { key: "intensity", title: "Intensity", prompt: "How strong was that feeling, from 0 to 10?" },
  { key: "evidence", title: "Evidence", prompt: "What supports this thought, and what challenges it?" },
  { key: "alternative", title: "Another perspective", prompt: "What's another possible way to view this?" },
  { key: "next_step", title: "Next step", prompt: "What would be helpful now?" },
] as const;

interface Suggest { suggestions: string[]; mock_mode: boolean; note: string; safety_message: string | null; resources: Resources | null }

export function Diary() {
  const list = useLoad(() => api<Thought[]>("/diary"));
  const [editing, setEditing] = useState<Thought | "new" | null>(null);

  return (
    <div>
      <PageTitle title="Thought diary" intro="A gentle way to look at a difficult thought from a few angles. Every step is optional and editable." />
      {editing ? (
        <Wizard
          initial={editing === "new" ? null : editing}
          onClose={(changed) => { setEditing(null); if (changed) void list.reload(); }}
        />
      ) : (
        <>
          <Button onClick={() => setEditing("new")}>New entry</Button>
          <Card className="mt-6" aria-labelledby="entries-h">
            <h2 id="entries-h" className="text-lg font-semibold text-deep">Your entries</h2>
            {list.loading && <Spinner />}
            {list.error && <div className="mt-3"><Notice tone="care">{list.error}</Notice></div>}
            {list.data?.length === 0 && <p className="mt-3 text-muted">Nothing here yet. When something feels stuck, an entry can help you slow it down.</p>}
            <ul className="mt-3 divide-y divide-line">
              {list.data?.map((t) => (
                <li key={t.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{t.automatic_thought || t.situation || "Untitled entry"}</p>
                    <p className="text-sm text-muted">{new Date(t.created_at).toLocaleDateString()}{t.emotion ? ` · ${t.emotion}` : ""}{t.intensity != null ? ` (${t.intensity}/10)` : ""}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" onClick={() => setEditing(t)} aria-label={`Edit entry: ${t.automatic_thought || t.situation || "untitled"}`}>Edit</Button>
                    <Button variant="ghost" aria-label="Delete entry" onClick={async () => {
                      if (!window.confirm("Delete this entry?")) return;
                      await api(`/diary/${t.id}`, { method: "DELETE" }).catch(() => undefined);
                      void list.reload();
                    }}>Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

function Wizard({ initial, onClose }: { initial: Thought | null; onClose: (changed: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<ThoughtInput>(initial ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sug, setSug] = useState<Suggest | null>(null);
  const [sugBusy, setSugBusy] = useState(false);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];
  const set = (k: keyof ThoughtInput, v: string | number | null) => setF((p) => ({ ...p, [k]: v === "" ? null : v }));

  async function save() {
    setBusy(true); setError(null);
    const body = { situation: f.situation ?? null, automatic_thought: f.automatic_thought ?? null, emotion: f.emotion ?? null,
      intensity: f.intensity ?? null, evidence_for: f.evidence_for ?? null, evidence_against: f.evidence_against ?? null,
      alternative: f.alternative ?? null, next_step: f.next_step ?? null };
    try {
      await (initial ? api(`/diary/${initial.id}`, { method: "PUT", json: body }) : api("/diary", { method: "POST", json: body }));
      onClose(true);
    } catch (e) { setError(e instanceof ApiError ? e.message : "We couldn't save that. Please try again."); }
    finally { setBusy(false); }
  }

  async function suggest() {
    if (!f.automatic_thought) { setError("Write the thought first (step 2) and then I can offer some possibilities."); return; }
    setSugBusy(true); setError(null);
    try { setSug(await api<Suggest>("/diary/suggest", { method: "POST", json: { situation: f.situation, automatic_thought: f.automatic_thought } })); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Suggestions aren't available right now. You can still write your own."); }
    finally { setSugBusy(false); }
  }

  return (
    <Card aria-labelledby="wiz-h">
      <p className="text-sm text-muted" aria-live="polite">Step {step + 1} of {STEPS.length}</p>
      <h2 id="wiz-h" className="mt-1 text-xl font-semibold text-deep">{s.title}</h2>
      <p className="mt-1 text-muted">{s.prompt}</p>

      <div className="mt-4 space-y-4">
        {(s.key === "situation" || s.key === "automatic_thought" || s.key === "next_step") && (
          <Field label={s.title}><textarea className={inputCls} rows={4} maxLength={3000} value={f[s.key] ?? ""} onChange={(e) => set(s.key, e.target.value)} /></Field>
        )}
        {s.key === "emotion" && <Field label="Emotion"><input className={inputCls} maxLength={120} value={f.emotion ?? ""} onChange={(e) => set("emotion", e.target.value)} /></Field>}
        {s.key === "intensity" && (
          <Field label={`Intensity: ${f.intensity ?? "not set"}`}>
            <input type="range" min={0} max={10} className="w-full accent-[#35566f]" value={f.intensity ?? 0} onChange={(e) => set("intensity", Number(e.target.value))} />
          </Field>
        )}
        {s.key === "evidence" && (
          <>
            <Field label="What supports this thought?"><textarea className={inputCls} rows={3} maxLength={3000} value={f.evidence_for ?? ""} onChange={(e) => set("evidence_for", e.target.value)} /></Field>
            <Field label="What challenges it, or doesn't quite fit?"><textarea className={inputCls} rows={3} maxLength={3000} value={f.evidence_against ?? ""} onChange={(e) => set("evidence_against", e.target.value)} /></Field>
          </>
        )}
        {s.key === "alternative" && (
          <>
            <Field label="Another perspective"><textarea className={inputCls} rows={4} maxLength={3000} value={f.alternative ?? ""} onChange={(e) => set("alternative", e.target.value)} /></Field>
            <Button variant="soft" onClick={() => void suggest()} disabled={sugBusy}>{sugBusy ? "Thinking…" : "Offer some possibilities (optional)"}</Button>
            {sug?.safety_message && (
              <div className="rounded-2xl border border-[#e7cfb4] bg-care-bg p-4 text-care">
                <p className="whitespace-pre-wrap">{sug.safety_message}</p>
                {sug.resources && <div className="mt-3 text-ink"><ResourceList data={sug.resources} /></div>}
              </div>
            )}
            {!!sug?.suggestions.length && (
              <div>
                <p className="mb-2 text-sm text-muted">{sug.mock_mode ? "Reflection prompts (not AI-generated). " : "AI-generated. "}{sug.note}</p>
                <ul className="space-y-2">
                  {sug.suggestions.map((t) => (
                    <li key={t} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-mist p-3">
                      <span className="min-w-0 flex-1">{t}</span>
                      <span className="flex gap-1">
                        <Button variant="soft" onClick={() => set("alternative", `${f.alternative ? f.alternative + "\n" : ""}${t}`)}>Use</Button>
                        <Button variant="ghost" onClick={() => setSug({ ...sug, suggestions: sug.suggestions.filter((x) => x !== t) })}>Dismiss</Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
      <ErrorLine message={error} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => (step === 0 ? onClose(false) : setStep(step - 1))}>{step === 0 ? "Cancel" : "Back"}</Button>
        <div className="flex flex-wrap gap-3">
          {!last && <Button variant="soft" onClick={() => setStep(step + 1)}>Skip</Button>}
          {!last && <Button onClick={() => setStep(step + 1)}>Next</Button>}
          <Button variant={last ? "primary" : "soft"} onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save entry"}</Button>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">This is a self-reflection exercise inspired by CBT. It isn't treatment, and it won't label or diagnose you.</p>
    </Card>
  );
}
