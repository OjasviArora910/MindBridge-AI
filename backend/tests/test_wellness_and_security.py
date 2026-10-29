from datetime import date, timedelta

from app import assessments as reg


def mood(client, auth, **over):
    body = {"mood_rating": 5, "feelings": ["tired"], "note": "long day", "sleep_hours": 6.5, "sleep_quality": 3}
    body.update(over)
    return client.post("/mood", json=body, headers=auth)


# ---------------- mood & sleep ----------------

def test_mood_create_view_edit_delete(client, auth):
    r = mood(client, auth)
    assert r.status_code == 201
    eid = r.json()["id"]
    assert client.get(f"/mood/{eid}", headers=auth).json()["mood_rating"] == 5
    r = client.put(f"/mood/{eid}", json={"mood_rating": 7, "sleep_hours": 8}, headers=auth)
    assert r.json()["mood_rating"] == 7 and r.json()["sleep_hours"] == 8
    assert client.delete(f"/mood/{eid}", headers=auth).status_code == 204
    assert client.get(f"/mood/{eid}", headers=auth).status_code == 404


def test_one_checkin_per_day_and_validation(client, auth):
    assert mood(client, auth).status_code == 201
    assert mood(client, auth).status_code == 409
    assert mood(client, auth, entry_date="2025-01-01", mood_rating=11).status_code == 422
    assert mood(client, auth, entry_date="2025-01-02", sleep_hours=30).status_code == 422
    assert mood(client, auth, entry_date="2025-01-03", sleep_quality=9).status_code == 422


def test_calendar_and_dashboard_reflect_stored_entries(client, auth):
    empty = client.get("/dashboard", headers=auth).json()
    assert empty["has_data"] is False and empty["series"] == [] and empty["summaries"] == []

    today = date.today()
    for i, rating in enumerate([3, 3, 4, 8]):
        mood(client, auth, entry_date=(today - timedelta(days=i)).isoformat(), mood_rating=rating)
    d = client.get("/dashboard", headers=auth).json()
    assert [p["mood"] for p in d["series"]] == [8, 4, 3, 3]  # oldest first
    assert d["today"]["mood_rating"] == 3 or d["today"]["entry_date"] == today.isoformat()
    text = " ".join(d["summaries"]).lower()
    assert "low on several days" in text
    for causal in ["because", "caused", "due to", "result of"]:
        assert causal not in text

    month = today.strftime("%Y-%m")
    cal = client.get("/mood/calendar", params={"month": month}, headers=auth).json()
    assert today.isoformat() in cal["days"]
    assert client.get("/mood/calendar", params={"month": "2025-13"}, headers=auth).status_code == 422


def test_dashboard_starters_follow_onboarding_unless_personalization_off(client, auth):
    client.put("/onboarding", json={"consent_to_save": True, "main_concern": "studies"}, headers=auth)
    assert client.get("/dashboard", headers=auth).json()["suggested_starts"]
    client.patch("/preferences", json={"personalization_enabled": False}, headers=auth)
    assert client.get("/dashboard", headers=auth).json()["suggested_starts"] == []


# ---------------- thought diary ----------------

def test_diary_create_edit_and_skip_sections(client, auth):
    r = client.post("/diary", json={"situation": "Mock test went badly", "automatic_thought": "I always fail"},
                    headers=auth)
    assert r.status_code == 201
    eid = r.json()["id"]
    assert r.json()["alternative"] is None  # skipped sections stay empty
    r = client.put(f"/diary/{eid}", json={"situation": "Mock test went badly", "automatic_thought": "I always fail",
                                          "emotion": "worried", "intensity": 7, "alternative": "One test isn't everything",
                                          "next_step": "Review two topics"}, headers=auth)
    assert r.json()["intensity"] == 7 and r.json()["alternative"]
    assert len(client.get("/diary", headers=auth).json()) == 1
    assert client.post("/diary", json={"intensity": 12}, headers=auth).status_code == 422


