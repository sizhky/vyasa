# Debug Perf Use Rules

Use debug/perf tracing when:

- A page render is slow.
- A static build stage regresses.
- A plugin or extension adds measurable work.
- A suspected bottleneck needs evidence.

Rules:

- Prefer one concrete trace over guesses.
- Keep tracing low overhead.
- Remove noisy one-off probes after the diagnosis unless they become durable spans.
