import { useState } from "react";
import { Link, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { SupportDialog } from "./components/Support";
import { Spinner } from "./components/ui";
import { Chat } from "./pages/Chat";
import { Diary } from "./pages/Diary";
import { Home } from "./pages/Home";
import { Landing } from "./pages/Landing";
import { MoodPage } from "./pages/Mood";
import { Onboarding } from "./pages/Onboarding";
import { Progress } from "./pages/Progress";
import { Settings } from "./pages/Settings";
import { Sos } from "./pages/Sos";
import { Start } from "./pages/Start";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/start" replace />;
  return <>{children}</>;
}

function SosRoute() {
  const [params] = useSearchParams();
  return <Sos initialId={params.get("start") ?? undefined} />;
}

/** Public calming exercises: no account, no network, no LLM needed. */
function Calm() {
  const { user } = useAuth();
  const [support, setSupport] = useState(false);
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="font-semibold text-deep">← MindBridge AI</Link>
        <button onClick={() => setSupport(true)} className="min-h-11 rounded-full border border-[#e7cfb4] bg-care-bg px-4 text-sm font-medium text-care">Need support now?</button>
      </div>
      <SosRoute />
      {support && <SupportDialog user={user} onClose={() => setSupport(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/start" element={<Start />} />
      <Route path="/calm" element={<Calm />} />
      <Route path="/app" element={<Protected><Layout /></Protected>}>
        <Route index element={<Home />} />
        <Route path="onboarding" element={<Onboarding />} />
        <Route path="talk" element={<Chat />} />
        <Route path="mood" element={<MoodPage />} />
        <Route path="diary" element={<Diary />} />
        <Route path="sos" element={<SosRoute />} />
        <Route path="progress" element={<Progress />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
