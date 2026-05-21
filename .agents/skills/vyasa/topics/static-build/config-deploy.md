# Static Build Config And Deploy

Static mode uses content/config for generation but ignores live server host and port.
Deployment targets can include GitHub Pages, object storage, or any static host.

Rules:

- Ensure relative asset paths work for the chosen base URL.
- Ensure extension assets are copied.
- Ensure raw download routes used by diagrams are generated.
- Do not point source-backed non-markdown diagrams at rendered `/posts/...` HTML.
