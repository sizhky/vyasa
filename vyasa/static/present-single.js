const body = document.body;
const shell = document.querySelector(".vyasa-present-shell");
const prev = document.querySelector('a[data-nav="prev"]');
const next = document.querySelector('a[data-nav="next"]');
const overviewToggle = document.querySelector('[data-action="overview-toggle"]');
const overview = document.querySelector(".vyasa-overview");
const overviewCards = [...document.querySelectorAll(".vyasa-overview-card")];
let navigating = false;
const bootAt = Date.now();
const lastNavAt = Number(sessionStorage.getItem("vyasa-slide-last-nav-at") || "0");
let overviewIndex = Math.max(0, overviewCards.findIndex((card) => card.classList.contains("is-active")));

const enter = sessionStorage.getItem("vyasa-slide-enter");
body.style.setProperty("--vyasa-enter-offset", enter === "forward" ? "40px" : enter === "back" ? "-40px" : "0");
void shell?.offsetWidth;
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    sessionStorage.removeItem("vyasa-slide-enter");
    body.classList.add("is-ready");
  });
});

function go(link, direction) {
  if (!link || navigating) return;
  navigating = true;
  if (!shell) { window.location.href = link.href; return; }
  sessionStorage.setItem("vyasa-slide-enter", direction);
  sessionStorage.setItem("vyasa-slide-last-nav-at", String(Date.now()));
  body.style.setProperty("--vyasa-exit-offset", direction === "forward" ? "-40px" : "40px");
  body.classList.remove("is-ready");
  body.classList.add("is-exiting");
  window.setTimeout(() => { window.location.href = link.href; }, 190);
}

function setOverviewOpen(open) {
  if (!overview) return;
  overview.hidden = !open;
  body.classList.toggle("is-overview-open", open);
  if (open) {
    const target = overviewCards[overviewIndex] || overviewCards[0];
    target?.focus();
  } else {
    overviewToggle?.focus();
  }
}

function moveOverview(delta) {
  if (!overviewCards.length) return;
  overviewIndex = Math.max(0, Math.min(overviewCards.length - 1, overviewIndex + delta));
  overviewCards[overviewIndex]?.focus();
  overviewCards[overviewIndex]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const link = event.target.closest('a[data-nav="prev"], a[data-nav="next"]');
  if (!link) return;
  event.preventDefault();
  go(link, link.dataset.nav === "next" ? "forward" : "back");
});

overviewToggle?.addEventListener("click", () => setOverviewOpen(overview?.hidden));
overview?.addEventListener("click", (event) => {
  if (event.target === overview) setOverviewOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented) return;
  if (!overview?.hidden) {
    if (event.key === "Escape") { event.preventDefault(); setOverviewOpen(false); return; }
    if (event.key === "ArrowRight") { event.preventDefault(); moveOverview(1); return; }
    if (event.key === "ArrowLeft") { event.preventDefault(); moveOverview(-1); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); moveOverview(1); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); moveOverview(-1); return; }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); overviewCards[overviewIndex]?.click(); return; }
    return;
  }
  if (Date.now() - Math.max(bootAt, lastNavAt) < 260) return;
  if (event.key === "o" || event.key === "O") { event.preventDefault(); setOverviewOpen(true); return; }
  if (event.key === "ArrowRight" && next) { event.preventDefault(); go(next, "forward"); }
  if (event.key === "ArrowLeft" && prev) { event.preventDefault(); go(prev, "back"); }
});
