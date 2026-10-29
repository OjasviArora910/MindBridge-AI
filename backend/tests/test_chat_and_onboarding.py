import logging

from app.ai.llm import LLMUnavailable
from app.routers import chat as chat_router

from .conftest import make_user


class FailingProvider:
    name, is_mock = "failing", True

    def generate(self, *a, **k):
        raise LLMUnavailable("timeout")


class BadAdviceProvider:
    name, is_mock = "bad", True

    def generate(self, *a, **k):
        return "You have depression. You should stop taking your medication."


# ---------------- onboarding ----------------

def test_onboarding_can_be_completed_skipped_and_edited(client, auth):
    r = client.put("/onboarding", json={
        "consent_to_save": True, "stress_level": 6, "feelings": ["anxious", "overwhelmed"],
        "main_concern": "studies", "duration": "weeks"}, headers=auth)
    assert r.status_code == 200 and r.json()["saved"] is True
    welcome = r.json()["welcome_message"].lower()
    assert "studies" in welcome
    for bad in ["depress", "disorder", "diagnos", "anxiety disorder"]:
        assert bad not in welcome

    # skip optional duration + edit an answer
    r = client.put("/onboarding", json={
        "consent_to_save": True, "stress_level": 4, "feelings": ["tired"], "main_concern": "work_future"},
        headers=auth)
    assert r.status_code == 200
    got = client.get("/onboarding", headers=auth).json()
    assert got["stress_level"] == 4 and got["duration"] is None and got["main_concern"] == "work_future"
    assert client.get("/auth/me", headers=auth).json()["onboarding_complete"] is True


def test_onboarding_without_consent_is_not_stored(client, auth):
    r = client.put("/onboarding", json={"consent_to_save": False, "stress_level": 8,
                                        "main_concern": "studies"}, headers=auth)
    assert r.json()["saved"] is False and r.json()["welcome_message"]
    assert client.get("/onboarding", headers=auth).json() is None


def test_onboarding_rejects_invalid_values(client, auth):
    assert client.put("/onboarding", json={"consent_to_save": True, "stress_level": 11}, headers=auth).status_code == 422
    assert client.put("/onboarding", json={"consent_to_save": True, "feelings": ["nonsense"]}, headers=auth).status_code == 422


def test_onboarding_all_optional_answers_skippable(client, auth):
    r = client.put("/onboarding", json={"consent_to_save": True}, headers=auth)
    assert r.status_code == 200
    assert "Welcome" in r.json()["welcome_message"]


# ---------------- chat ----------------

def test_replies_acknowledge_and_differ_by_input(client, auth):
    inputs = [
        "I'm really anxious about my exams and keep overthinking",
        "I feel so lonely at college, I have no friends",
        "My boss gave me an unfair deadline and I'm furious",
    ]
    replies = [client.post("/chat", json={"message": m}, headers=auth).json() for m in inputs]
    texts = [r["reply"] for r in replies]
    assert len(set(texts)) == 3
    assert all(r["ai_generated"] and r["mock_mode"] for r in replies)  # labelled AI / mock
    for t in texts:
        assert t.count("?") <= 2  # at most one follow-up question (+ the optional offer)
    assert "worry" in texts[0].lower() or "studies" in texts[0].lower()
    assert "disconnect" in texts[1].lower()


def test_just_listen_request_is_respected(client, auth):
    body = client.post("/chat", json={"message": "I just want to vent, no advice please"}, headers=auth).json()
    assert "listening" in body["reply"].lower()
    assert body["suggestions"] == []


def test_exercise_suggested_only_when_asked(client, auth):
    plain = client.post("/chat", json={"message": "I'm stressed about work"}, headers=auth).json()
    assert plain["suggestions"] == []
    asked = client.post("/chat", json={"message": "Show me a calming exercise"}, headers=auth).json()
    assert any(s["type"] == "sos" for s in asked["suggestions"])


def test_chat_history_only_saved_with_consent(client, auth):
    first = client.post("/chat", json={"message": "I'm stressed about exams"}, headers=auth).json()
    assert first["conversation_id"] is None
    assert client.get("/chat/conversations", headers=auth).json() == []

    client.patch("/preferences", json={"save_chat_history": True}, headers=auth)
    saved = client.post("/chat", json={"message": "I'm stressed about exams"}, headers=auth).json()
    cid = saved["conversation_id"]
    conv = client.get(f"/chat/conversations/{cid}", headers=auth).json()
    assert [m["role"] for m in conv["messages"]] == ["user", "assistant"]

    assert client.delete(f"/chat/conversations/{cid}", headers=auth).status_code == 204
    assert client.get("/chat/conversations", headers=auth).json() == []


