import { useState } from "react";
import { Button, Card, Notice, PageTitle } from "../components/ui";
import { ExerciseRunner } from "../sos/ExerciseRunner";
import { exercises, type Exercise } from "../sos/exercises";

/** Works with no account, no network and no LLM. */
export function Sos({ initialId, standalone = false }: { initialId?: string; standalone?: boolean }) {
  const [active, setActive] = useState<Exercise | null>(exercises.find((e) => e.id === initialId) ?? null);
  const [note, setNote] = useState<string | null>(null);

  return (
    <div>
      <PageTitle title="SOS exercises" intro="Short, guided pauses you can do anywhere. Pick one that feels okay right now. You can stop at any time." />
      {note && <div className="mb-4"><Notice>{note}</Notice></div>}
      <ul className="grid gap-4 sm:grid-cols-2">
        {exercises.map((ex) => (
          <li key={ex.id}>
            <Card as="article" className="flex h-full flex-col">
              <h2 className="text-lg font-semibold text-deep">{ex.title}</h2>
              <p className="mt-1 flex-1 text-muted">{ex.blurb}</p>
              <p className="mt-2 text-sm text-muted">{ex.minutes}</p>
              <Button className="mt-4 self-start" onClick={() => { setNote(null); setActive(ex); }} aria-label={`Start ${ex.title}`}>Start</Button>
            </Card>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">
        These are general relaxation techniques. They don't treat any condition and can't resolve a crisis.
        If you need support right now, use the “Support” button{standalone ? " in the app" : ""}.
      </p>
      {active && (
        <ExerciseRunner exercise={active} onExit={(reason) => {
          setActive(null);
          if (reason === "uncomfortable") setNote("That's completely okay. Stopping was the right call. You could try a different exercise below, or just rest for a moment.");
        }} />
      )}
    </div>
  );
}
