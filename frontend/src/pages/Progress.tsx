import { useState } from "react";
import { api, ApiError, type Dashboard, type Mood, type Thought } from "../api";
import { Calendar } from "../components/Calendar";
import { Questionnaire, UNREVIEWED_NOTE } from "../components/Questionnaire";
import { TrendCharts } from "../components/TrendCharts";
import { Button, Card, Chip, ErrorLine, Field, Notice, PageTitle, Spinner, inputCls } from "../components/ui";
import { useLoad } from "../hooks";

export function Progress() {
  const dash = useLoad(() => api<Dashboard>("/dashboard"));
  return (
    <div>
      <PageTitle title="My progress" intro="What you've logged, shown plainly. These are your own ratings, not scores or conclusions about you." />
      <Card aria-labelledby="trend-h">
        <h2 id="trend-h" className="text-lg font-semibold text-deep">Trends (last 30 days)</h2>
        {dash.loading && <Spinner />}
        {dash.error && <div className="mt-3"><Notice tone="care">{dash.error}</Notice></div>}
        {dash.data && !dash.data.has_data && <p className="mt-2 text-muted">No check-ins yet. Add one in Mood & Sleep and your trends will appear here.</p>}
        {dash.data?.has_data && (
          <>
            <ul className="mt-2 space-y-1">{dash.data.summaries.map((s) => <li key={s}>{s}</li>)}</ul>
            <div className="mt-4"><TrendCharts series={dash.data.series} /></div>
          </>
        )}
      </Card>

      <Card className="mt-6" aria-label="Monthly calendar"><h2 className="mb-3 text-lg font-semibold text-deep">Calendar</h2><Calendar /></Card>
      <Assessments />
      <Reports />
    </div>
  );
}

interface AssessList { available: { id: string; title: string; reviewed: boolean }[]; planned: { id: string; title: string; reason: string }[]; disclaimer: string }

function Assessments() {
  const { data, error, loading } = useLoad(() => api<AssessList>("/assessments"));
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card className="mt-6" aria-labelledby="as-h">
      <h2 id="as-h" className="text-lg font-semibold text-deep">Self-assessments</h2>
      {loading && <Spinner />}
      {error && <p className="mt-2 text-care">{error}</p>}
      {data && (
        <>
          <p className="mt-2 text-muted">Questionnaires give self-reflection information, not a diagnosis. Your result comes from fixed scoring rules, not from the AI. If personalization is on, the chat uses only the result range to adjust its tone.</p>
          {data.available.length === 0 && <p className="mt-3">None are available yet. Each one is added only after its wording, scoring and guidance have been verified and reviewed by qualified professionals.</p>}
          {open ? <Questionnaire id={open} onClose={() => setOpen(null)} /> : (
            <ul className="mt-3 space-y-2">
              {data.available.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-white px-4 py-3">
                  <span><span className="font-medium">{a.title}</span>{!a.reviewed && <span className="text-sm text-muted"> · prototype, not clinically reviewed</span>}</span>
                  <Button variant="soft" onClick={() => setOpen(a.id)}>Start</Button>
                </li>
              ))}
            </ul>
          )}
          {!open && data.available.some((a) => !a.reviewed) && <p className="mt-2 text-xs text-muted">{UNREVIEWED_NOTE}</p>}
          <ul className="mt-3 space-y-2">
            {data.planned.map((p) => <li key={p.id} className="rounded-2xl bg-mist px-4 py-3"><span className="font-medium">{p.title}</span> <span className="text-sm text-muted">· not available yet</span></li>)}
          </ul>
        </>
      )}
    </Card>
  );
}