def test_provider_failure_gives_graceful_fallback_not_fake_reply(client, auth, monkeypatch):
    monkeypatch.setattr(chat_router, "get_provider", lambda: FailingProvider())
    client.patch("/preferences", json={"save_chat_history": True}, headers=auth)
    body = client.post("/chat", json={"message": "I'm stressed about exams"}, headers=auth).json()
    assert body["ai_available"] is False and body["ai_generated"] is False
    assert "mood tracker" in body["reply"]
    # fallback is not stored as if the assistant said it
    conv = client.get(f"/chat/conversations/{body['conversation_id']}", headers=auth).json()
    assert [m["role"] for m in conv["messages"]] == ["user"]


def test_unsafe_model_output_is_blocked(client, auth, monkeypatch):
    monkeypatch.setattr(chat_router, "get_provider", lambda: BadAdviceProvider())
    body = client.post("/chat", json={"message": "I'm stressed about exams"}, headers=auth).json()
    assert "depression" not in body["reply"].lower()
    assert body["ai_generated"] is False


def test_real_provider_requires_sharing_consent(client, auth, monkeypatch):
    class Real:
        name, is_mock = "real", False

        def generate(self, *a, **k):
            raise AssertionError("should not be called without consent")

    monkeypatch.setattr(chat_router, "get_provider", lambda: Real())
    body = client.post("/chat", json={"message": "I'm stressed about exams"}, headers=auth).json()
    assert body["ai_available"] is False and "Settings" in body["reply"]


def test_personalization_off_removes_context(client, auth):
    from app.ai.personalization import build_context
    from app.db import SessionLocal
    from app.models import User

    client.put("/onboarding", json={"consent_to_save": True, "main_concern": "studies", "stress_level": 7}, headers=auth)
    with SessionLocal() as db:
        user = db.query(User).first()
        assert "studies" in build_context(db, user)
        user.personalization_enabled = False
        db.commit()
        assert build_context(db, user) == ""


def test_chat_content_not_written_to_logs(client, auth, caplog):
    secret = "my-very-private-sentence-about-my-sister"
    with caplog.at_level(logging.DEBUG):
        client.post("/chat", json={"message": f"I'm stressed. {secret}"}, headers=auth)
    assert secret not in caplog.text


def test_rate_limit(client, auth, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "chat_rate_limit_per_minute", 2)
    codes = [client.post("/chat", json={"message": "hello there"}, headers=auth).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_welcome_endpoint_is_static_not_ai(client, auth):
    body = client.get("/chat/welcome", headers=auth).json()
    assert body["ai_generated"] is False and body["message"]


def test_guest_flow_defaults_to_privacy_preserving(client):
    r = client.post("/auth/guest").json()
    assert r["user"]["is_guest"] and r["user"]["save_chat_history"] is False
    assert "Prototype" in r["prototype_notice"]


def test_second_user_helper_works(client):
    assert make_user(client, "x@example.com")


# ---------------- the spec's example conversation (mock mode) ----------------

def test_example_conversation_acknowledges_and_asks_one_question(client, auth):
    first = client.post("/chat", json={"message": "I'm really stressed about my exams. I feel like I'm going to disappoint everyone."},
                        headers=auth).json()
    assert "pressure" in first["reply"].lower() and "expectations" in first["reply"].lower()
    assert first["reply"].count("?") == 1

    history = [{"role": "user", "content": "I'm really stressed about my exams. I feel like I'm going to disappoint everyone."},
               {"role": "assistant", "content": first["reply"]}]
    second = client.post("/chat", json={"message": "Mostly my own expectations. I feel like I'm never doing enough.",
                                        "history": history}, headers=auth).json()
    assert "own expectations" in second["reply"].lower()
    assert "explore that thought" in second["reply"] and "plan for today" in second["reply"]  # offers a choice
    assert second["reply"] != first["reply"]


def test_short_followup_uses_earlier_context(client, auth):
    history = [{"role": "user", "content": "I'm so anxious about my exams"}, {"role": "assistant", "content": "ok"}]
    body = client.post("/chat", json={"message": "it keeps me up at night", "history": history}, headers=auth).json()
    assert "worry" in body["reply"].lower() or "worr" in body["reply"].lower()
    assert "studies" in body["reply"].lower()


def test_generic_message_still_gets_a_listening_reply(client, auth):
    body = client.post("/chat", json={"message": "Things have just been strange lately and I can't explain it"}, headers=auth).json()
    assert "listening" in body["reply"].lower() and body["reply"].count("?") == 1
