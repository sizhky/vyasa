const cfg = window.__vyasaSlidesConfig || {};
const body = document.body;
const deck = document.querySelector(".vyasa-deck");
const track = document.querySelector(".vyasa-deck-track");
const slides = [...document.querySelectorAll(".vyasa-slide")];
const progress = document.querySelector(".vyasa-progress");
const progressBar = document.querySelector(".vyasa-progress__bar");
const counter = document.querySelector(".vyasa-slide__count");
let currentIndex = 0;
let wheelLock = false;
let touchStart = null;

const hashIndex = (hash) => {
  const id = (hash || location.hash || "").replace(/^#/, "");
  if (!id) return 0;
  const idx = slides.findIndex((slide) => slide.dataset.slideId === id || slide.id === id);
  return idx >= 0 ? idx : 0;
};
const clamp = (n) => Math.max(0, Math.min(slides.length - 1, n));
const activeSlide = () => slides[currentIndex] || null;
const activeFrame = () => activeSlide()?.querySelector(".vyasa-slide-frame") || null;

function updateOverflow(slide) {
  if (!slide) return;
  const viewport = slide.querySelector(".vyasa-slide-viewport");
  const frame = slide.querySelector(".vyasa-slide-frame");
  if (!viewport || !frame) return;
  const allow = cfg.allowOverflow || "auto";
  const scrollable = allow === "always" || (allow !== "never" && frame.scrollHeight > viewport.clientHeight + 8);
  slide.classList.toggle("is-scrollable", scrollable);
  slide.classList.toggle("is-scrolled-top", frame.scrollTop <= 1);
  slide.classList.toggle("is-scrolled-bottom", frame.scrollTop >= frame.scrollHeight - frame.clientHeight - 1);
  if (!scrollable) frame.scrollTop = 0;
}
function updateHud() {
  if (counter) counter.textContent = `${currentIndex + 1} / ${slides.length}`;
  if (progress) progress.hidden = cfg.progress === false;
  if (progressBar) progressBar.style.transform = `scaleX(${slides.length ? (currentIndex + 1) / slides.length : 0})`;
  if (counter) counter.hidden = cfg.numbers === false;
}
function runMathPass(node) {
  if (typeof renderMathInElement !== "function") return;
  renderMathInElement(node || document.body, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }, { left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }], throwOnError: false });
}
function syncActive() {
  slides.forEach((slide, index) => {
    const active = index === currentIndex;
    slide.classList.toggle("is-active", active);
    slide.setAttribute("aria-hidden", active ? "false" : "true");
  });
  if (!body.classList.contains("is-overview")) track.style.transform = `translate3d(${-currentIndex * 100}vw,0,0)`;
  requestAnimationFrame(() => { updateOverflow(activeSlide()); updateHud(); runMathPass(activeFrame() || document.body); window.dispatchEvent(new Event("resize")); });
}
function setHash(replace = false) {
  const id = activeSlide()?.dataset.slideId;
  if (!id) return;
  if (replace) history.replaceState(null, "", `#${id}`); else history.pushState(null, "", `#${id}`);
}
function activate(index, { replace = false } = {}) { currentIndex = clamp(index); syncActive(); setHash(replace); }
function step(direction) { activate(currentIndex + direction); }
function scrollWithin(direction) {
  const slide = activeSlide();
  const frame = activeFrame();
  if (!slide || !frame || !slide.classList.contains("is-scrollable")) return false;
  const max = frame.scrollHeight - frame.clientHeight;
  const delta = Math.max(frame.clientHeight * 0.82, 120) * direction;
  if (direction > 0 && frame.scrollTop < max - 1) { frame.scrollBy({ top: delta, behavior: "smooth" }); setTimeout(() => updateOverflow(slide), 180); return true; }
  if (direction < 0 && frame.scrollTop > 1) { frame.scrollBy({ top: delta, behavior: "smooth" }); setTimeout(() => updateOverflow(slide), 180); return true; }
  return false;
}
function toggleOverview(force) {
  const next = typeof force === "boolean" ? force : !body.classList.contains("is-overview");
  body.classList.toggle("is-overview", next);
  if (!next) syncActive();
}

document.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-action]");
  if (btn) {
    const action = btn.dataset.action;
    if (action === "next") step(1);
    if (action === "prev") step(-1);
    if (action === "overview" && cfg.overview !== false) toggleOverview();
    if (action === "fullscreen") { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }
    return;
  }
  if (body.classList.contains("is-overview")) {
    const slide = event.target.closest(".vyasa-slide");
    if (slide) { toggleOverview(false); activate(Number(slide.dataset.slideIndex) - 1, { replace: true }); }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented) return;
  const key = event.key;
  if ((key === "o" || key === "O") && cfg.overview !== false) { event.preventDefault(); toggleOverview(); return; }
  if (key === "f" || key === "F") { event.preventDefault(); if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); return; }
  if (body.classList.contains("is-overview")) { if (key === "Escape") { event.preventDefault(); toggleOverview(false); } return; }
  if (key === "ArrowRight") { event.preventDefault(); step(1); return; }
  if (key === "ArrowLeft") { event.preventDefault(); step(-1); return; }
  if (key === "Home") { event.preventDefault(); activate(0); return; }
  if (key === "End") { event.preventDefault(); activate(slides.length - 1); return; }
  if (["ArrowDown", "PageDown", " "].includes(key)) { event.preventDefault(); if (!scrollWithin(1)) step(1); return; }
  if (["ArrowUp", "PageUp"].includes(key)) { event.preventDefault(); if (!scrollWithin(-1)) step(-1); }
});

deck?.addEventListener("wheel", (event) => {
  if (body.classList.contains("is-overview") || Math.abs(event.deltaY) < 18 || wheelLock) return;
  event.preventDefault();
  wheelLock = true;
  if (!scrollWithin(event.deltaY > 0 ? 1 : -1)) step(event.deltaY > 0 ? 1 : -1);
  setTimeout(() => { wheelLock = false; }, 280);
}, { passive: false });

deck?.addEventListener("touchstart", (event) => {
  const touch = event.touches && event.touches[0];
  if (touch) touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });
deck?.addEventListener("touchend", (event) => {
  if (!touchStart || body.classList.contains("is-overview")) { touchStart = null; return; }
  const touch = event.changedTouches && event.changedTouches[0];
  if (!touch) { touchStart = null; return; }
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 48) { step(dx < 0 ? 1 : -1); return; }
  if (Math.abs(dy) > 56 && !scrollWithin(dy < 0 ? 1 : -1)) step(dy < 0 ? 1 : -1);
}, { passive: true });

window.addEventListener("hashchange", () => activate(hashIndex(location.hash), { replace: true }));
window.addEventListener("resize", () => syncActive());
document.fonts?.ready?.then(() => syncActive());
slides.forEach((slide) => slide.querySelector(".vyasa-slide-frame")?.addEventListener("scroll", () => updateOverflow(slide), { passive: true }));
currentIndex = hashIndex(location.hash);
syncActive();
setHash(true);
