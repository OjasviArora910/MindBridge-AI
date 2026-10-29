import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice typing via the browser's Web Speech API.
 * Speech becomes text in the message box only; nothing is sent until the person presses Send.
 * Note: Chrome and Edge process audio on Google/Microsoft servers. The UI says so.
 */

// Minimal typings: the Web Speech API isn't in TypeScript's DOM lib.
interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings to use voice typing.",
  "service-not-allowed": "Voice typing isn't allowed in this browser.",
  "audio-capture": "No microphone was found.",
  network: "Voice typing needs an internet connection.",
};

/**
 * @param text current message text
 * @param setText setter for the message text
 * @param lang BCP-47 language. Kept to English: safety checks only understand English for now.
 */
export function useDictation(text: string, setText: (t: string) => void, lang = "en-IN") {
  const Ctor = getCtor();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const base = useRef(""); // text that was in the box when listening started
  const finals = useRef(""); // confirmed speech so far

  const stop = useCallback(() => { rec.current?.stop(); }, []);

  const start = useCallback(() => {
    if (!Ctor || rec.current) return;
    setError(null);
    const r = new Ctor();
    r.lang = lang; r.continuous = true; r.interimResults = true;
    base.current = text && !/\s$/.test(text) ? text + " " : text;
    finals.current = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals.current += res[0].transcript;
        else interim += res[0].transcript;
      }
      setText((base.current + finals.current + interim).slice(0, 4000));
    };
    r.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") setError(ERRORS[e.error] ?? "Voice typing stopped unexpectedly."); };
    r.onend = () => { rec.current = null; setListening(false); };
    rec.current = r;
    try { r.start(); setListening(true); } catch { rec.current = null; setError("Couldn't start voice typing."); }
  }, [Ctor, lang, text, setText]);

  useEffect(() => () => rec.current?.abort(), []);

  return { supported: !!Ctor, listening, error, start, stop, toggle: listening ? stop : start };
}
