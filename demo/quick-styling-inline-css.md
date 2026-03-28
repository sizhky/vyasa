---
title: Quick Styling with Markdown + Inline CSS
---

<div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 10px; padding: 14px; color: #065f46;">

## Migration Status Snapshot

Deterministic capabilities implemented in the current codebase:

- Artifact discovery and classification for files.
- Process parsing for starter/activity metadata, transitions, subprocess calls, and control-flow hints.
- Mule scaffold generation with connector configs and dependency hints.
- Placeholder-driven config generation in `config.yaml` plus inferred defaults.
- Static validation and gap analysis with machine-readable reports.

</div>

<div style="margin-top: 1rem; padding: 12px; border-left: 4px solid #2563eb; background: #eff6ff;">

### Inline emphasis still works

Use <span style="color:#2563eb; font-weight:700;">inline HTML styling</span> together with regular **Markdown**, `code`, and [links](./demo.md).

</div>

<div style="margin-top: 1rem; padding: 12px; background: linear-gradient(135deg, #fef3c7, #fee2e2); border-radius: 10px;">

> Mixed markdown + inline CSS is useful for fast callouts, status boxes, and visual highlights.

</div>

### Accordions can also be styled with inline CSS for a more polished look:
<div style="margin-top: 1.25rem;">
<details name="migration-acc" style="border:1px solid #dbeafe; border-radius:12px; background:linear-gradient(135deg,#eff6ff,#eef2ff); padding:10px 12px; margin-bottom:10px;">
<summary style="cursor:pointer; font-weight:700; color:#1e3a8a;">Process Health Accordion</summary>

- ✅ Parsing and inventory completed for core artifacts
- 🧭 Flow hints inferred where transitions are partial
- 🔁 Subprocess relationships linked for call graph generation

</details>

<details name="migration-acc" style="border:1px solid #ccfbf1; border-radius:12px; background:linear-gradient(135deg,#ecfeff,#ecfdf5); padding:10px 12px; margin-bottom:10px;">
<summary style="cursor:pointer; font-weight:700; color:#065f46;">Mapping Confidence Accordion</summary>

- High confidence mappings are emitted directly
- Medium confidence mappings include rationale text
- Low confidence mappings produce explicit `TODO` fallbacks

</details>

<details name="migration-acc" style="border:1px solid #fde68a; border-radius:12px; background:linear-gradient(135deg,#fffbeb,#fff7ed); padding:10px 12px;">
<summary style="cursor:pointer; font-weight:700; color:#92400e;">Validation Checks Accordion</summary>

- XML well-formedness
- Placeholder coverage audit
- Packaging checks for generated Mule project

</details>
</div>

<img id="page-stamp-demo" src="./yeshwanth-stamp.png" alt="Stamped seal overlay" style="position:absolute; width:132px; height:auto; pointer-events:none; opacity:.82; filter:drop-shadow(0 10px 20px rgba(127,29,29,.22)); transform-origin:center; z-index:4440;">

<script>
const placeFooterStamp = () => {
  const stamp = document.getElementById('page-stamp-demo');
  if (!stamp) return;
  const footer = document.querySelector('#site-footer .vyasa-footer-card');
  if (!footer) return;
  footer.style.position = 'relative';
  footer.appendChild(stamp);
  const left = 16 + Math.random() * 68;
  const top = 20 + Math.random() * 56;
  const angle = -22 + Math.random() * 44;
  const scale = 0.9 + Math.random() * 0.24;
  stamp.style.left = `${left}%`;
  stamp.style.top = `${top}%`;
  stamp.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(${scale})`;
};
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', placeFooterStamp, { once: true });
} else {
  placeFooterStamp();
}
</script>
