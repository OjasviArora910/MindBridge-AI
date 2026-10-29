"""Extensible self-assessment interface.

PHQ-9 is enabled as a PROTOTYPE (see the bottom of this file): its wording and scoring come
from the official public-domain source, but the result and next-step text has NOT been
clinically reviewed, and the UI says so. GAD-7, Rosenberg and burnout remain PLANNED only.
Before enabling any further instrument, or removing the "not reviewed" label, someone
must: (1) confirm the exact wording, licence/permitted use and translations from the
official source, (2) copy the authorised scoring rules verbatim, and (3) have qualified
mental-health professionals approve the result wording and the follow-up guidance.

To add a reviewed instrument, implement `Instrument` and call `register(...)`.
"""
from dataclasses import dataclass, field
from typing import Callable

PLANNED = [
    {"id": "gad7", "title": "GAD-7"},
    {"id": "rses", "title": "Rosenberg Self-Esteem Scale"},
    {"id": "burnout", "title": "Burnout questionnaire (instrument to be selected)"},
]
PLANNED_REASON = (
    "Not available yet. Wording, permitted use, scoring and interpretation text still need to be "
    "verified against the official source and reviewed by qualified professionals."
)

RESULT_DISCLAIMER = (
    "This is self-reflection or screening information. It is not a diagnosis and does not replace "
    "advice from a qualified professional."
)


@dataclass
class Instrument:
    id: str
    title: str
    source: str  # citation of the official source
    reviewed_by: str  # who approved wording and interpretation
    items: list[str]
    options: list[str]  # answer labels, value = index
    score: Callable[[list[int]], dict]  # authorised scoring, returns {"total": ..., "band_text": ...}
    # Indexes of items whose answers indicate possible immediate risk (e.g. self-harm items).
    risk_items: dict[int, int] = field(default_factory=dict)  # item index -> minimum answer that triggers safety
    stem: str = ""  # instruction shown above the items
    reviewed: bool = False  # True only once professionals approved the result and guidance text


REGISTRY: dict[str, Instrument] = {}


def register(instrument: Instrument) -> None:
    REGISTRY[instrument.id] = instrument


def risk_flagged(instrument: Instrument, answers: list[int]) -> bool:
    return any(i < len(answers) and answers[i] >= minimum for i, minimum in instrument.risk_items.items())


# ---------------- PHQ-9 (prototype, result text not clinically reviewed) ----------------
# Source: Kroenke K, Spitzer RL, Williams JBW. The PHQ-9. J Gen Intern Med 2001;16:606-613.
# Wording from phqscreeners.com: "Developed by Drs. Robert L. Spitzer, Janet B.W. Williams,
# Kurt Kroenke and colleagues, with an educational grant from Pfizer Inc. No permission
# required to reproduce, translate, display or distribute."
# The optional unscored 10th "how difficult" question is not included.

PHQ9_BANDS = [  # (max total, band id, label) per Kroenke et al. 2001
    (4, "minimal", "none to minimal"),
    (9, "mild", "mild"),
    (14, "moderate", "moderate"),
    (19, "moderately_severe", "moderately severe"),
    (27, "severe", "severe"),
]

# Fixed next-step text. NOT clinically reviewed: wording to be approved before release.
PHQ9_NEXT_STEPS = {
    "minimal": "Your answers suggest few or no symptoms right now. Keep doing what helps you, and check in again if things change.",
    "mild": "Your answers suggest mild symptoms. Small steps like rest, routine, movement and talking to someone you trust can help. "
            "Consider taking this again in two weeks, and talk to a doctor if things don't ease.",
    "moderate": "Your answers suggest moderate symptoms. It would be a good idea to talk to a doctor, counsellor or other "
                "qualified professional about how you've been feeling.",
    "moderately_severe": "Your answers suggest moderately severe symptoms. Please contact a doctor or mental-health "
                         "professional soon. Support options are listed below.",
    "severe": "Your answers suggest severe symptoms. Please reach out to a doctor or mental-health professional as soon as "
              "you can, and consider telling someone you trust today. Support options are listed below.",
}


def phq9_band(total: int) -> tuple[str, str]:
    for top, band, label in PHQ9_BANDS:
        if total <= top:
            return band, label
    return PHQ9_BANDS[-1][1], PHQ9_BANDS[-1][2]


def _phq9_score(answers: list[int]) -> dict:
    total = sum(answers)
    band, label = phq9_band(total)
    return {
        "total": total,
        "max": 27,
        "band": band,
        "band_text": f"Score {total} of 27: {label} range.",
        "next_steps": PHQ9_NEXT_STEPS[band],
        "show_support": band in ("moderately_severe", "severe"),
    }


PHQ9 = Instrument(
    id="phq9",
    title="PHQ-9",
    source="Patient Health Questionnaire-9 (Kroenke, Spitzer & Williams, 2001). Free to use; phqscreeners.com",
    reviewed_by="NOT YET CLINICALLY REVIEWED (prototype)",
    reviewed=False,
    stem="Over the last 2 weeks, how often have you been bothered by any of the following problems?",
    items=[
        "Little interest or pleasure in doing things",
        "Feeling down, depressed, or hopeless",
        "Trouble falling or staying asleep, or sleeping too much",
        "Feeling tired or having little energy",
        "Poor appetite or overeating",
        "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
        "Trouble concentrating on things, such as reading the newspaper or watching television",
        "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety "
        "or restless that you have been moving around a lot more than usual",
        "Thoughts that you would be better off dead or of hurting yourself in some way",
    ],
    options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
    score=_phq9_score,
    risk_items={8: 1},  # item 9: any answer above "Not at all" shows urgent support
)
register(PHQ9)
