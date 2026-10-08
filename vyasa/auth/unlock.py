"""Shared role passwords: a reader unlocks a role for their session without an account.

`.vyasa` maps roles to salted scrypt hashes, made by `vyasa hash-password`:

    [role_passwords]
    expt = "scrypt$16384$8$1$<salt>$<hash>"

The session keeps each unlocked role with a fingerprint of its hash, so changing a
password locks every session that used the old one.
"""
import base64
import hashlib
import hmac
import os
import time
from typing import TypeGuard

SESSION_KEY = "unlocked_roles"
N, R, P, KEY_BYTES = 2**14, 8, 1, 32
FAILURE_WINDOW_SECONDS, FAILURES_ALLOWED = 60, 5
_failures: dict[str, list[float]] = {}


def hash_password(password: str, salt: bytes | None = None) -> str:
    """
    >>> encoded = hash_password("open sesame", salt=b"0123456789abcdef")
    >>> encoded.split("$")[:4]
    ['scrypt', '16384', '8', '1']
    >>> verify_password("open sesame", encoded), verify_password("wrong", encoded)
    (True, False)
    """
    salt = salt or os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=N, r=R, p=P, dklen=KEY_BYTES)
    encode = lambda raw: base64.b64encode(raw).decode()
    return f"scrypt${N}${R}${P}${encode(salt)}${encode(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    """
    >>> verify_password("x", "not-a-hash"), verify_password("x", "scrypt$1$2$3$!!$!!")
    (False, False)
    """
    try:
        scheme, n, r, p, salt, digest = encoded.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest)
        actual = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p), dklen=len(expected))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def matching_roles(password: str, role_passwords: dict) -> list[str]:
    """Every role whose hash accepts the password. All hashes are checked, so timing does not reveal which matched.

    >>> roles = {"a": hash_password("one"), "b": hash_password("two"), "c": hash_password("one")}
    >>> matching_roles("one", roles)
    ['a', 'c']
    """
    results = [(role, verify_password(password, str(encoded))) for role, encoded in role_passwords.items()]
    return [role for role, ok in results if ok]


def fingerprint(encoded: str) -> str:
    return hashlib.sha256(str(encoded).encode()).hexdigest()[:16]


def unlocked_roles(session, role_passwords: dict) -> list[str]:
    """Roles in the session whose password is unchanged since unlock.

    >>> roles = {"a": "scrypt$hash-a", "b": "scrypt$hash-b"}
    >>> session = {}
    >>> grant(session, ["a"], roles); unlocked_roles(session, roles)
    ['a']
    >>> unlocked_roles(session, {"a": "scrypt$rotated"})
    []
    """
    granted = session.get(SESSION_KEY) or {}
    return [role for role, mark in granted.items() if role in role_passwords and mark == fingerprint(role_passwords[role])]


def grant(session, roles: list[str], role_passwords: dict) -> None:
    granted = dict(session.get(SESSION_KEY) or {})
    granted.update({role: fingerprint(role_passwords[role]) for role in roles})
    session[SESSION_KEY] = granted


def lock(session) -> None:
    session.pop(SESSION_KEY, None)


def unlock_auth(session, role_passwords: dict) -> dict | None:
    """Auth for a reader with no account who unlocked roles. `provider` marks it as not a signed-in user."""
    roles = unlocked_roles(session, role_passwords)
    return {"provider": "unlock", "roles": roles} if roles else None


def is_signed_in(auth) -> TypeGuard[dict]:
    """
    >>> is_signed_in({"provider": "unlock", "roles": ["a"]}), is_signed_in({"provider": "local", "username": "y"}), is_signed_in(None)
    (False, True, False)
    """
    return bool(auth) and auth.get("provider") != "unlock"


def throttled(client: str, now: float | None = None) -> bool:
    """True after too many recent failures from one client.

    >>> _failures.clear(); [record_failure("ip", now=0.0) for _ in range(5)] and throttled("ip", now=1.0)
    True
    >>> throttled("ip", now=120.0)
    False
    """
    now = time.monotonic() if now is None else now
    recent = [t for t in _failures.get(client, []) if now - t < FAILURE_WINDOW_SECONDS]
    _failures[client] = recent
    return len(recent) >= FAILURES_ALLOWED


def record_failure(client: str, now: float | None = None) -> None:
    _failures.setdefault(client, []).append(time.monotonic() if now is None else now)


def hash_password_command(argv: list[str]) -> int:
    """`vyasa hash-password [role]`: prompt twice, print a `[role_passwords]` line for `.vyasa`."""
    import getpass
    import sys

    role = argv[0] if argv else "role"
    if role == "full":
        print("The `full` role is the admin role and cannot have a shared password.", file=sys.stderr)
        return 2
    password = getpass.getpass("Password: ")
    if not password or password != getpass.getpass("Repeat password: "):
        print("Passwords are empty or do not match.", file=sys.stderr)
        return 1
    print("Add this to .vyasa:\n\n[role_passwords]")
    print(f'{role} = "{hash_password(password)}"')
    return 0
