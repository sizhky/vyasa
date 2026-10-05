import { ensureShortcutHelp } from '/static/page_shell.js';

window.__vyasaSlideDebug = window.__vyasaSlideDebug || ((label, payload = {}) => {
  window.__vyasaTasksPhaseLog?.(`slides:${label}`, payload);
});
window.__vyasaSlideDebug('asset-eval', { bound: Boolean(window.__vyasaZenBound), url: location.href });
if (!window.__vyasaSlideCaptureLogBound) {
  window.__vyasaSlideCaptureLogBound = true;
  window.addEventListener('keydown', (event) => window.__vyasaSlideDebug('keydown-capture', {
    key: event.key, code: event.code, defaultPrevented: event.defaultPrevented,
    target: event.target?.tagName || '', active: document.activeElement?.tagName || '',
  }), true);
}
if (!window.__vyasaZenBound) {
  window.__vyasaZenBound = true;
  const slideShortcutHelp = ensureShortcutHelp({
    title: 'Slide shortcuts',
    groups: [
      ['Exit', [['Shift+Esc', 'Document']]],
      ['Slides', [['M / Esc', 'Overview'], ['?', 'Shortcuts'], ['J / K', 'Scroll / Reveal / Rewind'], ['H / L', 'Previous / Next']]],
      ['Overview', [['J / K', 'Move Selection'], ['H / L', 'Collapse / Expand'], ['Enter', 'Open Slide'], ['Esc', 'Close']]],
    ],
  });
  let revealTimers = [];
  // Step mode: a reveal waiting for its sideways glide to finish (glideSidewaysThen).
  let pendingStep = null;
  const slideDebug = window.__vyasaSlideDebug;
  const revealLog = (label, payload = {}) => {
    console.info('[vyasa:reveal]', label, payload);
    slideDebug(label, payload);
  };
  let pendingRevealDirection = null;
  let pendingSlideBottomScroll = false;
  const slidePageCache = new Map();

  const cacheCurrentSlide = () => {
    const main = document.getElementById('main-content');
    if (main && location.pathname.startsWith('/slides/')) {
      slidePageCache.set(`${location.pathname}${location.search}`, main.outerHTML);
    }
  };

  const restoreCachedSlide = (href) => {
    const cached = slidePageCache.get(new URL(href, location.href).pathname + new URL(href, location.href).search);
    const main = document.getElementById('main-content');
    if (!cached || !main) return false;
    main.outerHTML = cached;
    window.history.pushState(null, '', href);
    disableNavbarBoost();
    clearRevealTimers();
    pendingRevealDirection = null;
    pendingSlideBottomScroll = false;
    return true;
  };

  const getRevealBody = (root = document) =>
    root.querySelector('.vyasa-zen-slide-body[data-reveal-mode="stagger"]');

  const getStepUnits = (root = document) => {
    const body = getRevealBody(root);
    if (!body) return [];
    return Array.from(body.querySelectorAll('.vyasa-reveal-unit')).filter((unit) => {
      const style = unit.dataset.revealStyle || body.dataset.revealStyle || 'slide-right';
      return style !== 'none' && style !== 'instant';
    });
  };

  const isHeadingUnit = (unit) => unit?.dataset.revealKind === 'heading';

  // Baseline: the leading headings, or the first unit when a slide has no heading.
  const baselineCount = (units) => {
    const headingCount = leadingHeadingCount(units);
    return headingCount > 0 ? headingCount : Math.min(1, units.length);
  };
  const getBaselineVisibleCount = (root = document) => baselineCount(getStepUnits(root));

  // Load reveal. Off: the old branch also auto-reveals the first section after the title.
  const AUTO_REVEAL_FIRST_SECTION = false;
  const initialRevealUnits = (units) => (AUTO_REVEAL_FIRST_SECTION
    ? units.slice(0, Math.min(units.length, leadingHeadingCount(units) + 1))
    : units.slice(0, baselineCount(units)));
  const showInitialUnit = (body, unit) => {
    // The old branch's first section follows the same L as a stepped reveal.
    if (AUTO_REVEAL_FIRST_SECTION && !isHeadingUnit(unit)) glideSidewaysThen(body, [unit], () => showUnit(unit));
    else showUnit(unit);
  };

  const leadingHeadingCount = (units) => {
    const firstContent = units.findIndex((unit) => unit.dataset.revealKind !== 'heading');
    return firstContent < 0 ? units.length : firstContent;
  };

  // Focus: the last revealed unit, with the headings revealed alongside it, is current;
  // earlier units are past and dim. The slide's leading headings never dim.
  const markRevealFocus = (units) => {
    const shown = units.filter((unit) => unit.dataset.revealState === 'entering' || unit.dataset.revealState === 'visible');
    const leading = leadingHeadingCount(units);
    let firstCurrent = shown.length - 1;
    while (firstCurrent > 0 && isHeadingUnit(shown[firstCurrent - 1])) firstCurrent -= 1;
    units.forEach((unit) => { delete unit.dataset.revealFocus; });
    shown.forEach((unit, index) => {
      if (units.indexOf(unit) < leading) return;
      unit.dataset.revealFocus = index >= firstCurrent ? 'current' : 'past';
    });
  };

  const syncSlideProgressBar = (root = document) => {
    const body = getRevealBody(root);
    const bar = body?.querySelector('.vyasa-zen-slide-progress');
    if (!bar) return;
    const units = getStepUnits(root);
    markRevealFocus(units);
    const progressUnits = units.slice(leadingHeadingCount(units)).filter((unit) => !isHeadingUnit(unit));
    const visible = progressUnits.filter((unit) => unit.dataset.revealState === 'visible').length;
    bar.style.setProperty('--vyasa-slide-progress', `${progressUnits.length ? visible / progressUnits.length * 100 : 100}%`);
    bar.setAttribute('aria-valuemax', String(progressUnits.length));
    bar.setAttribute('aria-valuenow', String(visible));
    const deckBar = body.querySelector('.vyasa-zen-deck-progress');
    const offset = Number(deckBar?.dataset.segmentOffset || 0);
    const total = Number(deckBar?.dataset.segmentTotal || 0);
    const deckVisible = Math.min(total, offset + visible);
    deckBar?.style.setProperty('--vyasa-deck-progress', `${total ? deckVisible / total * 100 : 100}%`);
    deckBar?.setAttribute('aria-valuemax', String(total));
    deckBar?.setAttribute('aria-valuenow', String(deckVisible));
    const endRule = body.querySelector('.vyasa-zen-slide-end-rule');
    if (endRule) endRule.dataset.revealState = visible === progressUnits.length ? 'visible' : 'hidden';
  };

  const revealNextUnit = (root = document) => {
    const body = getRevealBody(root);
    if (!body || (body.dataset.revealPolicy || 'step') !== 'step') return false;
    if (flushPendingStep()) return true;
    const units = getStepUnits(root);
    const nextIndex = units.findIndex((unit) => unit.dataset.revealState !== 'visible');
    if (nextIndex < 0) {
      revealLog('revealNextUnit: no hidden units remain');
      return false;
    }
    // Headings reveal together with the block that follows them.
    let lastIndex = nextIndex;
    while (isHeadingUnit(units[lastIndex]) && lastIndex + 1 < units.length) lastIndex += 1;
    const group = units.slice(nextIndex, lastIndex + 1);
    glideSidewaysThen(body, group, () => group.forEach((unit) => showUnit(unit)));
    const next = units[lastIndex];
    revealLog('revealNextUnit: revealed unit', {
      index: next.dataset.revealIndex,
      text: (next.textContent || '').trim().slice(0, 140),
    });
    return true;
  };

  const hidePreviousUnit = (root = document) => {
    const body = getRevealBody(root);
    if (!body || (body.dataset.revealPolicy || 'step') !== 'step') return false;
    const units = getStepUnits(root);
    const baseline = getBaselineVisibleCount(root);
    const visible = units.filter((unit) => unit.dataset.revealState === 'visible');
    if (visible.length <= baseline) {
      revealLog('hidePreviousUnit: at baseline, cannot hide more', { baseline });
      return false;
    }
    const target = visible.at(-1);
    hideUnit(target);
    let remaining = visible.slice(0, -1);
    while (remaining.length > baseline && isHeadingUnit(remaining.at(-1))) {
      hideUnit(remaining.at(-1));
      remaining = remaining.slice(0, -1);
    }
    revealLog('hidePreviousUnit: hid unit', {
      index: target.dataset.revealIndex,
      text: (target.textContent || '').trim().slice(0, 140),
    });
    return true;
  };

  const clearRevealTimers = () => {
    revealTimers.forEach((timer) => window.clearTimeout(timer));
    revealTimers = [];
    pendingStep = null;
  };

  // Slide area: the window below the navbar minus equal reserves at top and bottom.
  // The top reserve holds the nav chrome (its natural height above the slide body);
  // the bottom reserve mirrors it and holds the two progress bars.
  const REVEAL_MIN_RESERVE = 48;
  // The reserve of the band the current slide is centred in (recenterRevealedUnits).
  let activeReserve = REVEAL_MIN_RESERVE;
  const navbarBottomInDocument = () => {
    const navbar = document.getElementById('site-navbar');
    return navbar ? navbar.offsetTop + navbar.offsetHeight : 0;
  };
  const naturalBodyTop = (body) =>
    body.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(body).marginTop) || 0);
  const slideReserve = () => {
    const body = getRevealBody(document);
    if (!body) return REVEAL_MIN_RESERVE;
    return Math.max(REVEAL_MIN_RESERVE, Math.round(naturalBodyTop(body) - navbarBottomInDocument()));
  };

  // Reveal shifts (scroll and recentre) take the section reveal duration, so content
  // moves at the same speed a new section fades in.
  const revealShiftMs = () => {
    const body = getRevealBody(document);
    const value = body && (body.style.getPropertyValue('--vyasa-reveal-duration') || getComputedStyle(body).getPropertyValue('--vyasa-reveal-duration'));
    const parsed = parseInt(String(value || '').replace(/ms$/, ''), 10);
    return Number.isFinite(parsed) ? parsed : 420;
  };
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
  let glideFrame = 0;
  let glideTarget = null;
  const glideScrollTo = (top) => {
    const to = Math.max(0, Math.round(top));
    if (glideTarget !== null && Math.abs(to - glideTarget) < 2) return;
    window.cancelAnimationFrame(glideFrame);
    glideTarget = null;
    const from = window.scrollY;
    if (Math.abs(to - from) < 1) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo(0, to);
      return;
    }
    const start = performance.now();
    const duration = Math.max(1, revealShiftMs());
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      window.scrollTo(0, from + (to - from) * easeInOutCubic(t));
      if (t < 1) glideFrame = window.requestAnimationFrame(step);
      else glideTarget = null;
    };
    glideTarget = to;
    glideFrame = window.requestAnimationFrame(step);
  };
  ['wheel', 'touchstart'].forEach((type) =>
    window.addEventListener(type, () => { window.cancelAnimationFrame(glideFrame); glideTarget = null; }, { passive: true }));

  const getRevealViewportInsets = () => {
    const navbarBottom = document.getElementById('site-navbar')?.getBoundingClientRect().bottom || 0;
    return {
      top: Math.max(24, Math.ceil(navbarBottom + 16)),
      bottom: activeReserve,
    };
  };

  const keepUnitInView = (unit) => {
    if (!unit?.isConnected) return;
    const rect = unit.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!viewportHeight) return;
    const inset = getRevealViewportInsets();
    const visibleTop = inset.top;
    const visibleBottom = viewportHeight - inset.bottom;
    const availableHeight = Math.max(1, visibleBottom - visibleTop);
    let targetTop = null;
    if (rect.top < visibleTop) {
      targetTop = window.scrollY + rect.top - visibleTop;
    } else if (rect.bottom > visibleBottom) {
      if (rect.height >= availableHeight) {
        targetTop = window.scrollY + rect.top - visibleTop;
      } else {
        targetTop = window.scrollY + rect.bottom - visibleBottom;
      }
    }
    if (targetTop == null) return;
    glideScrollTo(targetTop);
  };

  const scrollLastVisibleUnit = (direction, root = document) => {
    const unit = getStepUnits(root).filter(
      (candidate) => candidate.dataset.revealState === 'visible',
    ).at(-1);
    if (!unit) return false;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!viewportHeight) return false;
    const inset = getRevealViewportInsets();
    const visibleTop = inset.top;
    const visibleBottom = viewportHeight - inset.bottom;
    const rect = unit.getBoundingClientRect();
    const page = Math.max(1, Math.round((visibleBottom - visibleTop) * 0.82));
    const delta = direction === 'down'
      ? Math.min(page, rect.bottom - visibleBottom)
      : Math.max(-page, rect.top - visibleTop);
    if ((direction === 'down' && delta <= 2) || (direction === 'up' && delta >= -2)) return false;
    glideScrollTo(window.scrollY + delta);
    slideDebug('reveal-scroll', {
      direction,
      delta: Math.round(delta),
      index: unit.dataset.revealIndex,
    });
    return true;
  };

  const scrollToSlideBottom = () => {
    [0, 80, 220].forEach((delay) => {
      window.setTimeout(() => {
        window.scrollTo({
          top: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
          behavior: 'auto',
        });
      }, delay);
    });
  };

  const refreshRevealedTables = (unit) => {
    if (!unit?.querySelector('.vyasa-table-scroll')) return;
    [0, 80, 220].forEach((delay) => {
      window.setTimeout(() => {
        unit.querySelectorAll('.vyasa-table-scroll').forEach((table) => {
          table.scrollLeft = table.scrollLeft;
        });
        if (typeof window.refreshVyasaTableScrollShadows === 'function') {
          window.refreshVyasaTableScrollShadows(unit);
        }
        if (delay === 220) slideDebug('table-snapshot', { reason: 'revealed', tables: tableSnapshot(unit) });
      }, delay);
    });
  };

  const tableSnapshot = (root = document) => Array.from(root.querySelectorAll('.vyasa-table-scroll')).map((wrap) => {
    const table = wrap.querySelector('table');
    const th = table?.querySelector('th');
    const td = table?.querySelector('td');
    const rect = wrap.getBoundingClientRect();
    return {
      wrap: { width: Math.round(rect.width), scrollWidth: wrap.scrollWidth, cls: wrap.className },
      table: { width: table?.scrollWidth || 0, fontSize: table ? getComputedStyle(table).fontSize : '' },
      th: th ? { fontSize: getComputedStyle(th).fontSize, padding: getComputedStyle(th).padding } : null,
      td: td ? { fontSize: getComputedStyle(td).fontSize, padding: getComputedStyle(td).padding } : null,
    };
  });

  // Ink: the visible text line boxes and replaced elements of a unit, clipped to any
  // scroll box. Centring uses ink, not unit boxes, so line-height and empty block
  // space cannot make one margin larger than its opposite.
  const unionRect = (rects) => rects.reduce((box, r) => ({
    top: Math.min(box.top, r.top), left: Math.min(box.left, r.left),
    bottom: Math.max(box.bottom, r.bottom), right: Math.max(box.right, r.right),
  }), { top: Infinity, left: Infinity, bottom: -Infinity, right: -Infinity });
  const intersectRect = (a, b) => ({
    top: Math.max(a.top, b.top), left: Math.max(a.left, b.left),
    bottom: Math.min(a.bottom, b.bottom), right: Math.min(a.right, b.right),
  });
  const inkItems = (unit) => {
    const hidden = new Map();
    const clips = new Map();
    // The unit's own opacity is excluded: an entering unit is still transparent.
    const isHidden = (el) => {
      if (!el || el === unit) return false;
      if (!hidden.has(el)) {
        const cs = getComputedStyle(el);
        hidden.set(el, cs.visibility === 'hidden' || cs.opacity === '0' || isHidden(el.parentElement));
      }
      return hidden.get(el);
    };
    const clipOf = (el) => {
      if (!el || el === unit) return null;
      if (!clips.has(el)) {
        const cs = getComputedStyle(el);
        const own = cs.overflowX !== 'visible' || cs.overflowY !== 'visible' ? el.getBoundingClientRect() : null;
        const up = clipOf(el.parentElement);
        clips.set(el, own && up ? intersectRect(own, up) : own || up);
      }
      return clips.get(el);
    };
    const items = [];
    const add = (r, el) => {
      const clip = clipOf(el.parentElement === unit ? null : el.parentElement);
      const box = clip ? intersectRect(r, clip) : r;
      if (box.right - box.left > 0 && box.bottom - box.top > 0) items.push({ r: box, el });
    };
    // Painted boxes (a callout or code background, a diagram frame) are ink as a whole.
    const painted = (cs) => !/^(transparent|rgba\(.*,\s*0\))$/.test(cs.backgroundColor) || cs.backgroundImage !== 'none'
      || ['Top', 'Right', 'Bottom', 'Left'].some((side) => parseFloat(cs[`border${side}Width`]) > 0
        && cs[`border${side}Style`] !== 'none' && !/^(transparent|rgba\(.*,\s*0\))$/.test(cs[`border${side}Color`]));
    unit.querySelectorAll('*').forEach((el) => {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
      if (isHidden(el)) return;
      if (/^(img|svg|canvas|video|iframe)$/i.test(el.tagName) || painted(getComputedStyle(el))) add(el.getBoundingClientRect(), el);
    });
    const walker = document.createTreeWalker(unit, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!node.data.trim() || el.closest('svg') || isHidden(el)) continue;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) add(r, el);
    }
    return items;
  };
  const shownUnits = (body) => Array.from(body.querySelectorAll('.vyasa-reveal-unit'))
    .filter((unit) => unit.dataset.revealState === 'entering' || unit.dataset.revealState === 'visible');
  // The end rule closes the slide, so once it shows it belongs to the centred group.
  const shownInk = (body) => {
    const items = shownUnits(body).flatMap(inkItems);
    const rule = body.querySelector('.vyasa-zen-slide-end-rule[data-reveal-state="visible"]');
    if (rule) items.push({ r: rule.getBoundingClientRect(), el: rule });
    return items;
  };

  // Horizontal centre: one offset per slide, from the ink of every unit including the
  // ones not yet revealed, so reveals never move content sideways.
  const MEASURING = 'vyasa-zen-measuring';
  const setVar = (el, name, value) => {
    if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
  };
  // Prototype (?slides_center=step): centre on the units shown so far, gliding at each reveal.
  const centerPerStep = new URLSearchParams(location.search).get('slides_center') === 'step';
  // Step mode moves in an L. Forward: glide sideways for the incoming units, then reveal
  // them and recentre vertically. Backward: hide and recentre vertically, then glide back.
  let incomingUnits = [];
  let holdXUntil = 0;
  const recenterSlideX = (body, { force = false } = {}) => {
    if (centerPerStep && !force && performance.now() < holdXUntil) return;
    if (centerPerStep) body.dataset.centerX = 'step';
    else body.classList.add(MEASURING);
    const incoming = centerPerStep ? incomingUnits.filter((unit) => unit.isConnected && unit.dataset.revealState === 'hidden') : [];
    incoming.forEach((unit) => { unit.dataset.measuring = ''; });
    const units = centerPerStep ? [...shownUnits(body), ...incoming] : Array.from(body.querySelectorAll('.vyasa-reveal-unit'));
    const width = document.documentElement.clientWidth;
    const viewport = { top: -Infinity, bottom: Infinity, left: 0, right: width };
    // Remove each unit's current offset (an entering unit's translateX, a gliding left) from its ink.
    const rects = units.flatMap((unit) => {
      const cs = getComputedStyle(unit);
      const dx = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform).m41 + (parseFloat(cs.left) || 0);
      return inkItems(unit).map(({ r }) => intersectRect({ ...r, left: r.left - dx, right: r.right - dx, top: r.top, bottom: r.bottom }, viewport));
    });
    const ink = unionRect(rects);
    const rule = body.querySelector('.vyasa-zen-slide-end-rule')?.getBoundingClientRect();
    body.classList.remove(MEASURING);
    incoming.forEach((unit) => { delete unit.dataset.measuring; });
    if (!Number.isFinite(ink.left)) return;
    const shift = ((width - ink.right) - ink.left) / 2;
    setVar(body, '--vyasa-zen-center-x', `${shift.toFixed(2)}px`);
    // The first placement jumps; only later changes glide (CSS keys on data-x-placed).
    if (centerPerStep && body.dataset.xPlaced !== '1') {
      void body.offsetHeight;
      body.dataset.xPlaced = '1';
    }
    if (rule) setVar(body, '--vyasa-zen-rule-x', `${(width / 2 - (rule.left + rule.right) / 2).toFixed(2)}px`);
  };

  const flushPendingStep = () => {
    if (!pendingStep) return false;
    const { timer, run } = pendingStep;
    pendingStep = null;
    window.clearTimeout(timer);
    run();
    return true;
  };
  const glideSidewaysThen = (body, group, reveal) => {
    if (!centerPerStep) return reveal();
    const before = parseFloat(body.style.getPropertyValue('--vyasa-zen-center-x')) || 0;
    incomingUnits = group;
    recenterSlideX(body, { force: true });
    const after = parseFloat(body.style.getPropertyValue('--vyasa-zen-center-x')) || 0;
    const run = () => { incomingUnits = []; reveal(); };
    if (Math.abs(after - before) < 0.5) return run();
    const timer = window.setTimeout(() => { pendingStep = null; run(); }, revealShiftMs());
    revealTimers.push(timer);
    pendingStep = { timer, run };
  };

  // Cover and closing cards have no reveal units; their ink centres in the chrome band.
  const recenterCover = () => {
    const card = document.querySelector('.vyasa-zen-cover');
    if (!card) return;
    const ink = unionRect(inkItems(card).map(({ r }) => r));
    if (!Number.isFinite(ink.top)) return;
    const [dx0, dy0] = ['--vyasa-zen-cover-x', '--vyasa-zen-cover-y'].map((name) => parseFloat(card.style.getPropertyValue(name)) || 0);
    const navBottom = document.getElementById('site-navbar')?.getBoundingClientRect().bottom || 0;
    const reserve = Math.max(REVEAL_MIN_RESERVE, card.getBoundingClientRect().top - dy0 + window.scrollY - navbarBottomInDocument());
    const bandHeight = window.innerHeight - 2 * reserve - navBottom;
    const width = document.documentElement.clientWidth;
    const dx = dx0 + ((width - ink.right) - ink.left) / 2;
    const dy = dy0 + navBottom + reserve + (bandHeight - (ink.bottom - ink.top)) / 2 - ink.top;
    setVar(card, '--vyasa-zen-cover-x', `${dx.toFixed(2)}px`);
    setVar(card, '--vyasa-zen-cover-y', `${dy.toFixed(2)}px`);
  };

  // Revealed units sit at the vertical centre of the slide area; once they outgrow it
  // the offset is 0 and keepUnitInView scrolls instead.
  const recenterRevealedUnits = (root = document) => {
    const body = getRevealBody(root);
    if (!body) return false;
    if (centerPerStep) recenterSlideX(body);
    const ink = unionRect(shownInk(body).map(({ r }) => r));
    const hasInk = Number.isFinite(ink.top);
    const contentHeight = hasInk ? ink.bottom - ink.top : 0;
    const marginTop = parseFloat(getComputedStyle(body).marginTop) || 0;
    const naturalTop = hasInk ? ink.top + window.scrollY - marginTop : naturalBodyTop(body);
    // Reserves, widest first: the nav chrome height, then the progress-bar minimum.
    // Content too tall for the chrome band still centres in the minimum band.
    const navBottom = document.getElementById('site-navbar')?.getBoundingClientRect().bottom || 0;
    const bandFor = (reserve) => ({ reserve, top: navBottom + reserve, height: window.innerHeight - 2 * reserve - navBottom });
    const chromeBand = bandFor(slideReserve());
    const band = contentHeight <= chromeBand.height ? chromeBand : bandFor(REVEAL_MIN_RESERVE);
    setVar(body, '--vyasa-zen-band-h', `${Math.round(chromeBand.height)}px`);
    const { reserve, top: bandTop, height: bandHeight } = band;
    activeReserve = reserve;
    const desiredTop = bandTop + (bandHeight - contentHeight) / 2;
    const fits = contentHeight <= bandHeight;
    // Content below its centre gets a top margin; content that would need to rise
    // above the nav chrome scrolls instead, with enough room below to allow it.
    const shift = desiredTop - naturalTop;
    const offset = fits ? Math.max(0, shift) : 0;
    const scrollTarget = fits ? Math.max(0, -shift) : null;
    const firstPlacement = body.dataset.centerPlaced !== '1';
    if (firstPlacement) body.style.transition = 'none';
    body.style.setProperty('--vyasa-zen-center-offset', `${offset}px`);
    if (fits) {
      const room = shift >= 0 ? 0 : Math.max(0, Math.round(window.innerHeight - desiredTop - contentHeight));
      body.style.setProperty('--vyasa-zen-scroll-room', `${room}px`);
    } else {
      body.style.setProperty('--vyasa-zen-scroll-room', `${reserve}px`);
    }
    if (firstPlacement) {
      void body.offsetHeight;
      body.style.transition = '';
      body.dataset.centerPlaced = '1';
    }
    if (scrollTarget !== null) {
      if (firstPlacement) window.scrollTo(0, scrollTarget);
      else glideScrollTo(scrollTarget);
    }
    return fits;
  };

  const showUnit = (unit, { keepVisible: keepVisibleRequested = true } = {}) => {
    unit.dataset.revealState = 'entering';
    const keepVisible = keepVisibleRequested && !recenterRevealedUnits();
    if (keepVisible) {
      window.requestAnimationFrame(() => keepUnitInView(unit));
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        unit.dataset.revealState = 'visible';
        syncSlideProgressBar();
        if (keepVisible) {
          window.requestAnimationFrame(() => keepUnitInView(unit));
        }
        window.setTimeout(() => {
          if (
            unit.querySelector('.mermaid-wrapper, .d2-wrapper')
            && typeof window.vyasaRefreshDiagramInteractions === 'function'
          ) {
            window.vyasaRefreshDiagramInteractions(unit);
          }
          refreshRevealedTables(unit);
          if (typeof window.__vyasaRenderTasksGraphs === 'function') {
            window.__vyasaRenderTasksGraphs(unit);
          }
          recenterRevealedUnits();
          if (keepVisible) {
            keepUnitInView(unit);
          }
        }, 40);
      });
    });
  };

  const hideUnit = (unit) => {
    const duration = parseInt(
      String(
        unit.style.getPropertyValue('--vyasa-reveal-duration')
        || getComputedStyle(unit).getPropertyValue('--vyasa-reveal-duration')
        || '420ms'
      ).replace(/ms$/, ''),
      10,
    );
    unit.dataset.revealState = 'leaving';
    syncSlideProgressBar();
    if (centerPerStep) holdXUntil = performance.now() + (Number.isFinite(duration) ? duration : 420) + revealShiftMs();
    window.setTimeout(() => {
      unit.dataset.revealState = 'hidden';
      recenterRevealedUnits();
      const body = getRevealBody(document);
      if (centerPerStep && body) window.setTimeout(() => recenterSlideX(body, { force: true }), revealShiftMs());
    }, Number.isFinite(duration) ? duration : 420);
  };

  // Late layout (images, diagrams, fonts, tab switches) recentres on the next frame.
  let layoutObservers = [];
  let layoutFrame = 0;
  const scheduleRecenter = () => {
    window.cancelAnimationFrame(layoutFrame);
    layoutFrame = window.requestAnimationFrame(() => {
      const body = getRevealBody(document);
      if (!body) {
        recenterCover();
        return;
      }
      recenterSlideX(body);
      recenterRevealedUnits();
    });
  };
  const watchSlideLayout = (body) => {
    layoutObservers.forEach((observer) => observer.disconnect());
    const resize = new ResizeObserver(scheduleRecenter);
    body.querySelectorAll('.vyasa-reveal-unit').forEach((unit) => resize.observe(unit));
    // Style changes are left out: diagram pan and zoom write inline styles every frame.
    const mutation = new MutationObserver((records) => {
      if (records.some((r) => r.target !== body)) scheduleRecenter();
    });
    mutation.observe(body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'open', 'src'] });
    layoutObservers = [resize, mutation];
  };
  document.fonts?.ready.then(scheduleRecenter);

  const initReveal = (root = document) => {
    const body = root.querySelector('.vyasa-zen-slide-body[data-reveal-mode="stagger"]');
    if (!body) {
      revealLog('initReveal: no reveal body on page', { url: location.href });
      recenterCover();
      return;
    }
    if (body.dataset.revealInitialized === '1') {
      revealLog('initReveal: already initialized, skipping', { url: location.href });
      return;
    }
    clearRevealTimers();
    const readMs = (value, fallback) => {
      const parsed = parseInt(String(value || '').replace(/ms$/, ''), 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const units = Array.from(body.querySelectorAll('.vyasa-reveal-unit'));
    const policy = body.dataset.revealPolicy || 'step';
    const navDirection = pendingRevealDirection;
    pendingRevealDirection = null;
    const stagger = readMs(body.style.getPropertyValue('--vyasa-reveal-stagger') || getComputedStyle(body).getPropertyValue('--vyasa-reveal-stagger'), 300);
    const fallbackDuration = readMs(body.style.getPropertyValue('--vyasa-reveal-duration') || getComputedStyle(body).getPropertyValue('--vyasa-reveal-duration'), 420);
    const baseDelay = Math.max(120, Math.round(stagger * 0.6));
    units.forEach((unit, index) => {
      const style = unit.dataset.revealStyle || body.dataset.revealStyle || 'slide-right';
      unit.dataset.revealStyle = style;
      if (style === 'none' || style === 'instant') {
        unit.dataset.revealState = 'visible';
        return;
      }
      if (navDirection !== 'back') {
        unit.dataset.revealState = 'hidden';
      }
      const delay = readMs(unit.dataset.revealDelay, baseDelay + index * stagger);
      const duration = readMs(unit.dataset.revealDuration, fallbackDuration);
      const distance = unit.dataset.revealDistance || body.style.getPropertyValue('--vyasa-reveal-distance') || getComputedStyle(body).getPropertyValue('--vyasa-reveal-distance');
      const easing = unit.dataset.revealEasing || body.style.getPropertyValue('--vyasa-reveal-easing') || getComputedStyle(body).getPropertyValue('--vyasa-reveal-easing');
      if (distance) unit.style.setProperty('--vyasa-reveal-distance', distance.trim());
      if (duration) unit.style.setProperty('--vyasa-reveal-duration', `${duration}ms`);
      if (easing) unit.style.setProperty('--vyasa-reveal-easing', easing.trim());
      if (policy === 'auto') {
        revealTimers.push(window.setTimeout(() => {
          showUnit(unit);
          revealLog('auto reveal timer fired', {
            index: unit.dataset.revealIndex,
            text: (unit.textContent || '').trim().slice(0, 140),
          });
        }, delay));
      }
    });
    const backNavMode = navDirection === 'back';
    if (backNavMode) {
      getStepUnits(root).forEach((unit) => {
        unit.dataset.revealState = 'visible';
      });
      revealLog('initReveal: restored fully revealed state for backward navigation', { url: location.href });
      if (pendingSlideBottomScroll) {
        pendingSlideBottomScroll = false;
        window.setTimeout(scrollToSlideBottom, 120);
      }
    }
    if (!backNavMode && policy === 'step') {
      initialRevealUnits(units).forEach((unit, index) => {
        revealTimers.push(window.setTimeout(() => {
          if (unit.dataset.revealState !== 'visible') {
            showInitialUnit(body, unit);
            revealLog('initial reveal timer fired', {
              index: unit.dataset.revealIndex,
              kind: unit.dataset.revealKind,
            });
          }
        }, baseDelay + index * stagger));
      });
    }
    body.dataset.revealInitialized = '1';
    const state = units.map((unit) => ({
      index: unit.dataset.revealIndex,
      state: unit.dataset.revealState,
      style: unit.dataset.revealStyle,
      text: (unit.textContent || '').trim().slice(0, 140),
    }));
    window.__vyasaRevealDebug = {
      url: location.href,
      policy,
      unit: body.dataset.revealUnit || null,
      count: units.length,
      state,
    };
    revealLog('initReveal complete', window.__vyasaRevealDebug);
    syncSlideProgressBar(root);
    recenterSlideX(body);
    recenterRevealedUnits(root);
    watchSlideLayout(body);
    slideDebug('table-snapshot', { reason: 'init', tables: tableSnapshot(root) });
  };

  const follow = (side, useSegmentCache = false) => {
    const control = document.querySelector(`[data-zen-nav="${side}"]`);
    if (!control) return false;
    const href = control.dataset.zenHref || control.getAttribute('href');
    return followHref(href, side === 'left' ? 'back' : 'forward', useSegmentCache);
  };

  const retainDebugQuery = (href) => {
    const current = new URLSearchParams(location.search);
    const target = new URL(href, location.href);
    ['tasks_debug', 'tasks_perf', 'slides_debug', 'slides_center'].forEach((key) => {
      if (current.has(key)) target.searchParams.set(key, current.get(key) || '');
    });
    return `${target.pathname}${target.search}${target.hash}`;
  };

  const followHref = (href, direction = 'forward', useSegmentCache = false) => {
    if (!href) return false;
    href = retainDebugQuery(href);
    slideDebug('followHref', { href, direction, useSegmentCache });
    pendingRevealDirection = direction;
    pendingSlideBottomScroll = direction === 'back';
    if (useSegmentCache) {
      cacheCurrentSlide();
      if (restoreCachedSlide(href)) return true;
    }
    if (window.htmx && typeof window.htmx.ajax === 'function') {
      window.htmx.ajax('GET', href, {
        target: '#main-content',
        swap: 'outerHTML show:window:top settle:0.1s',
      }).then(() => {
        const nextUrl = new URL(href, location.href);
        if (`${window.location.pathname}${window.location.search}` !== `${nextUrl.pathname}${nextUrl.search}`) {
          window.history.pushState(null, '', href);
        }
      });
    } else {
      window.location.href = href;
    }
    return true;
  };

  const disableNavbarBoost = () => {
    document
      .querySelectorAll('#site-navbar a')
      .forEach((link) => link.setAttribute('hx-boost', 'false'));
  };

  disableNavbarBoost();
  document.body.addEventListener('htmx:afterSwap', disableNavbarBoost);
  document.body.addEventListener('htmx:afterSwap', () => {
    initReveal();
  });
  initReveal();
  window.addEventListener('resize', scheduleRecenter);

  // Debug rulers (?slides_debug): gaps between the revealed ink box and the slide area
  // (navbar bottom, window bottom, window edges), redrawn whenever a value changes.
  if (new URLSearchParams(location.search).has('slides_debug')) {
    const overlay = document.createElement('div');
    overlay.className = 'vyasa-zen-ruler';
    overlay.setAttribute('aria-hidden', 'true');
    const inkBox = document.createElement('div');
    inkBox.className = 'vyasa-zen-ruler-ink';
    const sides = ['top', 'right', 'bottom', 'left'];
    const lines = Object.fromEntries(sides.map((side) => {
      const line = document.createElement('div');
      line.className = `vyasa-zen-ruler-line vyasa-zen-ruler-${side}`;
      return [side, line];
    }));
    overlay.append(inkBox, ...Object.values(lines));
    document.body.append(overlay);
    const describe = (el) => [el.tagName.toLowerCase(), ...(el.getAttribute('class') || '').split(/\s+/).filter(Boolean)].join('.');
    const edgeSources = (items) => Object.fromEntries([['top', 1], ['right', -1], ['bottom', -1], ['left', 1]].map(([side, sign]) => {
      const pick = items.reduce((best, item) => (sign * (item.r[side] - best.r[side]) < 0 ? item : best));
      return [side, describe(pick.el)];
    }));
    const measure = () => {
      const body = getRevealBody(document);
      const card = document.querySelector('.vyasa-zen-cover');
      const units = body ? shownUnits(body) : [];
      const items = body ? shownInk(body) : card ? inkItems(card) : [];
      if (!items.length) return null;
      const ink = unionRect(items.map(({ r }) => r));
      const frame = {
        top: Math.round(document.getElementById('site-navbar')?.getBoundingClientRect().bottom || 0),
        width: document.documentElement.clientWidth,
        height: window.innerHeight,
      };
      const tenth = (value) => Math.round(value * 10) / 10;
      const gaps = (r) => ({
        top: tenth(r.top - frame.top), right: tenth(frame.width - r.right),
        bottom: tenth(frame.height - r.bottom), left: tenth(r.left),
      });
      const box = unionRect(units.map((unit) => unit.getBoundingClientRect()));
      return { ink, frame, inkGaps: gaps(ink), boxGaps: gaps(box), revealed: units.length, edges: edgeSources(items) };
    };
    const place = (el, left, top, width, height) => Object.assign(el.style, {
      left: `${left}px`, top: `${top}px`, width: `${Math.max(0, width)}px`, height: `${Math.max(0, height)}px`,
    });
    const draw = ({ ink, frame, inkGaps }) => {
      const midX = (ink.left + ink.right) / 2;
      const midY = (ink.top + ink.bottom) / 2;
      place(inkBox, ink.left, ink.top, ink.right - ink.left, ink.bottom - ink.top);
      place(lines.top, midX, frame.top, 0, inkGaps.top);
      place(lines.bottom, midX, ink.bottom, 0, inkGaps.bottom);
      place(lines.left, 0, midY, inkGaps.left, 0);
      place(lines.right, ink.right, midY, inkGaps.right, 0);
      sides.forEach((side) => { lines[side].dataset.px = inkGaps[side]; });
    };
    let lastKey = '';
    let logTimer = 0;
    const tick = () => {
      const m = measure();
      overlay.hidden = !m;
      const key = m ? JSON.stringify([m.inkGaps, m.boxGaps, m.frame]) : '';
      if (m && key !== lastKey) {
        draw(m);
        window.clearTimeout(logTimer);
        logTimer = window.setTimeout(() => {
          const payload = {
            path: location.pathname, revealed: m.revealed, ink: m.inkGaps, box: m.boxGaps, edges: m.edges,
            yDiff: Math.round((m.inkGaps.top - m.inkGaps.bottom) * 10) / 10, xDiff: Math.round((m.inkGaps.left - m.inkGaps.right) * 10) / 10,
          };
          console.info('[vyasa:margins]', payload);
          slideDebug('margins', payload);
        }, 300);
      }
      lastKey = key;
      window.requestAnimationFrame(tick);
    };
    window.__vyasaMargins = measure;
    window.requestAnimationFrame(tick);
  }

  const toggleOverview = () => {
    const panel = document.getElementById('slide-overview');
    if (!panel) return;
    slideShortcutHelp.close();
    panel.classList.toggle('hidden');
    fitOverview();
  };
  const overviewIsOpen = () =>
    !document.getElementById('slide-overview')?.classList.contains('hidden');
  // The spacer rows only let a scrolling list centre its selection; a list that fits drops them.
  const fitOverview = () => {
    const card = document.querySelector('#slide-overview .vyasa-zen-overview-card');
    if (!card || !overviewIsOpen()) return;
    card.classList.add('is-compact');
    card.classList.toggle('is-compact', card.scrollHeight <= card.clientHeight);
  };
  const overviewRows = () =>
    Array.from(document.querySelectorAll('#slide-overview [data-zen-overview-node]'));
  const refreshOverviewVisibility = () => {
    const collapsedDepths = [];
    overviewRows().forEach((row) => {
      const depth = Number(row.dataset.depth);
      while (collapsedDepths.length && collapsedDepths.at(-1) >= depth) collapsedDepths.pop();
      row.hidden = collapsedDepths.length > 0;
      if (!row.hidden && row.dataset.collapsed === 'true') collapsedDepths.push(depth);
    });
    fitOverview();
  };
  const moveOverviewSelection = (delta) => {
    const links = overviewRows()
      .filter((row) => !row.hidden)
      .map((row) => row.querySelector('[data-zen-overview-focus]'));
    if (!links.length) return false;
    const activeIndex = links.indexOf(document.activeElement);
    const nextIndex = Math.max(0, Math.min(
      links.length - 1,
      activeIndex < 0 ? (delta > 0 ? 0 : links.length - 1) : activeIndex + delta,
    ));
    links[nextIndex].focus({ preventScroll: true });
    const row = links[nextIndex].closest('tr');
    row?.scrollIntoView({ block: 'center' });
    window.setTimeout(() => {
      const card = document.querySelector('#slide-overview .vyasa-zen-overview-card');
      const rowRect = row?.getBoundingClientRect();
      const cardRect = card?.getBoundingClientRect();
      slideDebug('overview-selection', {
        index: nextIndex,
        rowCenter: rowRect ? Math.round(rowRect.top + rowRect.height / 2) : null,
        cardCenter: cardRect ? Math.round(cardRect.top + cardRect.height / 2) : null,
        scrollTop: card?.scrollTop ?? null,
        scrollHeight: card?.scrollHeight ?? null,
        clientHeight: card?.clientHeight ?? null,
      });
    }, 0);
    return true;
  };
  const moveOverviewBranch = (direction) => {
    const rows = overviewRows();
    const row = document.activeElement?.closest('[data-zen-overview-node]');
    if (!row) return moveOverviewSelection(direction === 'l' ? 1 : -1);
    const index = rows.indexOf(row);
    const depth = Number(row.dataset.depth);
    const hasChildren = row.dataset.hasChildren === 'true';
    if (direction === 'l' && hasChildren && row.dataset.collapsed === 'true') {
      row.dataset.collapsed = 'false';
      row.setAttribute('aria-expanded', 'true');
      refreshOverviewVisibility();
      return true;
    }
    if (direction === 'h' && hasChildren && row.dataset.collapsed === 'false') {
      row.dataset.collapsed = 'true';
      row.setAttribute('aria-expanded', 'false');
      refreshOverviewVisibility();
      return true;
    }
    const target = direction === 'l'
      ? rows[index + 1]
      : rows.slice(0, index).reverse().find((candidate) =>
          !candidate.hidden && Number(candidate.dataset.depth) < depth);
    if (target && !target.hidden && (direction === 'h' || Number(target.dataset.depth) > depth)) {
      target.querySelector('[data-zen-overview-focus]')?.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center' });
    }
    return true;
  };
  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-zen-overview-toggle="true"]');
    if (toggle) {
      event.preventDefault();
      toggleOverview();
      return;
    }
    const branchToggle = event.target.closest('[data-zen-overview-toggle-branch]');
    if (branchToggle) {
      branchToggle.focus({ preventScroll: true });
      const row = branchToggle.closest('[data-zen-overview-node]');
      moveOverviewBranch(row?.dataset.collapsed === 'true' ? 'l' : 'h');
      event.preventDefault();
      return;
    }
    const nav = event.target.closest('[data-zen-nav]');
    if (nav) {
      const side = nav.dataset.zenNav;
      if (side === 'right' && (revealNextUnit() || follow('right'))) {
        revealLog('click ArrowRight handled');
        event.preventDefault();
        return;
      }
      if (side === 'left' && (hidePreviousUnit() || follow('left'))) {
        revealLog('click ArrowLeft handled');
        event.preventDefault();
        return;
      }
    }
    const overviewRow = event.target.closest('[data-zen-overview-href]');
    if (overviewRow && !event.target.closest('a, button, input, textarea, select, summary')) {
      if (followHref(overviewRow.dataset.zenOverviewHref, 'forward')) {
        document.getElementById('slide-overview')?.classList.add('hidden');
        event.preventDefault();
        return;
      }
    }
    if (!event.target.closest('#slide-overview')) {
      document.getElementById('slide-overview')?.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (event) => {
    slideDebug('keydown', {
      key: event.key, code: event.code, defaultPrevented: event.defaultPrevented,
      modifiers: { alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey },
      target: event.target?.tagName || '', active: document.activeElement?.tagName || '',
    });
    if (event.defaultPrevented) return;
    if (event.key === 'Escape' && event.shiftKey && window.__vyasaZen?.post) {
      window.location.href = window.__vyasaZen.post;
      event.preventDefault();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey
      || event.target?.matches?.('input, textarea, select') || event.target?.isContentEditable) return;
    const key = event.key.toLowerCase();
    if (overviewIsOpen() && (key === 'h' || key === 'l')) {
      if (moveOverviewBranch(key)) event.preventDefault();
      return;
    }
    if (overviewIsOpen() && (key === 'j' || key === 'k')) {
      if (moveOverviewSelection(key === 'j' ? 1 : -1)) event.preventDefault();
      return;
    }
    if (key === 'm' || key === 'escape') {
      toggleOverview();
      event.preventDefault();
    }
    if (key === 'h' && follow('left', true)) event.preventDefault();
    if (key === 'j' && (scrollLastVisibleUnit('down') || revealNextUnit() || follow('right'))) event.preventDefault();
    if (key === 'k' && (scrollLastVisibleUnit('up') || hidePreviousUnit() || follow('left'))) event.preventDefault();
    if (key === 'l' && follow('right', true)) event.preventDefault();
    if (event.key === 'ArrowLeft' && (hidePreviousUnit() || follow('left'))) {
      revealLog('keydown ArrowLeft handled');
      event.preventDefault();
    }
    if (event.key === 'ArrowRight' && (revealNextUnit() || follow('right'))) {
      revealLog('keydown ArrowRight handled');
      event.preventDefault();
    }
  });

  let touchStartX = null;
  let touchStartY = null;
  document.addEventListener('touchstart', (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });

  document.addEventListener('touchend', (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch || touchStartX == null || touchStartY == null) return;
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    touchStartX = null;
    touchStartY = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    if (dx < 0 && (revealNextUnit() || follow('right'))) {
      revealLog('touch swipe right->left handled');
      event.preventDefault();
    }
    if (dx > 0 && (hidePreviousUnit() || follow('left'))) {
      revealLog('touch swipe left->right handled');
      event.preventDefault();
    }
  }, { passive: false });
}
