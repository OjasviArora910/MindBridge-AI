"""PHQ-9: official items, standard scoring bands, item-9 safety, and chat tone hint."""
from datetime import datetime, timedelta, timezone

import pytest

from app import assessments as reg
from app.ai.personalization import build_context
from app.db import SessionLocal
from app.models import AssessmentAttempt, User


def submit(client, auth, answers):
    r = client.post("/assessments/phq9/attempts", json={"answers": answers}, headers=auth)
    assert r.status_code == 200, r.text
    return r.json()


def test_phq9_content(client, auth):
    q = client.get("/assessments/phq9", headers=auth).json()
    assert len(q["items"]) == 9 and q["reviewed"] is False
    assert q["stem"].startswith("Over the last 2 weeks")
    assert q["options"] == ["Not at all", "Several days", "More than half the days", "Nearly every day"]
    assert q["items"][8].startswith("Thoughts that you would be better off dead")


@pytest.mark.parametrize("total,band", [
    (0, "minimal"), (4, "minimal"), (5, "mild"), (9, "mild"), (10, "moderate"), (14, "moderate"),
    (15, "moderately_severe"), (19, "moderately_severe"), (20, "severe"), (24, "severe"),
])
def test_phq9_band_boundaries(client, auth, total, band):
    # Spread the total over items 1-8 only, so item 9 stays 0.
    answers = [0] * 9
    left = total
    for i in range(8):
        answers[i] = min(3, left)
        left -= answers[i]
    r = submit(client, auth, answers)
    res = r["questionnaire_result"]
    assert res["total"] == total and res["band"] == band and res["max"] == 27
    assert "not a diagnosis" in r["disclaimer"] and r["reviewed"] is False
    if band in ("moderately_severe", "severe"):
        assert r["safety"]["level"] == "support" and r["safety"]["resources"]
    else:
        assert r["safety"] is None


def test_phq9_item9_always_urgent(client, auth):
    r = submit(client, auth, [0] * 8 + [1])
    assert r["questionnaire_result"]["band"] == "minimal"
    assert r["safety"]["level"] == "urgent" and r["safety"]["message"] and r["safety"]["resources"]


def test_phq9_rejects_incomplete(client, auth):
    assert client.post("/assessments/phq9/attempts", json={"answers": [0] * 8}, headers=auth).status_code == 422


def test_phq9_tone_hint_in_chat_context(client, auth):
    submit(client, auth, [2, 2, 2, 2, 1, 1, 1, 0, 0])  # 11 -> moderate
    with SessionLocal() as db:
        user = db.query(User).first()
        ctx = build_context(db, user)
        assert "moderate range" in ctx and "not a diagnosis" in ctx
        assert "11" not in ctx  # raw score and individual answers are not sent
        user.personalization_enabled = False
        db.commit()
        assert build_context(db, user) == ""


def test_phq9_tone_hint_expires_after_two_weeks(client, auth):
    submit(client, auth, [3] * 8 + [0])
    with SessionLocal() as db:
        a = db.query(AssessmentAttempt).first()
        a.created_at = datetime.now(timezone.utc) - timedelta(days=15)
        db.commit()
        assert "PHQ-9" not in build_context(db, db.query(User).first())


def test_phq9_hint_is_per_user(client, auth, auth_b):
    submit(client, auth, [3] * 8 + [0])
    with SessionLocal() as db:
        b = db.query(User).filter(User.email == "b@example.com").one()
        assert "PHQ-9" not in build_context(db, b)


def test_band_helper():
    assert reg.phq9_band(27) == ("severe", "severe")
