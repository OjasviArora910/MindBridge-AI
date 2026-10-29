import { useEffect, useRef, useState } from "react";
import { api, tokenStore, type Resources, type User } from "../api";
import { Button, Chip, Notice } from "./ui";

/** Shown if the resources request itself fails. Deliberately contains no phone numbers. */
const OFFLINE_TEXT =
  "We couldn't load the list just now. If you're in immediate danger, contact your local emergency number or go to the nearest emergency department. If you can, reach out to someone you trust and ask them to stay with you.";

export function ResourceList({ data, onRegion }: { data: Resources; onRegion?: (r: string) => void }) {
  return (
    <div>
      {!data.region_chosen && (
        <div className="mb-4">
          <p className="mb-2 text-sm text-muted">We don't guess where you are. Choose a region to see local options:</p>
          <div role="radiogroup" aria-label="Region" className="flex flex-wrap gap-2">
            {Object.entries(data.available_regions).map(([key, label]) => (
              <Chip key={key} role="radio" selected={false} onClick={() => onRegion?.(key)}>{label}</Chip>
            ))}
          </div>
        </div>
      )}
      {data.region_chosen && onRegion && (
        <p className="mb-3 text-sm text-muted">
          Showing options for {data.label}.{" "}
          <button className="underline underline-offset-2" onClick={() => onRegion("")}>Change region</button>
        </p>
      )}
      <ul className="space-y-3">
        {data.items.map((it) => (
          <li key={it.name} className="rounded-2xl border border-line bg-white p-4">
            <p className="font-medium text-deep">{it.name}</p>
            <p className="mt-0.5 text-lg font-semibold text-ink">{it.contact}</p>
            <p className="mt-1 text-sm text-muted">{it.note}</p>
            {!it.verified && (
              <p className="mt-2 text-xs font-medium text-care">Please double-check this number with the official source before relying on it.</p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">
        MindBridge AI is not an emergency service and can't contact anyone for you. If you're in immediate danger,
        contact your local emergency number. Reaching out to a trusted person can also help.
      </p>
    </div>
  );
}

/** Loads resources for the user's chosen region. Works signed-out too (region kept in memory only). */
export function ResourcesLoader({ user, onUserChange }: { user: User | null; onUserChange?: (u: User) => void }) {
  const [region, setRegion] = useState<string | null>(user?.region ?? null);
  const [data, setData] = useState<Resources | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    api<Resources>(`/safety/resources${region ? `?region=${region}` : ""}`)
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [region]);

  async function choose(r: string) {
    setRegion(r || null);
    if (user && tokenStore.get()) {
      try {
        const updated = await api<User>("/preferences", { method: "PATCH", json: { region: r || null } });
        onUserChange?.(updated);
      } catch { /* choosing still works for this view */ }
    }
  }

  if (failed) return <Notice tone="care">{OFFLINE_TEXT}</Notice>;
  if (!data) return <p role="status" className="text-muted">Loading support options…</p>;
  return <ResourceList data={data} onRegion={choose} />;
}

export function SupportDialog({ user, onUserChange, onClose }: { user: User | null; onUserChange?: (u: User) => void; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="support-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-soft sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="support-title" className="text-xl font-semibold text-deep">Support options</h2>
            <p className="mt-1 text-sm text-muted">You don't have to be in crisis to use these. Reaching out is always okay.</p>
          </div>
          <Button ref={closeRef} variant="soft" onClick={onClose}>Close</Button>
        </div>
        <ResourcesLoader user={user} onUserChange={onUserChange} />
      </div>
    </div>
  );
}
