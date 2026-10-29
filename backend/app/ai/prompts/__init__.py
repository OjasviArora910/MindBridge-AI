"""Version-controlled system prompt loading.

To change the chatbot's behaviour, add a new `system_prompt_vN.txt`, bump
PROMPT_VERSION, and review the diff like any other code change.
"""
from pathlib import Path

PROMPT_VERSION = "v1"
_PROMPT_DIR = Path(__file__).parent


def load_system_prompt(version: str = PROMPT_VERSION) -> str:
    return (_PROMPT_DIR / f"system_prompt_{version}.txt").read_text(encoding="utf-8").strip()