def test_diary_suggestions_are_possibilities_and_labelled(client, auth):
    r = client.post("/diary/suggest", json={"automatic_thought": "I'll never get this right"}, headers=auth).json()
    assert r["suggestions"] and r["mock_mode"] is True
    assert "possibilit" in r["note"].lower()
    assert not any("irrational" in s.lower() or "wrong" in s.lower() for s in r["suggestions"])


def test_diary_text_with_risk_language_triggers_safety(client, auth):
    r = client.post("/diary/suggest", json={"automatic_thought": "I want to kill myself"}, headers=auth).json()
    assert r["suggestions"] == [] and r["safety_message"] and r["resources"]


# ---------------- assessments ----------------

def test_assessments_ship_without_fabricated_content(client, auth):
    r = client.get("/assessments", headers=auth).json()
    # PHQ-9 is the only enabled instrument, and it is flagged as not clinically reviewed.
    assert [(a["id"], a["reviewed"]) for a in r["available"]] == [("phq9", False)]
    assert {p["id"] for p in r["planned"]} == {"gad7", "rses", "burnout"}
    assert all(p["status"] == "unavailable" for p in r["planned"])
    assert client.post("/assessments/gad7/attempts", json={"answers": [0] * 7}, headers=auth).status_code == 404


def test_assessment_plumbing_with_reviewed_instrument(client, auth):
    """Uses a throwaway instrument purely to exercise the module (NOT a real questionnaire)."""
    reg.register(reg.Instrument(
        id="plumbing-test", title="Plumbing test", source="n/a (test only)", reviewed_by="n/a",
        items=["item one", "item two"], options=["a", "b", "c"],
        score=lambda a: {"total": sum(a)}, risk_items={1: 2}))
    try:
        ok = client.post("/assessments/plumbing-test/attempts", json={"answers": [1, 0]}, headers=auth).json()
        assert ok["questionnaire_result"] == {"total": 1} and ok["ai_observations"] is None
        assert ok["safety"] is None and "not a diagnosis" in ok["disclaimer"]
        risky = client.post("/assessments/plumbing-test/attempts", json={"answers": [0, 2]}, headers=auth).json()
        assert risky["safety"]["resources"]
        bad = client.post("/assessments/plumbing-test/attempts", json={"answers": [0, 5]}, headers=auth)
        assert bad.status_code == 422
    finally:
        reg.REGISTRY.pop("plumbing-test", None)


# ---------------- reports ----------------

def test_report_contains_only_selected_and_approved_data(client, auth):
    a = mood(client, auth, entry_date="2026-01-01", note="private note A", mood_rating=4).json()
    b = mood(client, auth, entry_date="2026-01-02", note="private note B", mood_rating=6).json()
    client.post("/diary", json={"situation": "diary secret", "automatic_thought": "t"}, headers=auth)

    r = client.post("/reports/preview", json={"sections": ["mood"]}, headers=auth).json()
    assert "2026-01-01" in r["text"] and "private note" not in r["text"] and "diary secret" not in r["text"]
    assert "not a clinical report" in r["text"].lower()

    r = client.post("/reports/preview", json={"sections": ["mood", "reflections"], "exclude_mood_ids": [a["id"]]},
                    headers=auth).json()
    assert "private note B" in r["text"] and "private note A" not in r["text"] and "2026-01-01" not in r["text"]
    assert r["mood_ids"] == [b["id"]]

    r = client.post("/reports/preview", json={"sections": ["thoughts", "questions"], "questions": ["Why do I overthink?"]},
                    headers=auth).json()
    assert "diary secret" in r["text"] and "Why do I overthink?" in r["text"]


def test_report_export_keeps_disclaimer_and_stores_metadata_only(client, auth):
    out = client.post("/reports/export", json={"approved_text": "Edited by me", "sections": ["mood"], "entry_count": 2},
                      headers=auth).json()
    assert out["text"].startswith("PERSONAL SELF-REFLECTION SUMMARY") and "Edited by me" in out["text"]
    from app.db import SessionLocal
    from app.models import ReportRecord
    with SessionLocal() as db:
        rec = db.query(ReportRecord).one()
        assert rec.entry_count == 2 and not hasattr(rec, "text")


