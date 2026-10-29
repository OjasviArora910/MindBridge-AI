import { useState } from "react";
import { api } from "../api";
import { useLoad } from "../hooks";
import { Button } from "./ui";

interface CalData { month: string; days: Record<string, { id: number; mood_rating: number; sleep_hours: number | null }> }

const pad = (n: number) => String(n).padStart(2, "0");
const shade = (r: number) => (r <= 3 ? "bg-[#d8cdbf]" : r <= 6 ? "bg-[#bcd3e4]" : "bg-[#a8bfa8]"); // neutral, no red/green "good/bad"

export function Calendar({ selected, onSelect, refreshKey = 0 }: { selected?: string; onSelect?: (iso: string) => void; refreshKey?: number }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const month = `${ym.y}-${pad(ym.m + 1)}`;
  const { data, error, loading } = useLoad(() => api<CalData>(`/mood/calendar?month=${month}`), [month, refreshKey]);

  const first = new Date(ym.y, ym.m, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const count = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const title = first.toLocaleString("en", { month: "long", year: "numeric" });
  const shift = (d: number) => setYm((p) => { const t = new Date(p.y, p.m + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" onClick={() => shift(-1)} aria-label="Previous month">‹</Button>
        <h3 className="font-semibold text-deep" aria-live="polite">{title}</h3>
        <Button variant="ghost" onClick={() => shift(1)} aria-label="Next month">›</Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted" aria-hidden="true">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label={`Check-ins for ${title}`}>
        {cells.map((d, i) => {
          if (d === null) return <span key={`b${i}`} />;
          const iso = `${month}-${pad(d)}`;
          const entry = data?.days[iso];
          return (
            <button key={iso} role="gridcell" onClick={() => onSelect?.(iso)}
              aria-label={entry ? `${iso}, mood ${entry.mood_rating} out of 10` : `${iso}, no check-in`}
              aria-current={selected === iso ? "date" : undefined}
              className={`flex aspect-square min-h-10 items-center justify-center rounded-xl text-sm ${entry ? shade(entry.mood_rating) : "bg-paper"} ${selected === iso ? "ring-2 ring-deep" : ""} text-ink`}>
              {d}
            </button>
          );
        })}
      </div>
      {loading && <p role="status" className="mt-2 text-xs text-muted">Loading…</p>}
      {error && <p role="alert" className="mt-2 text-xs text-care">{error}</p>}
      <p className="mt-3 text-xs text-muted">Shading shows the rating you gave (lighter sand for lower, sage for higher). Tap a day to see or add a check-in.</p>
    </div>
  );
}
