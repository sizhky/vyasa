# Installation And CLI

Install:

```bash
pip install vyasa
pip install 'vyasa[oauth]'
```

Common CLI:

```bash
vyasa serve [path]
vyasa serve --host 0.0.0.0 --port 8080
vyasa serve --show-hidden
vyasa build [path] --output dist
```

CLI flags override `.vyasa` and environment variables.
Use `--show-hidden` only when hidden files should be visible.
