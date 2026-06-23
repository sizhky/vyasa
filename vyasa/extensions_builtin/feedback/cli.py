from __future__ import annotations

import argparse
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlencode, urlparse
from urllib.request import Request, urlopen

DEFAULT_POLL_TIMEOUT_SECONDS = 30 * 60
MAX_POLL_TIMEOUT_SECONDS = 60 * 60


def feedback_command(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="vyasa feedback", description="Listen and respond to Vyasa document feedback")
    subparsers = parser.add_subparsers(dest="command", required=True)

    poll = subparsers.add_parser("poll", help="Wait until feedback is ready for a Vyasa URL")
    _url_argument(poll)
    poll.add_argument("--after", type=int)
    poll.add_argument("--timeout", type=float, default=DEFAULT_POLL_TIMEOUT_SECONDS)
    poll.add_argument("--json", action="store_true", help="Emit JSON instead of token-light TOON")

    reply = subparsers.add_parser("reply", help="Publish an agent reply and optionally acknowledge feedback")
    _url_argument(reply)
    reply.add_argument("--message", required=True)
    reply.add_argument("--ack", type=int, dest="ack_cursor")
    reply.add_argument("--then-poll", action="store_true", help="After publishing the reply, wait for the next feedback event")
    reply.add_argument("--timeout", type=float, default=DEFAULT_POLL_TIMEOUT_SECONDS, help="Long-poll timeout for --then-poll")
    reply.add_argument("--json", action="store_true")

    ack = subparsers.add_parser("ack", help="Acknowledge safely consumed feedback")
    _url_argument(ack)
    ack.add_argument("cursor", type=int)
    ack.add_argument("--json", action="store_true")

    status = subparsers.add_parser("status", help="Read feedback session state")
    _url_argument(status)
    status.add_argument("--json", action="store_true")

    args = parser.parse_args(argv)
    base, document, document_url = resolve_document_url(args.url, args.server)
    api = f"{base}/api/feedback"
    encoded_document = quote(document, safe="/@:")
    try:
        if args.command == "poll":
            query = {"timeout": _poll_timeout(args.timeout)}
            if args.after is not None:
                query["after"] = max(0, args.after)
            result = request_json(f"{api}/poll/{encoded_document}?{urlencode(query)}", timeout=_client_timeout(args.timeout))
            if result.get("status") == "feedback":
                result["next_step"] = (
                    f"After applying feedback, run `vyasa feedback reply {json.dumps(document_url)} "
                    f"--ack {result.get('cursor', 0)} --message \"<summary>\" --then-poll`."
                )
        elif args.command == "reply":
            payload = {"message": args.message}
            if args.ack_cursor is not None:
                payload["ack_cursor"] = args.ack_cursor
            result = request_json(f"{api}/reply/{encoded_document}", method="POST", payload=payload)
            if args.then_poll:
                after = result.get("ack_cursor")
                if not isinstance(after, int):
                    after = args.ack_cursor or 0
                query = {"timeout": _poll_timeout(args.timeout), "after": max(0, after)}
                result = request_json(f"{api}/poll/{encoded_document}?{urlencode(query)}", timeout=_client_timeout(args.timeout))
        elif args.command == "ack":
            result = request_json(f"{api}/ack/{encoded_document}", method="POST", payload={"cursor": args.cursor})
        else:
            result = request_json(f"{api}/session/{encoded_document}")
    except (HTTPError, URLError, TimeoutError, ValueError) as error:
        print(f"feedback error: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2) if args.json else format_toon(result))
    return 0


def _poll_timeout(value: float) -> float:
    return max(0.0, min(float(value), MAX_POLL_TIMEOUT_SECONDS))


def _client_timeout(value: float) -> float:
    return _poll_timeout(value) + 10


def _url_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("url", help="Vyasa document URL or document slug")
    parser.add_argument("--server", default=os.environ.get("VYASA_URL", "http://127.0.0.1:5001"))


def resolve_document_url(value: str, server: str) -> tuple[str, str, str]:
    parsed = urlparse(value)
    if parsed.scheme and parsed.netloc:
        base = f"{parsed.scheme}://{parsed.netloc}"
        route = parsed.path.strip("/")
        for prefix in ("posts/", "slides/"):
            if route.startswith(prefix):
                route = route[len(prefix):]
                break
        document = route.removesuffix(".html").removesuffix(".pdf").removesuffix(".md")
        ref = parse_qs(parsed.query).get("ref", [""])[0]
        if ref and document:
            first, slash, rest = document.partition("/")
            document = f"{first}@{ref.replace('/', ':')}{slash}{rest}"
        return base.rstrip("/"), document, value
    base = server.rstrip("/")
    document = value.strip("/")
    return base, document, f"{base}/posts/{quote(document, safe='/@:')}"


def request_json(url: str, *, method: str = "GET", payload: dict | None = None, timeout: float = 60) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = Request(url, data=data, method=method, headers=headers)
    try:
        with urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise ValueError(f"HTTP {error.code}: {detail}") from error
    if not isinstance(result, dict):
        raise ValueError("Vyasa feedback API returned a non-object response")
    return result


def format_toon(payload: dict) -> str:
    lines: list[str] = []
    for key, value in payload.items():
        if key == "events" and isinstance(value, list):
            fields = ("cursor", "id", "surface", "comment", "revision", "created_at")
            lines.append(f"events[{len(value)}]{{{','.join(fields)}}}:")
            for event in value:
                if not isinstance(event, dict):
                    continue
                lines.append("  " + ",".join(_scalar(event.get(field, "")) for field in fields))
                target = event.get("target")
                snapshot = event.get("snapshot")
                if target:
                    lines.append(f"    target: {json.dumps(target, separators=(',', ':'))}")
                if snapshot:
                    lines.append(f"    snapshot: {json.dumps(snapshot, separators=(',', ':'))}")
        elif isinstance(value, (dict, list)):
            lines.append(f"{key}: {json.dumps(value, separators=(',', ':'))}")
        else:
            lines.append(f"{key}: {_scalar(value)}")
    return "\n".join(lines)


def _scalar(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    return json.dumps(str(value), ensure_ascii=False)


if __name__ == "__main__":
    raise SystemExit(feedback_command())