# ---------------- security & privacy ----------------

def test_endpoints_require_authentication(client):
    for method, path in [("get", "/dashboard"), ("get", "/mood"), ("post", "/chat"), ("get", "/diary"),
                         ("get", "/data/export"), ("delete", "/data/all"), ("get", "/preferences")]:
        assert getattr(client, method)(path).status_code == 401, path
    assert client.get("/dashboard", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_users_cannot_access_each_others_records(client, auth, auth_b):
    mid = mood(client, auth).json()["id"]
    did = client.post("/diary", json={"situation": "x"}, headers=auth).json()["id"]
    client.patch("/preferences", json={"save_chat_history": True}, headers=auth)
    cid = client.post("/chat", json={"message": "I'm stressed"}, headers=auth).json()["conversation_id"]

    assert client.get(f"/mood/{mid}", headers=auth_b).status_code == 404
    assert client.put(f"/mood/{mid}", json={"mood_rating": 1}, headers=auth_b).status_code == 404
    assert client.delete(f"/mood/{mid}", headers=auth_b).status_code == 404
    assert client.get(f"/diary/{did}", headers=auth_b).status_code == 404
    assert client.put(f"/diary/{did}", json={"situation": "hijack"}, headers=auth_b).status_code == 404
    assert client.get(f"/chat/conversations/{cid}", headers=auth_b).status_code == 404
    assert client.delete(f"/chat/conversations/{cid}", headers=auth_b).status_code == 404
    assert client.post("/chat", json={"message": "hi", "conversation_id": cid}, headers=auth_b).status_code == 404
    assert client.get("/mood", headers=auth_b).json() == []
    assert client.get("/data/export", headers=auth_b).json()["mood_entries"] == []
    # and the owner's data is untouched
    assert client.get(f"/mood/{mid}", headers=auth).status_code == 200


def test_login_does_not_reveal_which_part_was_wrong(client, auth):
    wrong_pw = client.post("/auth/login", json={"email": "a@example.com", "password": "nope-nope-nope"})
    unknown = client.post("/auth/login", json={"email": "ghost@example.com", "password": "nope-nope-nope"})
    assert wrong_pw.status_code == unknown.status_code == 401 and wrong_pw.json() == unknown.json()
    assert client.post("/auth/register", json={"email": "a@example.com", "password": "short"}).status_code == 422


def test_passwords_are_hashed_and_tokens_tamper_proof(client):
    from app.db import SessionLocal
    from app.models import User
    from app.security import create_token, decode_token
    client.post("/auth/register", json={"email": "h@example.com", "password": "correct-horse-battery"})
    with SessionLocal() as db:
        u = db.query(User).filter_by(email="h@example.com").one()
        assert "correct-horse" not in u.password_hash and u.password_hash.startswith("pbkdf2$")
    tok = create_token(1)
    assert decode_token(tok) == 1 and decode_token(tok[:-3] + "AAA") is None


def test_no_secret_or_key_in_any_api_response(client, auth):
    blob = client.get("/preferences", headers=auth).text + client.get("/auth/me", headers=auth).text
    assert "api_key" not in blob.lower() and "secret" not in blob.lower()


def test_data_context_export_and_deletion(client, auth):
    client.put("/onboarding", json={"consent_to_save": True, "main_concern": "studies", "stress_level": 5}, headers=auth)
    mood(client, auth)
    ctx = client.get("/data/context", headers=auth).json()
    assert ctx["onboarding"]["main_concern"] == "studies" and "No diagnoses" in ctx["note"]

    exported = client.get("/data/export", headers=auth).json()
    assert len(exported["mood_entries"]) == 1 and exported["onboarding"]["stress_level"] == 5

    assert client.delete("/data/context", headers=auth).status_code == 204
    assert client.get("/data/context", headers=auth).json()["onboarding"] is None
    assert len(client.get("/mood", headers=auth).json()) == 1  # only context removed

    assert client.delete("/data/all", headers=auth).status_code == 204
    assert client.get("/mood", headers=auth).status_code == 401  # account gone
