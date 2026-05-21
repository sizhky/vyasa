# Layout Troubleshooting

For runtime theme switching bugs, verify actual rendered control and stacking context before retrying CSS.
Z-index changes are meaningless until the event receiver and clipping/layering ancestor are known.

For FastHTML or MonsterUI form controls, inspect rendered HTML before wiring DOM events.
Helper components may wrap or hide the native input.
If a direct `change` handler or debug-only control is needed, prefer a plain native element.

For boot-time scripts, only depend on data available in the head.
If data is body-scoped, apply it from the main runtime script after DOM creation.
