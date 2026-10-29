import { Link } from "react-router-dom";
import { api, type Dashboard } from "../api";
import { TrendCharts } from "../components/TrendCharts";
import { Button, Card, Notice, PageTitle, Spinner } from "../components/ui";
import { useLoad } from "../hooks";

export function Home() {
  const { data, error, loading, reload } = useLoad(() => api<Dashboard>("/dashboard"));

  return (
    <div>
      <PageTitle title="Welcome back" intro="Take whatever you need from here. There's no right order." />
      {loading && <Spinner />}
      {error && (
        <Notice tone="care">
          {error} <button className="underline underline-offset-2" onClick={() => void reload()}>Try again</button>.
          Your tools below still work.
        </Notice>
      )}

      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <Card aria-labelledby="today-h">
          <h2 id="today-h" className="text-lg font-semibold text-deep">Today's check-in</h2>
          {data?.today
            ? <p className="mt-2 text-muted">You rated today {data.today.mood_rating}/10. You can add to it or change it any time.</p>
            : <p className="mt-2 text-muted">{data ? "You haven't checked in today. It takes under a minute." : "Add a quick check-in whenever you like."}</p>}
          <Link to="/app/mood" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-deep px-5 font-medium text-white hover:bg-[#2b475c]">
            {data?.today ? "View or edit" : "Check in"}
          </Link>
        </Card>

        <Card aria-labelledby="quick-h">
          <h2 id="quick-h" className="text-lg font-semibold text-deep">Where would you like to start?</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/app/talk" className="inline-flex min-h-11 items-center rounded-full border border-line bg-mist px-5 font-medium text-deep">Talk to MindBridge</Link>
            <Link to="/app/sos" className="inline-flex min-h-11 items-center rounded-full border border-line bg-mint px-5 font-medium text-deep">Calming exercises</Link>
            <Link to="/app/diary" className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-5 font-medium text-deep">Thought diary</Link>
          </div>
          {!!data?.suggested_starts.length && (
            <div className="mt-4">
              <p className="text-sm text-muted">Some ideas, only if they help:</p>
              <ul className="mt-1 list-disc pl-5 text-ink">{data.suggested_starts.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4" aria-labelledby="trend-h">
        <h2 id="trend-h" className="text-lg font-semibold text-deep">Your last few weeks</h2>
        {data && !data.has_data && <p className="mt-2 text-muted">No check-ins yet. Once you add some, you'll see how you've been reporting your mood and sleep here.</p>}
        {data?.has_data && (
          <>
            {!!data.summaries.length && <ul className="mt-2 space-y-1 text-ink">{data.summaries.map((s) => <li key={s}>{s}</li>)}</ul>}
            <div className="mt-4"><TrendCharts series={data.series.slice(-14)} compact /></div>
          </>
        )}
      </Card>

      <Card className="mt-4" aria-labelledby="recent-h">
        <h2 id="recent-h" className="text-lg font-semibold text-deep">Recent diary entries</h2>
        {data?.recent_thoughts.length === 0 && (
          <div className="mt-2"><p className="text-muted">Nothing yet. A diary entry can help when a thought keeps circling.</p>
            <Link to="/app/diary"><Button variant="soft" className="mt-3">Start an entry</Button></Link></div>
        )}
        <ul className="mt-2 divide-y divide-line">
          {data?.recent_thoughts.map((t) => (
            <li key={t.id} className="py-2">
              <p>{t.automatic_thought || t.situation || "Untitled entry"}</p>
              <p className="text-sm text-muted">{new Date(t.created_at).toLocaleDateString()}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
