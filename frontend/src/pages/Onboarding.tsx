import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Chip, ErrorLine } from "../components/ui";
import { CONCERNS, DURATIONS, FEELINGS, labelFor } from "../content";

interface Answers {
  stress_level: number | null;
  feelings: string[];
  main_concern: string | null;
  duration: string | null;
}
interface Saved extends Answers { saved: boolean; welcome_message: string }

const EMPTY: Answers = { stress_level: null, feelings: [], main_concern: null, duration: null };
const QUESTIONS = ["stress", "feelings", "concern", "duration"] as const;
type Q = (typeof QUESTIONS)[number];

export function Onboarding() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [step, setStep] = useState(0); // 0..3 questions, 4 = review & consent
  const [a, setA] = useState<Answers>(EMPTY);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<string | null>(null);

  // Editing later: start from what's saved
  useEffect(() => {
    api<Saved | null>("/onboarding").then((s) => {
      if (s) { setA({ stress_level: s.stress_level, feelings: s.feelings, main_concern: s.main_concern, duration: s.duration }); setConsent(true); }
    }).catch(() => undefined);
  }, []);

  const review = step === QUESTIONS.length;
  const q: Q | null = review ? null : QUESTIONS[step];

  async function finish() {
    if (consent === null) return;
    setBusy(true); setError(null);
    try {
      const res = await api<Saved>("/onboarding", { method: "PUT", json: { consent_to_save: consent, ...a } });
      await refresh();
      setWelcome(res.welcome_message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't save that. Please try again.");
    } finally { setBusy(false); }
  }

  if (welcome) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="fade-up">
          <p className="text-sm font-medium text-muted">MindBridge AI</p>
          <p className="mt-2 text-lg leading-relaxed">{welcome}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button onClick={() => nav("/app/talk")}>I want to talk</Button>
            <Button variant="soft" onClick={() => nav("/app/sos")}>Show me a calming exercise</Button>
            <Button variant="soft" onClick={() => nav("/app/diary")}>Help me organize my thoughts</Button>
          </div>
          <button className="mt-4 min-h-11 text-sm text-muted underline underline-offset-2" onClick={() => nav("/app")}>Not now, take me home</button>
        </Card>
      </div>
    );
  }

  const toggleFeeling = (k: string) => setA((p) => ({ ...p, feelings: p.feelings.includes(k) ? p.feelings.filter((f) => f !== k) : [...p.feelings, k] }));

  return (
    <div className="mx-auto max-w-xl">
      <p className="mb-2 text-sm text-muted" aria-live="polite">
        {review ? "Almost done" : `Question ${step + 1} of ${QUESTIONS.length}`}
      </p>
      <div role="progressbar" aria-label="Onboarding progress" aria-valuemin={0} aria-valuemax={QUESTIONS.length + 1} aria-valuenow={step + 1}
        className="mb-6 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-sage transition-all" style={{ width: `${((step + 1) / (QUESTIONS.length + 1)) * 100}%` }} />
      </div>

      <Card>
        {q === "stress" && (
          <fieldset>
            <legend className="text-xl font-semibold text-deep">How intense does your stress or emotional discomfort feel right now?</legend>
            <p className="mt-2 text-sm text-muted">1 means very mild and 10 means extremely intense. This is your own rating. It isn't a clinical score or a diagnosis.</p>
            <div role="radiogroup" aria-label="Intensity from 1 to 10" className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <Chip key={n} role="radio" selected={a.stress_level === n} onClick={() => setA({ ...a, stress_level: n })}>
                  <span className="block w-full text-center">{n}</span>
                </Chip>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted"><span>Very mild</span><span>Extremely intense</span></div>
          </fieldset>
        )}

        {q === "feelings" && (
          <fieldset>
            <legend className="text-xl font-semibold text-deep">What have you been feeling lately? Choose any that fit.</legend>
            <div className="mt-5 flex flex-wrap gap-2">
              {FEELINGS.map((f) => <Chip key={f.key} role="checkbox" selected={a.feelings.includes(f.key)} onClick={() => toggleFeeling(f.key)}>{f.label}</Chip>)}
            </div>
          </fieldset>
        )}

        {q === "concern" && (
          <fieldset>
            <legend className="text-xl font-semibold text-deep">What do you think is affecting you most?</legend>
            <div role="radiogroup" className="mt-5 flex flex-wrap gap-2">
              {CONCERNS.map((c) => <Chip key={c.key} role="radio" selected={a.main_concern === c.key} onClick={() => setA({ ...a, main_concern: c.key })}>{c.label}</Chip>)}
            </div>
          </fieldset>
        )}

        {q === "duration" && (
          <fieldset>
            <legend className="text-xl font-semibold text-deep">How long have you been feeling this way? <span className="text-base font-normal text-muted">(optional)</span></legend>
            <div role="radiogroup" className="mt-5 flex flex-wrap gap-2">
              {DURATIONS.map((d) => <Chip key={d.key} role="radio" selected={a.duration === d.key} onClick={() => setA({ ...a, duration: d.key })}>{d.label}</Chip>)}
            </div>
          </fieldset>
        )}

        {review && (
          <div>
            <h1 className="text-xl font-semibold text-deep">Here's what you shared</h1>
            <p className="mt-1 text-sm text-muted">Skipped anything? That's fine. You can edit any answer.</p>
            <dl className="mt-4 divide-y divide-line">
              {([
                [0, "Intensity", a.stress_level ? `${a.stress_level} out of 10` : "Skipped"],
                [1, "Feelings", a.feelings.length ? a.feelings.map((f) => labelFor(FEELINGS, f)).join(", ") : "Skipped"],
                [2, "Main concern", labelFor(CONCERNS, a.main_concern) || "Skipped"],
                [3, "How long", labelFor(DURATIONS, a.duration) || "Skipped"],
              ] as [number, string, string][]).map(([i, label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 py-3">
                  <div><dt className="text-sm text-muted">{label}</dt><dd>{value}</dd></div>
                  <Button variant="ghost" onClick={() => setStep(i)} aria-label={`Edit ${label}`}>Edit</Button>
                </div>
              ))}
            </dl>

            <fieldset className="mt-5 rounded-2xl bg-mist p-4">
              <legend className="px-1 text-base font-semibold text-deep">How should we use this?</legend>
              <p className="mb-3 text-sm text-muted">Your answers only help tailor suggestions and the conversation. They aren't used to label or diagnose you, and they're never used to train models.</p>
              <div role="radiogroup" aria-label="Saving choice" className="flex flex-col gap-2">
                <Chip role="radio" selected={consent === true} onClick={() => setConsent(true)}>Save my answers to personalize MindBridge</Chip>
                <Chip role="radio" selected={consent === false} onClick={() => setConsent(false)}>Use them for this welcome only. Don't save</Chip>
              </div>
              <p className="mt-3 text-xs text-muted">You can review, change or delete saved answers any time in Settings & Privacy.</p>
            </fieldset>
            <ErrorLine message={error} />
          </div>
        )}
      </Card>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
        <div className="flex gap-3">
          {!review && <Button variant="soft" onClick={() => setStep(step + 1)}>Skip</Button>}
          {!review
            ? <Button onClick={() => setStep(step + 1)}>Continue</Button>
            : <Button onClick={() => void finish()} disabled={consent === null || busy}>{busy ? "Saving…" : "Finish"}</Button>}
        </div>
      </div>
      {review && consent === null && <p className="mt-2 text-right text-sm text-muted">Choose how we should use your answers to continue.</p>}
    </div>
  );
}
