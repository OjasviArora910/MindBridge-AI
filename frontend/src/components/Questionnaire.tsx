import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type Resources } from "../api";
import { useLoad } from "../hooks";
import { ResourceList } from "./Support";
import { Button, ErrorLine, Notice, Spinner } from "./ui";

interface Questions { id: string; title: string; source: string; stem: string; reviewed: boolean; items: string[]; options: string[] }
interface Result {
  questionnaire_result: { total: number; max: number; band: string; band_text: string; next_steps: string };
  reviewed: boolean;
  disclaimer: string;
  safety: { level: "urgent" | "support"; message: string | null; resources: Resources } | null;
}

export const UNREVIEWED_NOTE =
  "Prototype: the questions and scoring follow the official source, but the result wording hasn't been reviewed by a clinician yet.";

/** Runs one registered questionnaire and shows its fixed, rule-based result. */
export function Questionnaire({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useLoad(() => api<Questions>(`/assessments/${id}`));
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (q.loading) return <Spinner />;
  if (q.error || !q.data) return <p className="mt-2 text-care">{q.error ?? "This questionnaire isn't available."}</p>;
  const data = q.data;
  const filled = data.items.map((_, i) => answers[i] ?? null);
  const done = filled.every((a) => a !== null);

  async function submit() {
    if (!done) { setError("Please answer every question."); return; }
    setBusy(true); setError(null);
    try {
      setResult(await api<Result>(`/assessments/${id}/attempts`, { method: "POST", json: { answers: filled } }));
    } catch (e) { setError(e instanceof ApiError ? e.message : "We couldn't save that. Please try again."); }
    finally { setBusy(false); }
  }

  if (result) {
    const r = result.questionnaire_result;
    return (
      <div className="mt-4 space-y-4" aria-live="polite">
        {result.safety?.level === "urgent" && (
          <div className="rounded-2xl border border-[#e7cfb4] bg-care-bg p-4 text-care" role="alert">
            <p className="font-semibold">{result.safety.message}</p>
            <div className="mt-3 text-ink"><ResourceList data={result.safety.resources} /></div>
          </div>
        )}
        <div className="rounded-2xl bg-mist p-4">
          <p className="text-sm text-muted">{data.title} result</p>
          <p className="mt-1 text-lg font-semibold text-deep">{r.band_text}</p>
          <p className="mt-2">{r.next_steps}</p>
        </div>
        {result.safety?.level === "support" && (
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="mb-3 font-semibold">Support options</p>
            <ResourceList data={result.safety.resources} />
          </div>
        )}
        <p className="text-sm text-muted">{result.disclaimer}</p>
        {!result.reviewed && <Notice>{UNREVIEWED_NOTE}</Notice>}
        <p className="text-sm text-muted">
          If personalization is on, the chat uses this result (only the range, never your answers) to adjust its tone for two weeks.{" "}
          <Link to="/app/settings" className="underline underline-offset-2">Privacy controls</Link>
        </p>
        <Button variant="soft" onClick={onClose}>Done</Button>
      </div>
    );
  }

  return (
    <form className="mt-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {!data.reviewed && <Notice>{UNREVIEWED_NOTE}</Notice>}
      <p className="mt-4 font-medium">{data.stem}</p>
      <ol className="mt-3 space-y-4">
        {data.items.map((item, i) => (
          <li key={i}>
            <fieldset className="rounded-2xl border border-line p-4">
              <legend className="px-1 font-medium">{i + 1}. {item}</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {data.options.map((opt, v) => (
                  <label key={opt} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 hover:bg-mist">
                    <input type="radio" name={`q${i}`} className="h-5 w-5 accent-[#35566f]" checked={filled[i] === v}
                      onChange={() => setAnswers(() => { const next = [...filled]; next[i] = v; return next; })} />
                    {opt}
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <ErrorLine message={error} />
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="submit" disabled={busy || !done}>See my result</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
      <p className="mt-3 text-xs text-muted">Source: {data.source}</p>
    </form>
  );
}
