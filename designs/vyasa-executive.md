# Design System Strategy: The Executive Manuscript

## 1. Overview & Creative North Star
**Creative North Star: "The Digital C-Suite"**
This design system is engineered to evoke the gravitas of a high-end legal firm or a prestigious editorial masthead. It moves away from the "app-like" fluff of standard SaaS interfaces, favoring a layout that feels like a meticulously curated dossier. We achieve this through **Intentional Asymmetry**—where large, prestigious headers are offset against dense, precise data—and **Tonal Depth**, using color shifts rather than lines to define the architecture.

The goal is an interface that doesn't just display information but *authorizes* it. We use expansive white space (negative space) not just for breathing room, but as a tool of luxury and focus.

---

## 2. Color & Atmospheric Depth
The palette is rooted in deep obsidian and slate tones, punctuated by the "Amber" (`tertiary`) highlight to draw the eye to critical actions.

### The "No-Line" Rule
**Prohibit 1px solid borders for sectioning.** To maintain an executive feel, boundaries are defined by background transitions.
* Place a `surface-container-low` section against a `surface` background to create a subtle break.
* If a visual separator is needed, use a `32px` vertical gap from the spacing scale rather than a divider line.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, physical materials.
* **Base Layer:** `surface` (#0b1326) for the primary canvas.
* **Structural Sections:** Use `surface-container-low` (#131b2e) for sidebars or secondary content areas.
* **Interactive Cards:** Use `surface-container` (#171f33) or `surface-container-high` (#222a3d) to create a "lifted" feel.
* **The Signature Glow:** Use `tertiary_container` (#1d0f00) behind `tertiary` text to create a soft, backlit "amber glow" for high-priority alerts or badges.

### The Glass & Gradient Rule
For floating menus or modals, use `surface_bright` at 80% opacity with a `backdrop-blur` of 20px. This prevents the dark theme from feeling heavy and adds a modern, "translucent slate" texture. Use a subtle linear gradient from `primary` (#b9c7df) to `on_primary_container` (#707e94) for hero CTAs to give them a metallic, die-cast finish.

---

## 3. Typography
The tension between the academic `Cormorant Garamond` (rendered via `newsreader` tokens) and the technical `Inter` is the core of this system's prestige.

* **Display & Headlines (`newsreader`):** Used for titles that need to feel "stated" rather than "shown." The serif adds a layer of heritage and human intellect.
* *Rule:* Headlines should always have a tighter letter-spacing (-0.02em) to look like printed ink.
* **Title & Body (`inter`):** Used for the "Work." Inter provides the precision required for data, labels, and functional UI elements.
* *Rule:* Use `body-md` for standard reading, but elevate "key data points" to `title-md` in `primary` color to ensure they command attention.

---

## 4. Elevation & Depth
In this system, shadows are almost invisible, and lines are forbidden.

* **Tonal Layering:** To highlight a card, don't add a shadow; shift its background from `surface-container` to `surface-container-highest`. This "Natural Lift" mimics how light hits different planes of stone.
* **The "Ghost Border" Fallback:** If accessibility requires a container edge (e.g., in complex forms), use `outline_variant` (#444748) at **15% opacity**. It should be a whisper of a line, not a statement.
* **Ambient Shadows:** For high-level modals, use a shadow with a 60px blur, 0px offset, and 6% opacity using the `on_background` color. This creates an atmospheric "halo" rather than a dirty drop-shadow.

---

## 5. Components

### Buttons: The Executive Seal
* **Primary:** Background: `tertiary` (#ffb95f), Text: `on_tertiary` (#472a00). Radius: `sm` (0.125rem). The sharp corners reflect the "Round 2" precision.
* **Secondary:** Background: `surface_container_high`, Text: `primary`. No border.
* **Tertiary:** Ghost style. `label-md` uppercase with 0.1em letter spacing.

### Cards & Data Lists
* **The Rule of Silence:** Forbid divider lines. Separate list items using `12` (3rem) or `16` (4rem) spacing.
* **Selection:** On hover, a card should shift to `surface_bright`. No border change.

### Input Fields
* **Style:** Underline only. Use `outline` (#8e9192) for the inactive state. On focus, transition the underline to `tertiary` (#ffb95f) and add a subtle `tertiary_container` glow to the text area.
* **Corner Treatment:** Maintain the `sm` (0.125rem) radius on the top corners for a "Tab" look.

### Chips: The Indicator
* Use `secondary_container` for the background with `on_secondary_container` for text. For "Active" status, use `tertiary` text with a 2px solid `tertiary` left-edge accent—never a full border.

---

## 6. Do’s and Don’ts

### Do:
* **Use Asymmetric Margins:** Place text content 1/3rd from the left to create an editorial layout that feels custom-designed.
* **Embrace the Dark:** Allow large areas of `surface` (#0b1326) to remain empty. In executive design, empty space is a sign of confidence.
* **Use the Spacing Scale:** Stick strictly to the `8` (2rem) and `12` (3rem) increments for section padding to ensure structural rhythm.

### Don't:
* **Don't use pure white:** Never use #FFFFFF. Always use `on_surface` (#dae2fd) to maintain the soft, slate-tinted legibility that reduces eye strain.
* **Don't round corners:** Avoid `xl` or `full` radii. The "Professional Slate" aesthetic relies on the `sm` (0.125rem) and `md` (0.375rem) tokens to feel architectural and sharp.
* **Don't use generic icons:** Avoid playful, rounded iconography. Use thin-stroke (1px or 1.5px) icons with sharp terminals.