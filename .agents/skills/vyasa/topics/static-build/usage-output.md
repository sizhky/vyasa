# Static Build Usage And Output

Build examples:

```bash
vyasa build . --output dist
vyasa build docs --output public
vyasa build . --show-hidden
```

Static build generates HTML, assets, routes, downloads, and copied extension assets needed by the site.
Runtime and static output should match for page HTML and behavior.

Do not rely on server-only host/port config in static mode.
