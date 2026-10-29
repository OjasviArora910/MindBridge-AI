"""Password hashing and signed session tokens (stdlib only).

PROTOTYPE NOTE: this is a deliberately small auth layer for local development.
Before a real deployment, swap it for a vetted identity provider or library
(e.g. OAuth/OIDC), add rate limiting, email verification and token revocation.
"""
import base64
import hashlib
import hmac
import secrets
import time

from .config import get_settings

_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"pbkdf2${_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def _sign(payload: str) -> str:
    key = get_settings().secret_key.encode()
    return hmac.new(key, payload.encode(), hashlib.sha256).hexdigest()


def create_token(user_id: int) -> str:
    expires = int(time.time()) + get_settings().token_ttl_hours * 3600
    payload = f"{user_id}.{expires}"
    raw = f"{payload}.{_sign(payload)}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_token(token: str) -> int | None:
    """Return the user id if the token is valid and unexpired, else None."""
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        user_id, expires, signature = raw.split(".")
        if not hmac.compare_digest(signature, _sign(f"{user_id}.{expires}")):
            return None
        if int(expires) < time.time():
            return None
        return int(user_id)
    except (ValueError, TypeError, UnicodeDecodeError):
        return None
