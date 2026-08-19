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

Read Markdown sections directly from any filesystem path:

```bash
vyasa sections /path/to/document.md
vyasa sections /path/to/document.md '### Heading'
vyasa sections /path/to/document.md '### Heading' --include-children
```

The first form prints only ATX heading lines (`#` through `######`). A heading
with an empty direct body ends in ` *`. A heading argument searches those lines
by case-insensitive contiguous text. One match prints its body; an empty body
prints the marked heading. Several matches open a numbered menu in a terminal. In a
non-interactive shell, several matches return TOON candidates and exit `2`; run
the suggested command again with one exact heading. By default, the body ends
at the next heading. Add `--include-children` to include deeper headings and
their bodies. This command does not require a running Vyasa server or a
`.vyasa` file.

CLI flags override `.vyasa` and environment variables.
When `vyasa [path]` receives a path, keep reading behavior settings such as
`port`, themes, and extensions from the launch folder's `.vyasa`. Use the
explicit path as the only content root, ignoring `root`, `vyasa_roots`,
`ignore_cwd_as_root`, and other content mounts from that config. Preserve this
override in source-reload worker processes.
Use `--show-hidden` only when hidden files should be visible.
