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
