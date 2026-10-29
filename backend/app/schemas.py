"""Request/response schemas. All inputs are validated here."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

FeelingKey = Literal[
    "anxious", "overwhelmed", "sad", "lonely", "angry", "numb", "tired", "stressed_ok", "other", "unsure"
]
ConcernKey = Literal["studies", "family_relationships", "work_future", "personal_expectations", "several", "other", "unsure"]
DurationKey = Literal["recent", "days", "weeks", "month_plus", "unsure", "no_answer"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth & user ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class PreferencesOut(ORM):
    save_chat_history: bool
    personalization_enabled: bool
    share_with_ai_provider: bool
    response_length: Literal["short", "medium", "long"]
    language: Literal["en", "hi"]
    region: str | None


class PreferencesIn(BaseModel):
    save_chat_history: bool | None = None
    personalization_enabled: bool | None = None
    share_with_ai_provider: bool | None = None
    response_length: Literal["short", "medium", "long"] | None = None
    language: Literal["en", "hi"] | None = None
    region: Literal["IN", "US", "OTHER"] | None = None


class UserOut(ORM):
    id: int
    email: str | None
    is_guest: bool
    onboarding_complete: bool
    save_chat_history: bool
    personalization_enabled: bool
    share_with_ai_provider: bool
    response_length: str
    language: str
    region: str | None


class TokenOut(BaseModel):
    token: str
    user: UserOut
    prototype_notice: str = (
        "Prototype authentication. Not production-secure: use a vetted identity provider before a real release."
    )


# ---------- onboarding ----------
class OnboardingIn(BaseModel):
    consent_to_save: bool  # explicit: False means answers are used for the welcome message only
    stress_level: int | None = Field(default=None, ge=1, le=10)
    feelings: list[FeelingKey] = Field(default_factory=list, max_length=10)
    main_concern: ConcernKey | None = None
    duration: DurationKey | None = None


class OnboardingOut(BaseModel):
    saved: bool
    stress_level: int | None
    feelings: list[str]
    main_concern: str | None
    duration: str | None
    welcome_message: str


# ---------- mood & sleep ----------
class MoodIn(BaseModel):
    entry_date: date | None = None
    mood_rating: int = Field(ge=1, le=10)
    feelings: list[str] = Field(default_factory=list, max_length=12)
    note: str | None = Field(default=None, max_length=2000)
    triggers: str | None = Field(default=None, max_length=500)
    sleep_hours: float | None = Field(default=None, ge=0, le=24)
    sleep_quality: int | None = Field(default=None, ge=1, le=5)

    @field_validator("feelings")
    @classmethod
    def _short_feelings(cls, v: list[str]) -> list[str]:
        return [f.strip()[:40] for f in v if f.strip()]


class MoodOut(ORM):
    id: int
    entry_date: date
    mood_rating: int
    feelings: list[str]
    note: str | None
    triggers: str | None
    sleep_hours: float | None
    sleep_quality: int | None


# ---------- thought diary ----------
class ThoughtIn(BaseModel):
    """Every field is optional so each step can be skipped."""

    situation: str | None = Field(default=None, max_length=3000)
    automatic_thought: str | None = Field(default=None, max_length=3000)
    emotion: str | None = Field(default=None, max_length=120)
    intensity: int | None = Field(default=None, ge=0, le=10)
    evidence_for: str | None = Field(default=None, max_length=3000)
    evidence_against: str | None = Field(default=None, max_length=3000)
    alternative: str | None = Field(default=None, max_length=3000)
    next_step: str | None = Field(default=None, max_length=3000)


class ThoughtOut(ThoughtIn, ORM):
    id: int
    created_at: datetime
    updated_at: datetime


class SuggestIn(BaseModel):
    situation: str | None = Field(default=None, max_length=3000)
    automatic_thought: str = Field(min_length=1, max_length=3000)


class SuggestOut(BaseModel):
    suggestions: list[str]
    ai_generated: bool = True
    mock_mode: bool = False
    note: str = "These are possibilities to consider, not corrections. Accept, edit or ignore them."
    safety_message: str | None = None  # set (and suggestions empty) if the text needs the safety workflow
    resources: dict | None = None


# ---------- chat ----------
class HistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: int | None = None
    history: list[HistoryItem] = Field(default_factory=list, max_length=12)  # used when chat saving is off


class SafetyInfo(BaseModel):
    level: str
    category: str
    show_resources: bool


class SuggestedAction(BaseModel):
    type: Literal["sos", "diary", "mood"]
    id: str | None = None
    label: str


class ChatOut(BaseModel):
    conversation_id: int | None
    reply: str
    ai_generated: bool = True
    ai_available: bool
    mock_mode: bool
    safety: SafetyInfo
    suggestions: list[SuggestedAction] = Field(default_factory=list)
    resources: dict | None = None


class MessageOut(ORM):
    id: int
    role: str
    content: str
    created_at: datetime


class ConversationOut(ORM):
    id: int
    created_at: datetime
    messages: list[MessageOut]


# ---------- assessments ----------
class AttemptIn(BaseModel):
    answers: list[int] = Field(max_length=100)


# ---------- reports ----------
ReportSection = Literal["mood", "sleep", "reflections", "thoughts", "questions"]


class ReportPreviewIn(BaseModel):
    sections: list[ReportSection] = Field(min_length=1)
    date_from: date | None = None
    date_to: date | None = None
    exclude_mood_ids: list[int] = Field(default_factory=list)
    exclude_thought_ids: list[int] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list, max_length=10)


class ReportPreviewOut(BaseModel):
    text: str
    mood_ids: list[int]
    thought_ids: list[int]


class ReportExportIn(BaseModel):
    approved_text: str = Field(min_length=1, max_length=60000)
    sections: list[ReportSection] = Field(default_factory=list)
    entry_count: int = Field(default=0, ge=0)
