# Design System Specification: Scholarly High-End Editorial

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Living Archive."** 

This isn’t just a static digital interface; it is a premium editorial experience that feels as curated as a rare book collection and as dynamic as a modern research laboratory. We move beyond the "template" look by embracing **Intentional Asymmetry**. This means using staggered layouts, overlapping typographical elements, and high-contrast font pairings that demand attention. 

The system rejects the rigid constraints of traditional "web boxes" in favor of **Tonal Layering**. By using varying depths of parchment and ink, we create a sense of physical stacking—as if the user is arranging fine sheets of paper on a heavy oak desk. This is Scholarly Minimalism with a high-velocity edge.

---

## 2. Colors
Our palette is rooted in the heritage of scholarship, but executed with high-energy modernism.

### The Palette (Material Convention)
- **Primary (Scholar Red):** `#b7102a` — Use for high-energy accents, key calls to action, and critical brand moments.
- **Secondary (Sophisticated Ink):** `#485f84` — Provides the deep contrast necessary for a professional, authoritative tone.
- **Background (Parchment):** `#f3fcf0` — A soft, warm-neutral canvas that prevents eye fatigue.
- **Surface Tiers:**
  - `surface_container_lowest`: `#ffffff` (Purest lift)
  - `surface_container_low`: `#edf6ea` (Standard resting state)
  - `surface_container_high`: `#e2ebdf` (Deepest indentation)

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders for sectioning or containment. Boundaries must be defined solely through background color shifts. To separate content, place a `surface_container_low` section against a `surface` background. The contrast is subtle, but the human eye perceives the structural change without the visual noise of a line.

### Glass & Gradient Signature
To move beyond a flat "out-of-the-box" feel, use **Glassmorphism** for floating menus or navigation bars. Utilize `surface` colors at 80% opacity with a `12px` backdrop-blur. 
- **The Gradient Rule:** For main Hero backgrounds or primary CTAs, use a subtle linear gradient from `primary` (#b7102a) to `primary_container` (#db313f). This adds "soul" and dimension, mimicking the way light hits a lacquered surface.

---

## 3. Typography
The system utilizes a dual-typeface strategy to balance utility with editorial flair.

*   **Display & Headlines (Newsreader):** Use for all `display-lg` through `headline-sm`. Newsreader brings a sophisticated, serif authority. It should be typeset with slightly tighter tracking (-2%) to feel modern and intentional.
*   **UI & Body (Manrope):** Use for all `title`, `body`, and `label` roles. Manrope’s geometric clarity ensures maximum readability in dense data environments.

**Typographical Hierarchy:**
- **Display Large (3.5rem):** High-impact editorial statements.
- **Title Medium (1.125rem):** The workhorse for dashboard cards and navigation.
- **Label Small (0.6875rem):** All-caps with 5% tracking for metadata and overlines.

---

## 4. Elevation & Depth
In this system, elevation is an optical illusion created by tone, not by heavy shadows.

### The Layering Principle
Depth is achieved by "stacking" the surface-container tiers. 
- **Action:** Place a `surface_container_lowest` (#ffffff) card on top of a `surface_container_low` (#edf6ea) section. This creates a soft, natural "lift" that feels integrated into the parchment environment.

### Ambient Shadows
If a floating effect is required (e.g., a modal or a primary floating action button), shadows must be:
- **Blur:** 24px - 40px
- **Opacity:** 4% - 8%
- **Color:** Use a tinted version of `on_surface` (#161d16). Never use pure black shadows; they feel "dirty" on parchment.

### The "Ghost Border" Fallback
If accessibility requirements demand a border, use the **Ghost Border**: the `outline_variant` (#e4bebc) at **15% opacity**. It should be felt rather than seen.

---

## 5. Components

### Buttons
- **Primary:** Scholar Red gradient fill. No border. `xl` roundedness (0.75rem). Text in `on_primary` (White).
- **Secondary:** Transparent fill with a `surface_container_high` background on hover. 
- **Tertiary:** Text-only in `secondary` (Ink) with a 1px `on_secondary_fixed_variant` underline.

### Cards & Content Modules
- **Rule:** Forbid the use of divider lines within cards.
- **Implementation:** Use vertical white space from the **Spacing Scale** (e.g., `spacing-6` or 2rem) to separate header from body. Change the background color of the card footer to `surface_container_highest` to denote a different functional area.

### Input Fields
- **Base State:** `surface_container_low` background with a `sm` (0.125rem) roundedness to maintain a "scholarly" sharp edge.
- **Focus State:** No thick border. Instead, use a 2px `primary` (Red) bottom-accent bar and a subtle glow.

### Signature Component: The "Scholar's Tray"
A slide-out drawer or persistent sidebar using **Glassmorphism** (backdrop-blur) and `surface_container_lowest` at 90% opacity. Use this for deep-dive research or secondary metadata.

---

## 6. Do's and Don'ts

### Do
- **Do** use intentional asymmetry. Overlap an image slightly over a headline to create a "custom-built" feel.
- **Do** use the Spacing Scale rigorously. Large gaps (e.g., `spacing-16` / 5.5rem) are your friend; they convey luxury.
- **Do** use `Newsreader` for quotes and "asides" within body text to maintain the editorial voice.

### Don't
- **Don't** use 1px solid lines to separate list items. Use tonal shifts or `spacing-2` gaps.
- **Don't** use standard "Drop Shadows." If the element isn't physically floating in the logic of the UI, it shouldn't have a shadow.
- **Don't** use pure black text. Use `on_background` (#161d16) for a softer, more premium "ink on paper" contrast.