const SECTIONS = [
  { key: "mood", label: "Mood trends" }, { key: "sleep", label: "Sleep logs" }, { key: "reflections", label: "Personal notes" },
  { key: "thoughts", label: "Thought diary entries" }, { key: "questions", label: "Questions I want to explore" },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

function Reports() {
  const [sections, setSections] = useState<SectionKey[]>(["mood"]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [questions, setQuestions] = useState("");
  const [exMood, setExMood] = useState<number[]>([]);
  const [exThought, setExThought] = useState<number[]>([]);
  const [text, setText] = useState<string | null>(null);
  const [printed, setPrinted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moods = useLoad(() => api<Mood[]>("/mood"));
  const thoughts = useLoad(() => api<Thought[]>("/diary"));

  const toggle = (k: SectionKey) => setSections((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const flip = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function preview() {
    if (!sections.length) { setError("Choose at least one section to include."); return; }
    setBusy(true); setError(null);
    try {
      const r = await api<{ text: string }>("/reports/preview", { method: "POST", json: {
        sections, date_from: from || null, date_to: to || null, exclude_mood_ids: exMood, exclude_thought_ids: exThought,
        questions: questions.split("\n").map((q) => q.trim()).filter(Boolean) } });
      setText(r.text);
    } catch (e) { setError(e instanceof ApiError ? e.message : "We couldn't prepare that. Please try again."); }
    finally { setBusy(false); }
  }

  async function approve(mode: "download" | "print") {
    if (!text) return;
    setBusy(true); setError(null);
    try {
      const r = await api<{ filename: string; text: string }>("/reports/export", { method: "POST", json: { approved_text: text, sections, entry_count: (moods.data?.length ?? 0) - exMood.length } });
      if (mode === "download") {
        const url = URL.createObjectURL(new Blob([r.text], { type: "text/plain" }));
        const a = document.createElement("a"); a.href = url; a.download = r.filename; a.click(); URL.revokeObjectURL(url);
      } else { setPrinted(r.text); setTimeout(() => window.print(), 50); }
    } catch (e) { setError(e instanceof ApiError ? e.message : "We couldn't export that. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <Card className="mt-6" aria-labelledby="rep-h">
      <h2 id="rep-h" className="text-lg font-semibold text-deep">Personal summary</h2>
      <p className="mt-2 text-muted">Build a summary you can keep or bring to a conversation with someone you trust or a professional. You choose what goes in, you can edit it, and nothing is sent anywhere. It's a self-reflection summary, not a clinical report.</p>

      <fieldset className="mt-4"><legend className="mb-2 text-sm font-medium">Include</legend>
        <div className="flex flex-wrap gap-2">{SECTIONS.map((s) => <Chip key={s.key} role="checkbox" selected={sections.includes(s.key)} onClick={() => toggle(s.key)}>{s.label}</Chip>)}</div>
      </fieldset>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="From (optional)"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To (optional)"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      {sections.includes("questions") && (
        <div className="mt-4"><Field label="Questions (one per line)"><textarea className={inputCls} rows={3} value={questions} onChange={(e) => setQuestions(e.target.value)} /></Field></div>
      )}

      {(sections.some((s) => ["mood", "sleep", "reflections"].includes(s)) && !!moods.data?.length) && (
        <details className="mt-4 rounded-2xl bg-mist p-4">
          <summary className="cursor-pointer font-medium">Leave out specific check-ins ({exMood.length} excluded)</summary>
          <ul className="mt-3 space-y-1">
            {moods.data!.map((m) => (
              <li key={m.id}><label className="flex min-h-9 items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[#35566f]" checked={exMood.includes(m.id)} onChange={() => setExMood(flip(exMood, m.id))} />{m.entry_date} · {m.mood_rating}/10</label></li>
            ))}
          </ul>
        </details>
      )}
      {(sections.includes("thoughts") && !!thoughts.data?.length) && (
        <details className="mt-3 rounded-2xl bg-mist p-4">
          <summary className="cursor-pointer font-medium">Leave out specific diary entries ({exThought.length} excluded)</summary>
          <ul className="mt-3 space-y-1">
            {thoughts.data!.map((t) => (
              <li key={t.id}><label className="flex min-h-9 items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[#35566f]" checked={exThought.includes(t.id)} onChange={() => setExThought(flip(exThought, t.id))} />{t.automatic_thought || t.situation || "Untitled"}</label></li>
            ))}
          </ul>
        </details>
      )}

      <ErrorLine message={error} />
      <Button className="mt-4" variant="soft" onClick={() => void preview()} disabled={busy}>Preview summary</Button>

      {text !== null && (
        <div className="mt-5">
          <Field label="Preview (you can edit this text before exporting)">
            <textarea className={`${inputCls} font-mono text-sm`} rows={14} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button onClick={() => void approve("download")} disabled={busy}>Approve & download (.txt)</Button>
            <Button variant="soft" onClick={() => void approve("print")} disabled={busy}>Approve & print / save as PDF</Button>
          </div>
        </div>
      )}
      {printed && <pre id="print-area" className="print-only whitespace-pre-wrap">{printed}</pre>}
    </Card>
  );
}
