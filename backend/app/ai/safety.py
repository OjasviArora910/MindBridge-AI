"""Separate safety workflow.

This runs BEFORE any LLM call, on the user's raw message, using explicit rules.
It does not depend on the onboarding stress score, retrieved documents, or the
model. User text cannot switch it off: there is no code path where message
content changes which rules run.

IMPORTANT: the phrase lists and response wording below are an engineering
starting point. They MUST be reviewed and extended by qualified mental-health
professionals, and tested with real-world phrasing, before any public release.
"""
import json
import re
from dataclasses import dataclass
from pathlib import Path

LEVELS = ["none", "distress", "ambiguous", "urgent"]
_RANK = {name: i for i, name in enumerate(LEVELS)}

# Direct statements of suicidal thoughts, intent, plans, or self-harm in progress.
_URGENT = [
    r"\bkill(ing)? myself\b",
    r"\bend(ing)? (my|it all|my own) life\b",
    r"\bsuicid(e|al)\b",
    r"\bwant(ed)? to die\b",
    r"\bwanna die\b",
    r"\bbetter off dead\b",
    r"\b(hurt|harm|cut|injure)(ing)? myself\b",
    r"\bself[- ]?harm",
    r"\btake my (own )?life\b",
    r"\b(overdos(e|ed|ing)|took (too many|a lot of) (pills|tablets))\b",
    r"\bhave a plan to (die|end|kill)\b",
    r"\bgoing to (die|end it|kill)\b",
    r"\bjump off\b",
    r"\bhang myself\b",
]

# Abuse or immediate danger from another person.
_ABUSE = [
    r"\b(he|she|they|my \w+) (is |are )?(hit|hits|hitting|beat|beats|beating|abus(e|es|ing)) me\b",
    r"\bbeing abused\b",
    r"\bnot safe (at home|here)\b",
    r"\bafraid (to go home|for my safety)\b",
    r"\bthreatens? (to kill|me)\b",
]

# Indirect or ambiguous expressions that could signal risk.
_AMBIGUOUS = [
    r"\bcan'?t go on\b",
    r"\bno (point|reason) (in|to) (living|going on|anything|being here)\b",
    r"\bwant to disappear\b",
    r"\bwish i (would not|wouldn'?t) wake up\b",
    r"\b(everyone|they|you) would be better (off )?without me\b",
    r"\bdon'?t want to be here( anymore)?\b",
    r"\btired of (living|being alive|everything)\b",
    r"\bcan'?t take (it|this) anymore\b",
    r"\bno way out\b",
    r"\bhopeless\b",
    r"\bnothing matters\b",
    r"\bgive up on (everything|life)\b",
    r"\bnot worth (living|it anymore)\b",
]

# Persistent or intense distress without risk language.
_DISTRESS = [
    r"\bcan'?t (get out of bed|stop crying|sleep|eat)\b",
    r"\bfor (weeks|months|years)\b",
    r"\bnothing (helps|works)\b",
    r"\bpanic attacks?\b",
    r"\bfeel(ing)? (empty|numb|worthless)\b",
    r"\bnot (coping|okay at all)\b",
    r"\bcompletely overwhelmed\b",
    r"\bnobody (cares|understands)\b",
]

# Common figures of speech that should not trigger on their own.
_FIGURATIVE = [
    r"\b(killing|killed) me\b",
    r"\bdie of (embarrassment|laughing|boredom)\b",
    r"\bto die for\b",
    r"\bkill (the|this) (process|app|task|server)\b",
]

_COMPILED = {
    "urgent": [re.compile(p, re.I) for p in _URGENT],
    "abuse": [re.compile(p, re.I) for p in _ABUSE],
    "ambiguous": [re.compile(p, re.I) for p in _AMBIGUOUS],
    "distress": [re.compile(p, re.I) for p in _DISTRESS],
}
_FIG = [re.compile(p, re.I) for p in _FIGURATIVE]


@dataclass
class SafetyResult:
    level: str  # none | distress | ambiguous | urgent
    category: str  # none | self_harm | abuse | indirect | persistent_distress
    response: str | None  # fixed, reviewed text; None means "ordinary chat may proceed"
    show_resources: bool
    bypass_llm: bool  # True: the reply comes from this module, not from the model


def _strip_figurative(text: str) -> str:
    for rx in _FIG:
        text = rx.sub(" ", text)
    return text


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("’", "'")).strip()


