# Design System Specification: High-End Editorial

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Scholarly Minimalist."** 

This is not a generic documentation template; it is a digital sanctuary for thought. The system rejects the "boxed-in" aesthetic of traditional software interfaces in favor of an expansive, editorial layout. We break the "template" look through **intentional asymmetry**—offsetting body text to allow for "Sidenotes" in the margin—and by using a high-contrast typography scale that values white space as much as the characters themselves. The experience should feel like reading a bespoke limited-edition journal: quiet, authoritative, and deeply intentional.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
The palette is rooted in nature and high-quality paper. We use a sophisticated Forest Green (`primary: #45655b`) as our singular point of intent.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. 
Structure must be achieved through:
1.  **Background Shifts:** Transitioning from `surface` (#f9f9f9) to `surface-container-low` (#f2f4f3).
2.  **Negative Space:** Utilizing the Spacing Scale (specifically `8` and `10`) to create "invisible" boundaries.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Each inner container should use a tier from the `surface-container` scale to define its importance:
- **Base Layer:** `surface` (#f9f9f9)
- **Secondary Content (Sidenav):** `surface-container-low` (#f2f4f3)
- **Active Accents (Search Modals/Popovers):** `surface-container-highest` (#dee4e3)

### Glass & Gradient Rule
For floating elements (like a "Back to Top" button or a sticky Table of Contents), use **Glassmorphism**. Apply `surface` with 80% opacity and a `backdrop-blur` of 12px. For primary CTAs, apply a subtle linear gradient from `primary` (#45655b) to `primary_dim` (#39584f) at a 135-degree angle to provide a "weighted" feel that flat color lacks.

---

## 3. Typography: The Editorial Engine
Typography is the primary vehicle for the brand identity. We pair the geometric authority of **Manrope** with the literary elegance of **Newsreader**.

- **Display & Headlines (Manrope):** These are the "Wayfinders." Use `display-lg` (3.5rem) for main page titles with tight letter-spacing (-0.02em) to create a bold, modern impact.
- **Body Text (Newsreader):** Use `body-lg` (1rem) for all long-form content. Newsreader’s serif structure is designed for high-density reading. Maintain a line-height of 1.6 to ensure the "Digital Garden" feel is airy and legible.
- **Labels (Inter):** For technical metadata (tags, file sizes, or dates), use `label-md` in all caps with +0.05em tracking to differentiate functional UI from narrative content.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are often too aggressive for a minimalist system. We prioritize **Tonal Layering**.

- **The Layering Principle:** To "lift" a card, place a `surface-container-lowest` (#ffffff) element onto a `surface-container` (#eceeee) background. This creates a soft, natural lift mimicking fine stationery.
- **Ambient Shadows:** If a floating element (like a dropdown) requires a shadow, use a large blur (20px-40px) at 4% opacity, using the `on-surface` color (#2d3434) to keep the shadow feeling "organic."
- **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline_variant` token at **20% opacity**. Never use a 100% opaque border.
- **Glassmorphism:** Use semi-transparent `surface_variant` for code block headers to allow the syntax highlighting to subtly bleed through, softening the technical edge of the code.

---

## 5. Components: Refined Utility

### Navigation Trees & Tables of Contents
- **Style:** Forbid the use of icons or bullet points for every line. Use `label-md` (Inter) for navigation.
- **State:** Active items are indicated by a `primary` color text shift and a subtle 2px vertical "pill" marker to the left, rather than a full background highlight.

### Buttons
- **Primary:** `primary` (#45655b) background, `on_primary` text. Use `rounded-md` (0.375rem).
- **Tertiary (Ghost):** No background or border. Use `primary` text. On hover, apply a `primary_container` (#c7eade) background at 40% opacity.

### Code Blocks
- **Background:** Use `inverse_surface` (#0d0f0f) to create a high-contrast "focal point" within the light mode.
- **Padding:** Use `spacing-5` (1.7rem) for internal padding to give code "room to breathe."

### Sidenotes (The Marginalia)
- **Placement:** Positioned in the right-hand margin, aligned with the relevant paragraph.
- **Typography:** Use `body-sm` (Newsreader).
- **Style:** No borders. Use `on_surface_variant` (#5a6060) to keep the sidenote visually subordinate to the main text.

### Input Fields & Search
- **Visuals:** Use the "Ghost Border" rule. A bottom-only border (2px) using `outline_variant` that transitions to `primary` on focus is preferred over a full box.

---

## 6. Do’s and Don’ts

### Do:
- **Embrace Asymmetry:** Offset the main content column to the left to leave room for scholarly marginalia.
- **Use Micro-Transitions:** All hover states should have a 300ms ease-out transition on background-color and opacity.
- **Respect the Grid:** While the layout is airy, align all elements to the `spacing-3` (1rem) baseline to maintain structural integrity.

### Don’t:
- **Don’t use Dividers:** Never use `<hr>` tags or 1px lines to separate list items. Use `spacing-4` or `spacing-6` to create separation.
- **Don’t Over-Saturate:** The `primary` green should be used sparingly (links, buttons, active states). If the page feels "green," you’ve over-designed.
- **Don’t Use Pure Black:** Always use `on_surface` (#2d3434) for text to maintain the "charcoal and paper" sophisticated contrast.