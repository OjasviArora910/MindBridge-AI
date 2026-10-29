import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type Mood } from "../api";
import { Calendar } from "../components/Calendar";
import { Button, Card, Chip, ErrorLine, Field, Notice, PageTitle, Spinner, inputCls } from "../components/ui";
import { MOOD_FEELINGS } from "../content";
import { todayISO, useLoad } from "../hooks";

interface Form { rating: number | null; feelings: string[]; note: string; triggers: string; sleepHours: string; sleepQuality: number | null }
const blank: Form = { rating: null, feelings: [], note: "", triggers: "", sleepHours: "", sleepQuality: null };

const fromEntry = (m: Mood): Form => ({
  rating: m.mood_rating, feelings: m.feelings, note: m.note ?? "", triggers: m.triggers ?? "",
  sleepHours: m.sleep_hours?.toString() ?? "", sleepQuality: m.sleep_quality,
});

export function MoodPage() {
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState<Form>(blank);
  const [existing, setExisting] = useState<Mood | null>(null);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [bump, setBump] = useState(0);

  const list = useLoad(() => api<Mood[]>("/mood"), [bump]);

  // When the selected date or list changes, load that day's entry into the form.
  useEffect(() => {
    if (!list.data) return;
    const e = list.data.find((m) => m.entry_date === date) ?? null;
    setExisting(e); setForm(e ? fromEntry(e) : blank); setSaved(false);
  }, [date, list.data]);

  const toggle = (f: string) => setForm((p) => ({ ...p, feelings: p.feelings.includes(f) ? p.feelings.filter((x) => x !== f) : [...p.feelings, f] }));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.rating) { setError("Choose a rating from 1 to 10 first. You can skip everything else."); return; }
    setBusy(true); setError(null); setSaved(false);
    const body = {
      entry_date: date, mood_rating: form.rating, feelings: form.feelings,
      note: form.note.trim() || null, triggers: form.triggers.trim() || null,
      sleep_hours: form.sleepHours === "" ? null : Number(form.sleepHours), sleep_quality: form.sleepQuality,
    };
    try {
      await (existing ? api(`/mood/${existing.id}`, { method: "PUT", json: body }) : api("/mood", { method: "POST", json: body }));
      setSaved(true); setBump((b) => b + 1);
    } catch (err) { setError(err instanceof ApiError ? err.message : "We couldn't save that. Please try again."); }
    finally { setBusy(false); }
  }

  async function remove(m: Mood) {
    if (!window.confirm(`Delete the check-in for ${m.entry_date}?`)) return;
    try { await api(`/mood/${m.id}`, { method: "DELETE" }); setBump((b) => b + 1); if (m.entry_date === date) { setForm(blank); setExisting(null); } }
    catch (err) { setError(err instanceof ApiError ? err.message : "We couldn't delete that."); }
  }

  const feelingOptions = [...MOOD_FEELINGS, ...form.feelings.filter((f) => !(MOOD_FEELINGS as readonly string[]).includes(f))];

  return (
    <div>
      <PageTitle title="Mood & Sleep" intro="A quick check-in, whenever you like. Everything except the rating is optional." />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card aria-labelledby="checkin-h">
          <h2 id="checkin-h" className="text-lg font-semibold text-deep">{existing ? "Edit check-in" : "Check-in"} · {date === todayISO() ? "today" : date}</h2>
          <form onSubmit={save} className="mt-4 space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">How are you feeling overall? <span className="text-muted">(1 = very low, 10 = very good)</span></legend>
              <div role="radiogroup" aria-label="Mood rating" className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <Chip key={n} role="radio" selected={form.rating === n} onClick={() => setForm({ ...form, rating: n })}><span className="block w-full text-center">{n}</span></Chip>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">What fits? <span className="text-muted">(optional)</span></legend>
              <div className="flex flex-wrap gap-2">
                {feelingOptions.map((f) => <Chip key={f} role="checkbox" selected={form.feelings.includes(f)} onClick={() => toggle(f)}>{f}</Chip>)}
              </div>
              <div className="mt-3 flex gap-2">
                <input aria-label="Add your own feeling" className={inputCls} value={custom} maxLength={40} placeholder="Add your own"
                  onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (custom.trim()) { toggle(custom.trim()); setCustom(""); } } }} />
                <Button type="button" variant="soft" onClick={() => { if (custom.trim()) { toggle(custom.trim()); setCustom(""); } }}>Add</Button>
              </div>
            </fieldset>

            <Field label="Anything you'd like to note? (optional)"><textarea className={inputCls} rows={3} maxLength={2000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            <Field label="Anything that happened today that's on your mind? (optional)" hint="We only record what you write. We won't assume it caused how you feel.">
              <input className={inputCls} maxLength={500} value={form.triggers} onChange={(e) => setForm({ ...form, triggers: e.target.value })} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hours slept last night (optional)">
                <input className={inputCls} type="number" min={0} max={24} step={0.25} inputMode="decimal" value={form.sleepHours} onChange={(e) => setForm({ ...form, sleepHours: e.target.value })} />
              </Field>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Sleep quality (optional)</legend>
                <div role="radiogroup" aria-label="Sleep quality" className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => <Chip key={n} role="radio" selected={form.sleepQuality === n} onClick={() => setForm({ ...form, sleepQuality: form.sleepQuality === n ? null : n })}>{n}</Chip>)}
                </div>
                <p className="mt-1 text-xs text-muted">1 = poor, 5 = restful</p>
              </fieldset>
            </div>

            <ErrorLine message={error} />
            {saved && <p role="status" className="text-sm font-medium text-deep">Saved. Thanks for checking in.</p>}
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : existing ? "Save changes" : "Save check-in"}</Button>
          </form>
        </Card>

        <Card aria-label="Calendar">
          <Calendar selected={date} onSelect={setDate} refreshKey={bump} />
          <Button variant="ghost" className="mt-3" onClick={() => setDate(todayISO())}>Back to today</Button>
        </Card>
      </div>

      <Card className="mt-6" aria-labelledby="recent-h">
        <h2 id="recent-h" className="text-lg font-semibold text-deep">Recent check-ins</h2>
        {list.loading && <Spinner />}
        {list.error && <Notice tone="care">{list.error}</Notice>}
        {list.data && list.data.length === 0 && <p className="mt-3 text-muted">No check-ins yet. When you add one, it'll show up here and in your trends.</p>}
        <ul className="mt-3 divide-y divide-line">
          {list.data?.slice(0, 14).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{m.entry_date} · {m.mood_rating}/10</p>
                <p className="text-sm text-muted">{[m.feelings.join(", "), m.sleep_hours != null ? `${m.sleep_hours} h sleep` : ""].filter(Boolean).join(" · ") || "No details added"}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" onClick={() => { setDate(m.entry_date); window.scrollTo?.({ top: 0 }); }} aria-label={`Edit ${m.entry_date}`}>Edit</Button>
                <Button variant="ghost" onClick={() => void remove(m)} aria-label={`Delete ${m.entry_date}`}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
