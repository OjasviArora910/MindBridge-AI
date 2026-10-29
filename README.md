# MindBridge AI

A calm, private emotional-support and self-reflection companion: a context-aware chat, mood and sleep tracking, a CBT-inspired thought diary, fullscreen SOS exercises, a progress dashboard, user-approved summaries, and a **separate safety workflow** that runs before any AI reply.

It does not diagnose, prescribe, or replace professional care, and it never labels a user because of their answers, ratings, or conversation.

> **Status: working MVP / prototype.** See [What is mocked or unfinished](#what-is-mocked-or-unfinished) before sharing it with real users.

## Contents
- [Quick start](#quick-start) · [Docker](#docker) · [Configuration](#configuration) · [Migrations](#database-migrations)
- [Tests](#tests-and-what-was-actually-run) · [How it works](#how-it-works) · [Safety](#safety-workflow) · [Privacy](#privacy-model)
- [Support resources](#support-resources-must-be-verified-before-release) · [Design & accessibility](#design-and-accessibility)
- [What is mocked or unfinished](#what-is-mocked-or-unfinished)

## Quick start

Needs Python 3.11+ and Node 20+. No API key is needed: the default **mock mode** is a rule-based stand-in, clearly labelled in the UI.

```bash
# 1. Backend (http://localhost:8000, docs at /docs)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                       # SQLite + mock LLM by default
python -m uvicorn app.main:app --reload --port 8000

# 2. Frontend (http://localhost:5173), in a second terminal
cd frontend
npm install
npm run dev                                # /api is proxied to localhost:8000
```

Open http://localhost:5173, choose **Let's get started → Continue as guest**.

## Docker

```bash
cp .env.example .env        # optional; defaults work for a local demo
docker compose up --build   # web UI: http://localhost:8080, API docs: http://localhost:8000/docs
```
Starts PostgreSQL, the API (runs `alembic upgrade head` first), and the web UI behind nginx.
**Not yet run:** the compose file passes `docker compose config`, but no Docker daemon was available where this was built, so the images have not been built or started.

## Configuration

Server-side only. The browser never receives provider keys.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./mindbridge.db` | Use `postgresql+psycopg://user:pass@host/db` for PostgreSQL |
| `SECRET_KEY` | dev value | Signs session tokens. **Change it** outside local development |
| `LLM_PROVIDER` | `mock` | `mock` or `openai_compatible` |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | | Any server exposing `/chat/completions` |
| `LLM_TIMEOUT_SECONDS` | `20` | Timeouts become a graceful fallback, never a made-up reply |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated |
| `AUTO_CREATE_TABLES` | `true` | Convenience for SQLite. Set `false` and use Alembic for PostgreSQL |
| `CHAT_RATE_LIMIT_PER_MINUTE` | `30` | Per-user, in-memory (prototype) |

To use a real model: set `LLM_PROVIDER=openai_compatible` plus the URL/key/model. Each user must also switch on **"Allow sharing my messages with the AI provider"** in Settings & Privacy. Until they do, no message is sent to the provider. To add a different provider, subclass `LLMProvider` in `backend/app/ai/llm.py`.

## Database migrations

```bash
cd backend
alembic upgrade head                              # apply
alembic revision --autogenerate -m "describe it" # after changing app/models.py
```

## Tests, and what was actually run

| Suite | Command | Result when this was built |
|---|---|---|
| Backend (pytest) | `cd backend && python -m pytest` | **81 passed** |
| Frontend (Vitest + Testing Library + axe) | `cd frontend && npm test` | **35 passed** |
| Type check + production build | `npm run build` | passed |
| Live smoke test | backend + Vite proxy, full guest journey over HTTP | passed |
| End-to-end (Playwright) | `npx playwright install chromium && npm run e2e` | **written, NOT run**: no browser could be installed in the build environment |
| Docker images | `docker compose up --build` | **NOT run** (no Docker daemon available) |
| Real-browser accessibility / layout | in the Playwright spec (axe incl. colour contrast, overflow check) | **NOT run** |

Covered by automated tests: onboarding (complete, skip, back, edit, consent), chat behaviour and fallbacks, provider failure, unsafe-output blocking, mood/sleep CRUD, diary, dashboard values, reports (only selected, non-excluded data), data export/delete, cross-user access (404 on every owned resource), auth, privacy-safe logging, 44 safety test cases, SOS exercise controls (no autoplay, pause/skip/exit, reduced motion), support resources, and colour contrast computed from the real design tokens.

**Not covered:** keyboard and screen-reader behaviour was checked only through automated rules (axe in jsdom plus ARIA roles/labels), not with an actual screen reader. Mobile layout (no horizontal overflow, keyboard-aware composer) was built responsively but not verified on a device or real browser.

## How it works

```
frontend/ (React, TypeScript, Vite, Tailwind, Recharts)  ──/api──▶  backend/ (FastAPI, SQLAlchemy, Pydantic)
                                                                      ├─ app/routers/*      validated endpoints, ownership checks
                                                                      ├─ app/ai/safety.py  reviewed rules, run BEFORE the model
                                                                      ├─ app/ai/llm.py     provider-neutral adapter (+ mock)
                                                                      ├─ app/ai/prompts/   versioned system prompt (v1)
                                                                      └─ app/ai/personalization.py  explicit, request-time context
```

- **Onboarding:** four optional-feeling questions with Back / Skip / Edit and an explicit "save or use once" choice. The stress score is stored as a self-rating and described to the model as "not a clinical score, not evidence of safety".
- **Chat:** safety rules → (if clear) model with system prompt + length preference + consented context → output guard → reply. Failures show a fixed message; nothing is invented. Messages are stored only if the user turns history on.
- **SOS exercises:** pure front-end data and timers; they work with no account, network or LLM. Nothing autoplays; sound is off by default; reduced motion removes the animation.
- **Self-assessments:** the interface (`backend/app/assessments.py`) exists, but **no questionnaire content or scoring is shipped**. PHQ-9, GAD-7, Rosenberg and a burnout measure appear as "not available yet".
- **Reports:** preview → edit → approve → export. Text is returned to the user only; only metadata is stored.

## Safety workflow

`backend/app/ai/safety.py` classifies each message with explicit rules into `none`, `distress`, `ambiguous` or `urgent`:

- **urgent / ambiguous:** the model is **not called**. The user gets a fixed, compassionate response that asks the necessary direct question, states that MindBridge can't contact anyone or monitor them, and shows region-appropriate support options inside the chat.
- **distress:** the chat continues with extra guidance to the model to gently mention human support, and support options are shown quietly.
- Short follow-ups ("yes") after a risk message stay in the careful workflow.
- The onboarding score is never used to decide safety. User text and retrieved content can't switch the rules off (tested with an injection attempt).
- Model output is checked before display: diagnosis language, medication advice, claims of having contacted anyone, and unverified phone numbers are blocked.
- Logs contain event names and levels only, never message text.

**This needs professional review before release.** The phrase lists and response wording are an engineering starting point written without clinical input. They will miss phrasing (including Hindi and Hinglish, which are not covered) and can both over- and under-trigger. Have qualified mental-health professionals review the scenarios, wording and follow-up flow, and test with real-world phrasing.


#
## What is mocked or unfinished

- **Mock LLM:** default replies come from a rule-based stand-in, labelled in the UI. Real-model quality and safety have **not** been evaluated; the real provider path is implemented but was only exercised with stubs, never against a live service.
- **Safety rules and wording** need clinical review (see above). English only.
- **Hindi:** the architecture is ready (language setting, shared string file) but only English ships.
- **Self-assessments:** interface only; no instruments.
- **RAG over reviewed resources:** not implemented. Retrieval citations and the abstention path are not built.
- **Reports:** text download and browser print-to-PDF only; no server-side PDF.
- **Auth, rate limiting, encryption at rest, backups, retention schedule:** prototype level (see Privacy).
- **Mood "trends" are simple** (daily rating line, sleep bars, count-based sentences) by design.
- **Unrun:** Playwright e2e, Docker build, real-browser accessibility/contrast scan, device testing.
