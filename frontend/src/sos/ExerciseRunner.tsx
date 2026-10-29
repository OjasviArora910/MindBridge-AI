import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui";
import type { Exercise } from "./exercises";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 528;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  } catch { /* sound is optional */ }
}

/** Full-screen guided exercise. Nothing starts until the person presses Begin. */
export function ExerciseRunner({ exercise, onExit }: { exercise: Exercise; onExit: (reason: "done" | "exit" | "uncomfortable") => void }) {
  const { steps } = exercise;
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(steps[0].seconds);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [sound, setSound] = useState(false); // off by default
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const reduced = prefersReducedMotion();
  const beginRef = useRef<HTMLButtonElement>(null);

  const total = steps.reduce((n, s) => n + s.seconds, 0);
  const elapsed = steps.slice(0, idx).reduce((n, s) => n + s.seconds, 0) + (steps[idx].seconds - left);

  function goTo(next: number) {
    if (next >= steps.length) { setDone(true); setRunning(false); if (soundRef.current) chime(); return; }
    setIdx(next);
    setLeft(steps[next].seconds);
    if (soundRef.current) chime();
  }

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (running && left <= 0) goTo(idx + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, running]);

  useEffect(() => { beginRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onExit("exit"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const step = steps[idx];
  const phase = step.phase;
  // Pausing freezes the animation in place; reduced-motion users get a static circle plus the countdown.
  const scale = reduced || (phase !== "in" && phase !== "out") ? undefined : {
    animation: `${phase === "out" ? "breathe-out" : "breathe-in"} ${step.seconds}s ease-in-out forwards`,
    animationPlayState: running ? ("running" as const) : ("paused" as const),
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={exercise.title}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-mint px-5 py-6 text-ink">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-deep">{exercise.title}</h2>
          <Button variant="soft" onClick={() => onExit("exit")}>Exit</Button>
        </div>

        {done ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <p className="text-2xl font-semibold text-deep">Thanks for taking a pause.</p>
            <p className="max-w-sm text-muted">Notice how you feel now, whatever that is. You can repeat this, try another exercise, or go back to what you were doing.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => onExit("done")}>Finish</Button>
              <Button variant="soft" onClick={() => { setDone(false); setIdx(0); setLeft(steps[0].seconds); setStarted(false); }}>Do it again</Button>
            </div>
          </div>
        ) : !started ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <p className="max-w-sm text-lg">{exercise.blurb}</p>
            <p className="text-muted">{exercise.minutes}. You're in control: pause, skip or exit at any time.</p>
            {exercise.caution && <p className="max-w-sm rounded-2xl bg-white px-4 py-3 text-sm text-muted">{exercise.caution}</p>}
            <Button ref={beginRef} onClick={() => { setStarted(true); setRunning(true); }}>Begin</Button>
            <p className="max-w-sm text-xs text-muted">General relaxation technique. It isn't a treatment for any condition and can't resolve a crisis. If you need support now, use the Support button.</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <div aria-hidden="true" className="flex h-56 w-56 items-center justify-center">
              <div key={idx} style={scale}
                className="flex h-48 w-48 items-center justify-center rounded-full bg-blue/50 ring-8 ring-sage/40">
                <span className="text-5xl font-semibold tabular-nums text-deep">{Math.max(left, 0)}</span>
              </div>
            </div>
            <div aria-live="polite">
              <p className="text-2xl font-semibold text-deep">{step.title}</p>
              <p className="mx-auto mt-2 max-w-sm text-lg">{step.text}</p>
            </div>
            <p className="sr-only" role="timer">{Math.max(left, 0)} seconds left in this step</p>
            <div className="w-full max-w-sm">
              <div className="h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={elapsed} aria-label="Exercise progress">
                <div className="h-full rounded-full bg-deep transition-all" style={{ width: `${(elapsed / total) * 100}%` }} />
              </div>
              <p className="mt-1 text-sm text-muted">Step {idx + 1} of {steps.length}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Resume"}</Button>
              <Button variant="soft" onClick={() => goTo(idx + 1)}>Skip step</Button>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="h-5 w-5 accent-[#35566f]" />
              Soft chime between steps
            </label>
            <Button variant="ghost" onClick={() => onExit("uncomfortable")}>This feels uncomfortable. Stop and choose another</Button>
          </div>
        )}
      </div>
    </div>
  );
}
