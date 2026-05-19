# Debug Perf Shape And Spans

`debug_perf` exposes timing spans for request/render work.
Use it to identify where time went and compare changes.

Span names should be stable and specific enough to compare across runs.
Keep instrumentation close to the behavior it measures.
Avoid using trace labels as user-facing copy.