def classify(text: str, prior_level: str = "none") -> SafetyResult:
    """Classify one user message. `prior_level` is the highest level seen earlier in this
    conversation; it keeps the response careful when a follow-up is short ("yes", "no")."""
    cleaned = _strip_figurative(_normalize(text))

    def hit(key: str) -> bool:
        return any(rx.search(cleaned) for rx in _COMPILED[key])

    if hit("urgent"):
        return _build("urgent", "self_harm")
    if hit("abuse"):
        return _build("urgent", "abuse")
    if hit("ambiguous"):
        return _build("ambiguous", "indirect")

    # A brief follow-up right after a risk message stays in the careful workflow.
    if _RANK.get(prior_level, 0) >= _RANK["ambiguous"] and len(cleaned.split()) <= 6:
        return _build("ambiguous", "indirect", followup=True)

    if hit("distress"):
        return _build("distress", "persistent_distress")
    return SafetyResult("none", "none", None, False, False)


def _build(level: str, category: str, followup: bool = False) -> SafetyResult:
    if category == "self_harm":
        text = (
            "I'm really glad you told me. I'm an AI, so I can't contact anyone for you, "
            "and I can't see what's happening around you. Your safety matters most right now.\n\n"
            "Are you in immediate danger, or do you feel you might act on these thoughts soon? "
            "If so, please contact your local emergency number now, or reach out to someone "
            "near you who can be with you. The options below are a good place to start.\n\n"
            "If you're not sure, that's okay. You can tell me more, and I'll stay with you here."
        )
    elif category == "abuse":
        text = (
            "I'm sorry you're dealing with this. What you've described is serious, and you "
            "deserve to be safe. I'm an AI, so I can't contact anyone for you.\n\n"
            "Are you safe right now? If you're in immediate danger, please contact your local "
            "emergency number. If you can, move to a safer place or reach a person you trust. "
            "The options below can help you connect with people."
        )
    elif category == "indirect" and followup:
        text = (
            "Thank you for answering. I want to make sure I understand: are you having "
            "thoughts of ending your life or hurting yourself? You can answer in your own words. "
            "Whatever the answer is, I'm not going to judge you, and the support options below "
            "are available any time."
        )
    elif category == "indirect":
        text = (
            "That sounds incredibly heavy, and I'm glad you said it out loud. "
            "I'd like to check in directly, because I care how you're doing: are you having "
            "thoughts of ending your life or hurting yourself? You can tell me honestly. "
            "I'm an AI and can't contact anyone for you, but I can help you find people who can support you. "
            "The options below are there if you want them."
        )
    else:
        # persistent distress: ordinary chat continues, with a gentle human-support nudge added later
        return SafetyResult("distress", category, None, True, False)
    return SafetyResult(level, category, text, True, True)


# Added to the model's context for the "distress" level only.
DISTRESS_GUIDANCE = (
    "The user's message suggests persistent or intense distress. Respond with extra warmth. "
    "Do not diagnose. Gently mention that talking with a trusted person or a qualified "
    "professional could help, without pressuring them or alarming them. Keep it to one question."
)


def load_resources(region: str | None) -> dict:
    """Return resources for a user-chosen region. We never infer the region from IP or text."""
    data = json.loads((Path(__file__).parent / "resources.json").read_text(encoding="utf-8"))
    regions = data["regions"]
    key = region if region in regions else "OTHER"
    return {
        "region": key,
        "label": regions[key]["label"],
        "items": regions[key]["items"],
        "available_regions": {k: v["label"] for k, v in regions.items()},
        "region_chosen": region in regions,
    }


# ---- Output guard: checks model replies before they reach the user ----

_DIAGNOSIS = re.compile(
    r"\byou (probably |likely |clearly )?(have|are suffering from|suffer from|are)\s+"
    r"(clinical |major )?(depress(ed|ion)|anxiety disorder|bipolar|ptsd|ocd|adhd|a disorder)\b|"
    r"\bdiagnos(e|ed|is)\b.{0,20}\byou\b|\byour diagnosis\b",
    re.I,
)
_MEDICATION = re.compile(r"\b(take|start|stop|increase|reduce)\b.{0,25}\b(medication|antidepressant|pills?|mg)\b", re.I)
_PHONE_LIKE = re.compile(r"(?<!\d)(\+?\d[\d\s\-]{5,}\d)(?!\d)")
_CONTACT_CLAIM = re.compile(r"\bI('ve| have| will| 'll)? (contacted|called|notified|alerted|sent help)\b", re.I)
_ALLOWED_NUMBERS = {"112", "988", "14416"}


def guard_output(text: str) -> tuple[bool, str]:
    """Return (ok, reason). If not ok, the caller must NOT show the model's text."""
    if _DIAGNOSIS.search(text):
        return False, "diagnosis_language"
    if _MEDICATION.search(text):
        return False, "medication_advice"
    if _CONTACT_CLAIM.search(text):
        return False, "claims_contact"
    for match in _PHONE_LIKE.findall(text):
        digits = re.sub(r"\D", "", match)
        if digits not in _ALLOWED_NUMBERS and len(digits) >= 6:
            return False, "unverified_phone_number"
    return True, ""
