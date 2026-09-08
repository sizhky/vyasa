---
title: python-dotenv — one call, one decision
---

`load_dotenv()` has a small promise: read a `.env` file and make its values available through `os.environ`.

The view follows one call with no framework setup. It shows the normal path, then the one decision that changes the result: an existing environment variable wins unless `override=True`.

No part of this library sits in this repository. The pack sets `code_source=git+https://github.com/theskumar/python-dotenv@v1.0.1`, so Vyasa keeps one shallow clone under `~/.cache/vyasa/code/` and every node and edge links into it. Hover a node for the function, or an edge for the exact line that carries that step.

```items
---
items_schema: python-dotenv.kg/kg.schema
---
```

## The reader's test

After one pass, you should be able to answer three questions:

- Where does the default `.env` path come from?
- When does a parsed key change `os.environ`?
- What changes when the file is missing or `override=True` is used?

Each answer is one hover away. The five nodes name the functions that own the work. The ten edges point at the call, the return, and the two branches of the override rule.

The graph keeps the answer narrow. It does not explain every supported `.env` syntax, CLI command, or framework integration.
