"""MindBridge AI API entrypoint."""
import logging
import time

# Use the OS certificate store so HTTPS to the LLM provider works behind
# corporate TLS inspection. Optional: skipped if truststore isn't installed.
try:
    import truststore

    truststore.inject_into_ssl()
except ImportError:
    pass

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import models  # noqa: F401  (registers tables)
from .config import get_settings
from .db import Base, engine
from .routers import assessments, auth, chat, dashboard, data, diary, mood, profile, reports, safety_routes

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
access_log = logging.getLogger("mindbridge.access")  # method, path template, status, ms. Never bodies or queries.

settings = get_settings()
app = FastAPI(title="MindBridge AI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def privacy_safe_logging(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    route = request.scope.get("route")
    path = getattr(route, "path", "unmatched")  # template like /mood/{entry_id}, not the raw URL
    access_log.info("%s %s %s %.0fms", request.method, path, response.status_code, (time.perf_counter() - start) * 1000)
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    # Do not echo exception text: it could contain user content.
    logging.getLogger("mindbridge.error").error("unhandled %s", type(exc).__name__)
    return JSONResponse({"detail": "Something went wrong on our side. Please try again."}, status_code=500)


if settings.auto_create_tables:
    Base.metadata.create_all(engine)

for r in (auth.router, profile.router, chat.router, mood.router, diary.router, assessments.router,
          dashboard.router, reports.router, data.router, safety_routes.router):
    app.include_router(r)


@app.get("/health")
def health():
    return {"status": "ok"}
