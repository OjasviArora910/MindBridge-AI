// Thin API client. The browser never sees any provider API key: the server talks to the model.
export const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "mindbridge.token";

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage blocked */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ } },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return "Some of what you entered doesn't look right. Please check it and try again.";
  }
  return fallback;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) { headers.set("Content-Type", "application/json"); body = JSON.stringify(init.json); }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers, body });
  } catch {
    throw new ApiError(0, "Can't reach MindBridge right now. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageFrom(data, "Something went wrong. Please try again."));
  return data as T;
}

// ---------- types ----------
export interface User {
  id: number; email: string | null; is_guest: boolean; onboarding_complete: boolean;
  save_chat_history: boolean; personalization_enabled: boolean; share_with_ai_provider: boolean;
  response_length: "short" | "medium" | "long"; language: "en" | "hi"; region: string | null;
}
export interface Mood {
  id: number; entry_date: string; mood_rating: number; feelings: string[]; note: string | null;
  triggers: string | null; sleep_hours: number | null; sleep_quality: number | null;
}
export type MoodInput = Partial<Omit<Mood, "id">> & { mood_rating: number };
export interface Thought {
  id: number; situation: string | null; automatic_thought: string | null; emotion: string | null;
  intensity: number | null; evidence_for: string | null; evidence_against: string | null;
  alternative: string | null; next_step: string | null; created_at: string; updated_at: string;
}
export type ThoughtInput = Partial<Omit<Thought, "id" | "created_at" | "updated_at">>;
export interface ResourceItem { name: string; contact: string; kind: string; note: string; source: string | null; verified: boolean }
export interface Resources {
  region: string; label: string; items: ResourceItem[]; available_regions: Record<string, string>;
  region_chosen: boolean; disclaimer?: string;
}
export interface ChatReply {
  conversation_id: number | null; reply: string; ai_generated: boolean; ai_available: boolean; mock_mode: boolean;
  safety: { level: "none" | "distress" | "ambiguous" | "urgent"; category: string; show_resources: boolean };
  suggestions: { type: "sos" | "diary" | "mood"; id: string | null; label: string }[];
  resources: Resources | null;
}
export interface Dashboard {
  today: Mood | null;
  series: { date: string; mood: number; sleep_hours: number | null; sleep_quality: number | null }[];
  summaries: string[]; recent_thoughts: Thought[]; suggested_starts: string[]; has_data: boolean;
}
