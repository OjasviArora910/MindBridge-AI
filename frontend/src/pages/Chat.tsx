import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type ChatReply, type Resources } from "../api";
import { useAuth } from "../auth";
import { MicIcon } from "../components/icons";
import { ResourceList, ResourcesLoader } from "../components/Support";
import { Button, Card, ErrorLine, Notice, PageTitle } from "../components/ui";
import { useDictation } from "../voice/useDictation";

interface Msg {
  role: "user" | "assistant";
  content: string;
  ai: boolean; // true only for model-generated text
  safetyResources?: Resources | null;
  suggestions?: ChatReply["suggestions"];
}

const PROMPTS = ["I want to talk", "Help me organize my thoughts", "Show me a calming exercise"];

export function Chat() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [convId, setConvId] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mock, setMock] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const voice = useDictation(text, setText);

  useEffect(() => {
    api<{ message: string }>("/chat/welcome")
      .then((w) => setMsgs([{ role: "assistant", content: w.message, ai: false }]))
      .catch(() => setMsgs([{ role: "assistant", content: "Hi. This is a space to talk, reflect, or take a pause. What would you like to do?", ai: false }]));
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: "end" }); }, [msgs, busy]);

  async function send(content: string) {
    const message = content.trim();
    if (!message || busy) return;
    voice.stop();
    setError(null); setText(""); setBusy(true);
    const history = msgs.filter((m) => m.ai || m.role === "user").slice(-10).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: message, ai: false }]);
    try {
      const r = await api<ChatReply>("/chat", { method: "POST", json: { message, conversation_id: convId, history } });
      setConvId(r.conversation_id);
      if (r.mock_mode) setMock(true);
      setMsgs((m) => [...m, { role: "assistant", content: r.reply, ai: r.ai_generated, safetyResources: r.resources, suggestions: r.suggestions }]);
    } catch (e) {
      // Never invent a reply when the request fails.
      setError(e instanceof ApiError ? e.message : "That message didn't go through. Please try again.");
      setMsgs((m) => m.slice(0, -1));
      setText(message);
    } finally { setBusy(false); }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); }
  };

  async function clear() {
    if (convId !== null) { try { await api(`/chat/conversations/${convId}`, { method: "DELETE" }); } catch { /* local clear still happens */ } }
    setConvId(null); setMsgs((m) => m.slice(0, 1)); setError(null);
  }

  return (
    <div>
      <PageTitle title="Talk to MindBridge" />
      <div className="mb-4 space-y-3">
        <Notice>
          You're chatting with an AI, not a person or a therapist. {user?.save_chat_history
            ? "This conversation is being saved because you turned history on."
            : "This conversation isn't being saved."}{" "}
          <Link to="/app/settings" className="underline underline-offset-2">Privacy controls</Link>
        </Notice>
        {mock && <Notice>Development mock mode: replies come from a simple rule-based stand-in, not a real language model.</Notice>}
      </div>

      <Card className="min-h-[40vh]" aria-label="Conversation">
        <ol className="space-y-4" aria-live="polite">
          {msgs.map((m, i) => (
            <li key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] sm:max-w-[80%] ${m.role === "user" ? "" : "w-full max-w-[88%] sm:max-w-[80%]"}`}>
                <p className={`mb-1 text-xs text-muted ${m.role === "user" ? "text-right" : ""}`}>
                  {m.role === "user" ? "You" : m.ai ? "MindBridge · AI-generated" : "MindBridge · automated message"}
                </p>
                <div className={`whitespace-pre-wrap rounded-2xl px-4 py-3 leading-relaxed ${m.role === "user" ? "bg-deep text-white" : "bg-mist text-ink"}`}>
                  {m.content}
                </div>
                {m.safetyResources && (
                  <div className="mt-3 rounded-2xl border border-[#e7cfb4] bg-care-bg p-4 text-care">
                    <p className="mb-3 font-semibold">Support options</p>
                    <div className="text-ink"><ResourceListForChat data={m.safetyResources} /></div>
                  </div>
                )}
                {!!m.suggestions?.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.suggestions.map((s) => (
                      <Button key={s.label} variant="soft" onClick={() => nav(s.type === "sos" ? `/app/sos?start=${s.id}` : s.type === "diary" ? "/app/diary" : "/app/mood")}>{s.label}</Button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
          {busy && <li className="text-sm text-muted" role="status">MindBridge is thinking…</li>}
        </ol>
        <div ref={endRef} />
      </Card>

      <div className="sticky bottom-14 mt-4 bg-paper pb-3 pt-2 md:bottom-0">
        {msgs.length <= 1 && (
          <div className="mb-3 flex flex-wrap gap-2" aria-label="Suggested prompts">
            {PROMPTS.map((p) => <Button key={p} variant="soft" onClick={() => void send(p)} disabled={busy}>{p}</Button>)}
          </div>
        )}
        <ErrorLine message={error} />
        <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="flex items-end gap-2">
          <label className="sr-only" htmlFor="composer">Message</label>
          <textarea id="composer" rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} maxLength={4000}
            placeholder="Write whatever is on your mind…"
            className="min-h-14 flex-1 resize-none rounded-2xl border border-line bg-white px-4 py-3 text-ink placeholder:text-[#7b8b94]" />
          {voice.supported && (
            <Button type="button" variant={voice.listening ? "primary" : "soft"} onClick={voice.toggle} disabled={busy}
              aria-pressed={voice.listening} aria-label={voice.listening ? "Stop voice typing" : "Start voice typing"}
              title={voice.listening ? "Stop voice typing" : "Voice typing"} className={`px-3 ${voice.listening ? "animate-pulse" : ""}`}>
              <MicIcon />
            </Button>
          )}
          <Button type="submit" disabled={busy || !text.trim()}>Send</Button>
        </form>
        <ErrorLine message={voice.error} />
        {voice.listening && (
          <p className="mt-2 text-xs text-muted" role="status">
            Listening… your words appear in the box above. Nothing is sent until you press Send.
            Your browser's speech service turns audio into text (in Chrome and Edge this happens on Google or Microsoft servers).
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>Enter to send · Shift+Enter for a new line</span>
          <button className="min-h-9 underline underline-offset-2" onClick={() => void clear()}>Clear this conversation</button>
        </div>
      </div>
    </div>
  );
}

/** If the region isn't chosen yet, let the person pick one (we never guess). */
function ResourceListForChat({ data }: { data: Resources }) {
  const { user, setUser } = useAuth();
  return data.region_chosen
    ? <ResourceList data={data} />
    : <ResourcesLoader user={user} onUserChange={setUser} />;
}
