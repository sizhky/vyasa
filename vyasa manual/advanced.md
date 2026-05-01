# Advanced Behavior

Vyasa stays simple at the entry point, but it has a few deeper behaviors that change how you structure long-running docs and presentations. This page is for the moment when the basics already work and you want to lean into slides, richer navigation, or document-shaped demos. By the end, you should know which "advanced" features are still just Markdown with better routing. The safest way to think about them is that Vyasa keeps reusing the same source document in more than one reading mode.

## Slides Are A Document View, Not A Second Artifact

[`demo/vyasa-slides.md`](/Users/yeshwanth/Code/Personal/vyasa/demo/vyasa-slides.md) is the best reusable example in the repo, because it explains the slide system in the same medium it uses. Slide decks are assembled in [`render_slide_deck()`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/content_routes.py) and [`vyasa/slides.py`](/Users/yeshwanth/Code/Personal/vyasa/vyasa/slides.py): `##` splits horizontal slides, deeper headings become downward detail, and each slide gets a real URL. That means the normal document stays the source of truth while presentation mode becomes another route, not another file to maintain.

## Other Useful Escape Hatches

| Feature | Why you would reach for it |
|---|---|
| slide reveal config | Control how dense slides appear without rewriting the doc. |
| folder-local ordering | Turn a branch of notes into a deliberate reading sequence. |
| inline HTML demos | Prove a visual idea quickly before hardening it into theme CSS. |
