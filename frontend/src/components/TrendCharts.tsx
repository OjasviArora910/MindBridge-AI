import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Dashboard } from "../api";

type Series = Dashboard["series"];
const short = (iso: string) => iso.slice(5); // MM-DD

/** Mood and sleep trends. Each chart has a text alternative for screen readers. */
export function TrendCharts({ series, compact = false }: { series: Series; compact?: boolean }) {
  const data = series.map((p) => ({ ...p, label: short(p.date) }));
  const hasSleep = data.some((d) => d.sleep_hours != null);
  const h = compact ? 160 : 220;
  const avg = data.length ? (data.reduce((n, d) => n + d.mood, 0) / data.length).toFixed(1) : null;

  return (
    <div className="space-y-6">
      <figure>
        <figcaption className="mb-2 text-sm font-medium text-ink">Mood rating (1–10, as you reported it)</figcaption>
        <div style={{ width: "100%", height: h }} role="img"
          aria-label={`Line chart of ${data.length} mood check-ins${avg ? `, average ${avg} out of 10` : ""}. A table of the same values follows.`}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#dce5e5" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#566872", fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis domain={[1, 10]} ticks={[1, 5, 10]} tick={{ fill: "#566872", fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="mood" name="Mood" stroke="#35566f" strokeWidth={2.5} dot={{ r: 3, fill: "#35566f" }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>

      {hasSleep && (
        <figure>
          <figcaption className="mb-2 text-sm font-medium text-ink">Hours of sleep (as you logged them)</figcaption>
          <div style={{ width: "100%", height: h }} role="img" aria-label="Bar chart of logged sleep hours. A table of the same values follows.">
            <ResponsiveContainer>
              <BarChart data={data.filter((d) => d.sleep_hours != null)} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="#dce5e5" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#566872", fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 12]} tick={{ fill: "#566872", fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="sleep_hours" name="Sleep (h)" fill="#8fb8d8" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      )}

      <table className="sr-only">
        <caption>Mood and sleep values</caption>
        <thead><tr><th>Date</th><th>Mood</th><th>Sleep hours</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.date}><td>{d.date}</td><td>{d.mood}</td><td>{d.sleep_hours ?? "not logged"}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
