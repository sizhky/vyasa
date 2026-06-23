# Extensions Route

Read code first:

- `vyasa/extensions.py`
- `vyasa/assets.py`
- `vyasa/build.py`
- The closest `vyasa/extensions_builtin/*` example.

Rules:

- Declare `ExtensionMeta`.
- Implement `EXTENSION.register(app)`.
- Register only declared capabilities.
- Keep feature code inside its module/package.
- Browser assets live under `vyasa/extensions_builtin/<extension>/static/`.
- Declare assets as `AssetBundle`s.
- Avoid `core.py` unless behavior is truly shell-global.

## Feedback Extension

For Lavish/agent feedback work, current owners are:

- `vyasa/extensions_builtin/feedback/api.py`
- `vyasa/extensions_builtin/feedback/cli.py`
- `vyasa/extensions_builtin/feedback/store.py`
- `vyasa/extensions_builtin/feedback/static/feedback.js`
- `tests/test_feedback.py`

Contracts:

- Poll is a true long-poll: it should wake on feedback and only return empty with `status: "timeout"`.
- Keep the default poll window long enough to avoid agent re-arm churn.
- Use `vyasa feedback reply <url> --ack <cursor> --message "..." --then-poll` to collapse reply and listen into one CLI turn.
- Keep feedback payloads compact. Do not send `snapshot.dom` by default; use selector/tag/selected/source context and fetch heavyweight DOM only on demand.

Fast checks:

- `python -m pytest tests/test_feedback.py`
- `node --check vyasa/extensions_builtin/feedback/static/feedback.js`
