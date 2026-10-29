"""Provider-neutral LLM adapter.

The chat code only talks to `LLMProvider.generate`. To add a provider, subclass it and
register it in `get_provider`. API keys come from server-side settings only.
"""
import hashlib
from abc import ABC, abstractmethod

import httpx

from ..config import get_settings


class LLMUnavailable(Exception):
    """Raised on timeouts, rate limits, auth errors or provider outages."""


class LLMProvider(ABC):
    name = "base"
    is_mock = False

    @abstractmethod
    def generate(self, system: str, messages: list[dict], max_tokens: int = 400) -> str: ...


class OpenAICompatibleProvider(LLMProvider):
    """Works with any server exposing the OpenAI-style /chat/completions endpoint."""

    name = "openai_compatible"

    def __init__(self, base_url: str, api_key: str, model: str, timeout: float):
        self.base_url, self.api_key, self.model, self.timeout = base_url.rstrip("/"), api_key, model, timeout

    def generate(self, system: str, messages: list[dict], max_tokens: int = 400) -> str:
        if not (self.api_key and self.model):
            raise LLMUnavailable("provider not configured")
        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": [{"role": "system", "content": system}, *messages],
        }
        try:
            resp = httpx.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=self.timeout,
            )
        except httpx.HTTPError as exc:  # timeouts, connection errors
            raise LLMUnavailable(type(exc).__name__) from exc
        if resp.status_code != 200:  # includes 429 rate limits; we do NOT retry sensitive turns
            raise LLMUnavailable(f"status {resp.status_code}")
        try:
            return resp.json()["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, ValueError) as exc:
            raise LLMUnavailable("bad response shape") from exc


# --------------------------------------------------------------------------------------
# Mock provider: clearly labelled development stand-in. It is NOT a language model. It reacts to
# what the user wrote (emotion words, themes, topic, "just listen" requests) and remembers the
# earlier messages in the conversation, so replies differ by input, but the UI labels it as mock.
# --------------------------------------------------------------------------------------

_EMOTIONS = {
    "stressed": ["stress", "pressure", "tense", "on edge"],
    "anxious": ["anxious", "anxiety", "worried", "worry", "nervous", "panic", "overthink", "scared", "afraid"],
    "overwhelmed": ["overwhelm", "too much", "swamped", "drowning", "can't cope", "burnt out", "burned out"],
    "sad": ["sad", "down", "low", "cry", "crying", "empty", "unhappy"],
    "lonely": ["lonely", "alone", "isolated", "no friends", "left out"],
    "angry": ["angry", "furious", "frustrated", "annoyed", "irritated", "unfair"],
    "tired": ["tired", "exhausted", "can't sleep", "insomnia", "drained", "no energy"],
    "unmotivated": ["unmotivated", "no motivation", "can't focus", "procrastinat", "stuck", "numb"],
}
_TOPICS = {
    "exams": ["exam", "test", "study", "studies", "marks", "grades", "result", "college", "assignment"],
    "work": ["work", "job", "boss", "deadline", "career", "office", "interview", "future"],
    "family": ["mom", "dad", "mother", "father", "parents", "family", "sister", "brother"],
    "relationships": ["friend", "partner", "boyfriend", "girlfriend", "relationship", "breakup", "argument", "fight"],
    "sleep": ["sleep", "insomnia", "awake", "nightmare"],
}
_TOPIC_PHRASE = {
    "exams": "with your studies in the picture", "work": "with work and what's ahead on your mind",
    "family": "where family is involved", "relationships": "with the people close to you involved",
    "sleep": "when sleep isn't coming easily",
}
_ACK = {
    "stressed": "That sounds like a lot of pressure to carry",
    "anxious": "That sounds like a lot of worry to carry around",
    "overwhelmed": "It sounds like there's too much on your plate right now",
    "sad": "I'm sorry it's feeling so heavy at the moment",
    "lonely": "Feeling disconnected can be really painful",
    "angry": "It makes sense that this has been frustrating",
    "tired": "Being this worn out can make everything feel harder",
    "unmotivated": "That kind of stuck feeling can be draining in its own way",
}
_QUESTIONS = {
    "stressed": ["What part of it is weighing on you the most?"],
    "anxious": ["What is the thought that keeps coming back the most?",
                "Is the worry more about something happening now, or something that might happen?"],
    "overwhelmed": ["If you could set one thing down for today, what would it be?", "Which part feels the heaviest right now?"],
    "sad": ["Has something specific brought this on, or has it been more of a general weight?"],
    "lonely": ["Is it more that you'd like someone to talk to, or someone to do things with?"],
    "angry": ["What feels most unfair about it?"],
    "tired": ["Has your rest been off for a while, or is this more recent?"],
    "unmotivated": ["What's one small thing that feels even slightly doable today?"],
    None: ["What feels most important to talk about first?", "What's been on your mind the most today?"],
}
# Themes that deserve a more specific response than an emotion label alone.
_OTHERS_EXPECT = ["disappoint everyone", "disappoint them", "let everyone down", "let them down", "disappoint my", "everyone is counting"]
_OWN_EXPECT = ["my own expectations", "never doing enough", "not doing enough", "not good enough", "never enough", "i always fail", "never good enough"]

_JUST_LISTEN = ["just want to vent", "just vent", "just listen", "don't want advice", "no advice", "just talk"]
_ORGANIZE = ["organize", "organise", "sort out", "break it down", "too many things"]
_EXERCISE = ["calming exercise", "breathing", "calm down", "grounding"]
_DISAGREE = ["that's not", "that isn't", "you're wrong", "not what i said", "i didn't say", "that's not right"]


def _find(text: str, table: dict) -> str | None:
    for key, words in table.items():
        if any(w in text for w in words):
            return key
    return None


class MockProvider(LLMProvider):
    name = "mock"
    is_mock = True

    def generate(self, system: str, messages: list[dict], max_tokens: int = 400) -> str:
        user_msgs = [m["content"].lower() for m in messages if m["role"] == "user"]
        text = user_msgs[-1] if user_msgs else ""
        recent = " ".join(user_msgs[-4:])  # earlier turns supply context for short follow-ups
        pick = int(hashlib.sha256(text.encode()).hexdigest(), 16)  # stable variety, deterministic for tests
        short = "RESPONSE LENGTH: short" in system

        if any(p in text for p in _DISAGREE):
            return "Thanks for correcting me. I may have misread that. Could you tell me in your own words what it's really like?"
        if any(p in text for p in _JUST_LISTEN):
            return "Of course. I'm here and I'm listening, with no advice unless you ask for it. Take your time."
        if any(p in text for p in _EXERCISE):
            return "Happy to. There are a few short exercises in the SOS area: paced breathing, 5-4-3-2-1 grounding, and others. Would you like to start with one, or would you rather keep talking?"
        if any(p in text for p in _ORGANIZE):
            return "Let's take it one piece at a time. Could you list everything on your mind in any order, even messy? We can sort it together afterwards."

        # Self-directed expectations: reflect it and offer a choice (the person decides what happens next).
        if any(p in text for p in _OWN_EXPECT):
            lead = "It can be exhausting when your own expectations leave you feeling behind, even when you're trying."
            return lead if short else f"{lead} Would it help to explore that thought together, or would you prefer to make a small, realistic plan for today?"
        if any(p in text for p in _OTHERS_EXPECT):
            lead = "That sounds like a lot of pressure to carry, especially when you feel other people are counting on you."
            question = ("When you think about disappointing them, what feels most difficult: their expectations, "
                        "your own expectations, or the uncertainty about the results?")
            return f"{lead} {question}"

        emotion = _find(text, _EMOTIONS) or _find(recent, _EMOTIONS)
        topic = _find(text, _TOPICS) or _find(recent, _TOPICS)
        if emotion is None and topic is None:
            if len(text.split()) <= 3:
                return "I'm here. Would you like to tell me a bit more, or should we try something gentle together?"
            return "Thank you for putting that into words. I'm listening. What feels most important to talk about first?"

        ack = _ACK.get(emotion or "", "Thank you for sharing that with me")
        phrase = _TOPIC_PHRASE.get(topic or "")
        first = f"{ack}, especially {phrase}." if phrase else f"{ack}."
        questions = _QUESTIONS[emotion]
        question = questions[pick % len(questions)]
        if short:
            return f"{first} {question}"
        offer = "We can keep talking, or if you'd rather, we could try a short calming exercise or write things down together."
        return f"{first} {question}\n\n{offer}"


def get_provider() -> LLMProvider:
    s = get_settings()
    if s.llm_provider == "openai_compatible":
        return OpenAICompatibleProvider(s.llm_base_url, s.llm_api_key, s.llm_model, s.llm_timeout_seconds)
    return MockProvider()

