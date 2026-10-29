import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { Logo } from "../components/icons";
import { SupportDialog } from "../components/Support";
import { Notice } from "../components/ui";

export function Landing() {
  const { user } = useAuth();
  const [support, setSupport] = useState(false);
  return (
    <div className="min-h-screen bg-gradient-to-b from-mist via-paper to-mint/60">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="flex items-center gap-3 text-lg font-semibold text-deep"><Logo />MindBridge AI</span>
        <button onClick={() => setSupport(true)} className="min-h-11 rounded-full border border-[#e7cfb4] bg-care-bg px-4 text-sm font-medium text-care">
          Need support now?
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-16 pt-10 text-center sm:pt-20">
        <h1 className="fade-up text-4xl font-semibold leading-tight tracking-tight text-deep sm:text-5xl">
          A space to pause, reflect, and feel heard.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
          MindBridge AI is a calm place to talk through what's on your mind, notice how you're feeling over time,
          and try gentle coping tools. It's emotional support and self-reflection, at your own pace.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to={user ? "/app" : "/start"} className="inline-flex min-h-12 items-center rounded-full bg-deep px-7 py-3 font-medium text-white hover:bg-[#2b475c]">
            Let's get started
          </Link>
          <Link to="/calm" className="inline-flex min-h-12 items-center rounded-full border border-line bg-white px-7 py-3 font-medium text-deep hover:bg-mist">
            Explore calming exercises
          </Link>
        </div>

        <div className="mx-auto mt-12 max-w-xl text-left">
          <Notice>
            <strong className="font-semibold">Good to know.</strong> MindBridge AI is an AI, not a therapist or a person, and it can't diagnose
            or treat anything. It isn't an emergency service. You choose what to save, and you can export or delete your data any time.
            If you're in immediate danger, contact your local emergency number.
          </Notice>
        </div>
      </main>
      {support && <SupportDialog user={user} onClose={() => setSupport(false)} />}
    </div>
  );
}
