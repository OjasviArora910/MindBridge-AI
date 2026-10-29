import { useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import { ChartIcon, ChatIcon, DiaryIcon, HomeIcon, LifeIcon, Logo, MoodIcon, SettingsIcon, SosIcon } from "./icons";
import { SupportDialog } from "./Support";

const items: { to: string; label: string; short: string; icon: ReactNode; end?: boolean }[] = [
  { to: "/app", label: "Home", short: "Home", icon: <HomeIcon />, end: true },
  { to: "/app/talk", label: "Talk to MindBridge", short: "Talk", icon: <ChatIcon /> },
  { to: "/app/mood", label: "Mood & Sleep", short: "Mood", icon: <MoodIcon /> },
  { to: "/app/diary", label: "Thought Diary", short: "Diary", icon: <DiaryIcon /> },
  { to: "/app/sos", label: "SOS Exercises", short: "SOS", icon: <SosIcon /> },
  { to: "/app/progress", label: "My Progress", short: "Progress", icon: <ChartIcon /> },
  { to: "/app/settings", label: "Settings & Privacy", short: "Settings", icon: <SettingsIcon /> },
];

const linkCls = (active: boolean) =>
  active ? "bg-mist font-semibold text-deep" : "text-ink hover:bg-mist/70";

export function Layout() {
  const { user, setUser } = useAuth();
  const [support, setSupport] = useState(false);

  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>

      {/* Desktop navigation rail */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <Logo /><span className="text-lg font-semibold text-deep">MindBridge AI</span>
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end}
              className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 ${linkCls(isActive)}`}>
              {i.icon}{i.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={() => setSupport(true)}
          className="flex min-h-11 items-center gap-3 rounded-xl border border-[#e7cfb4] bg-care-bg px-3 py-2 text-left font-medium text-care">
          <LifeIcon />Need support now?
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">
        {/* Mobile top bar keeps support one tap away */}
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 md:hidden">
          <span className="flex items-center gap-2 font-semibold text-deep"><Logo size={28} />MindBridge AI</span>
          <button onClick={() => setSupport(true)}
            className="flex min-h-11 items-center gap-2 rounded-full border border-[#e7cfb4] bg-care-bg px-4 text-sm font-medium text-care">
            <LifeIcon />Support
          </button>
        </header>
        <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-8 sm:py-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white md:hidden">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} aria-label={i.label}
            className={({ isActive }) => `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${linkCls(isActive)}`}>
            {i.icon}<span>{i.short}</span>
          </NavLink>
        ))}
      </nav>

      {support && <SupportDialog user={user} onUserChange={setUser} onClose={() => setSupport(false)} />}
    </div>
  );
}
