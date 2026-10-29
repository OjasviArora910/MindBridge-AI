// Shared option lists (English MVP). Keep user-facing strings here so a Hindi version can swap this file.
export const FEELINGS = [
  { key: "anxious", label: "Anxious or worried" },
  { key: "overwhelmed", label: "Overwhelmed" },
  { key: "sad", label: "Sad or low" },
  { key: "lonely", label: "Lonely or disconnected" },
  { key: "angry", label: "Angry or frustrated" },
  { key: "numb", label: "Numb or unmotivated" },
  { key: "tired", label: "Tired or having trouble sleeping" },
  { key: "stressed_ok", label: "Mostly okay, but stressed" },
  { key: "other", label: "Something else" },
  { key: "unsure", label: "I'm not sure" },
] as const;

export const CONCERNS = [
  { key: "studies", label: "Studies or exams" },
  { key: "family_relationships", label: "Family or relationships" },
  { key: "work_future", label: "Work or future uncertainty" },
  { key: "personal_expectations", label: "Personal thoughts or expectations" },
  { key: "several", label: "Several things at once" },
  { key: "other", label: "Something else" },
  { key: "unsure", label: "I'm not sure" },
] as const;

export const DURATIONS = [
  { key: "recent", label: "Today or just recently" },
  { key: "days", label: "A few days" },
  { key: "weeks", label: "A few weeks" },
  { key: "month_plus", label: "A month or longer" },
  { key: "unsure", label: "I'm not sure" },
  { key: "no_answer", label: "Prefer not to say" },
] as const;

// Free-form feelings for the daily check-in (flexible list; users can also add their own)
export const MOOD_FEELINGS = [
  "Calm", "Hopeful", "Content", "Anxious", "Overwhelmed", "Sad", "Lonely", "Irritable", "Numb", "Tired", "Restless",
] as const;

export const labelFor = (list: readonly { key: string; label: string }[], key: string | null | undefined) =>
  list.find((i) => i.key === key)?.label ?? "";
