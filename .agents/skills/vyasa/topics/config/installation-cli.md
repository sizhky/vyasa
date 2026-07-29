# Installation And CLI

Install:

```bash
pip install vyasa
pip install 'vyasa[oauth]'
```

Common CLI:

```bash
vyasa [path]
vyasa --host 0.0.0.0 --port 8080
vyasa --show-hidden
vyasa build [path] --output dist
```

CLI flags override `.vyasa` and environment variables.
When `vyasa [path]` receives a path, keep reading behavior settings such as
`port`, themes, and extensions from the launch folder's `.vyasa`. Use the
explicit path as the only content root, ignoring `root`, `vyasa_roots`,
`ignore_cwd_as_root`, and other content mounts from that config. Preserve this
override in source-reload worker processes.
Use `--show-hidden` only when hidden files should be visible.
