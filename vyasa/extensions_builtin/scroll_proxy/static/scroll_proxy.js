const themes = [];
let installedBar = null;
let stopFlag = () => {};
let stopTip = () => {};
const scrollMotion = { y: 0, velocity: 0, time: 0, movedAt: -Infinity };
const SCROLL_EMIT_WINDOW = 400;
let activeTheme = null;
let lastEmit = 0;

// sparks read as a continuous fountain; shapes only earn their keep while the reader is moving
function emitsAlways(theme) {
    return theme?.particleMode === 'always';
}

function scrolling() {
    return performance.now() - scrollMotion.movedAt < SCROLL_EMIT_WINDOW;
}

function idleParticles(bar) {
    return Array.from(bar.querySelectorAll('.vyasa-scroll-proxy-effects > span'))
        .filter((particle) => !particle.getAnimations().length);
}

// always-on themes may spread their first cycle: nothing has scrolled yet, so no origin goes stale
function wakeParticles(bar, theme) {
    idleParticles(bar).forEach((particle) => emitParticle(particle, bar, theme, Math.random() * theme.physics.lifetime[1] * 1000));
}

// one particle per interval, launched now from the live scroll position
function sprinkle(bar, theme, now) {
    const perSecond = Math.max(1, theme.particleCount) / Math.max(0.1, theme.physics.lifetime[1] * 0.75);
    if (now - lastEmit < 1000 / perSecond) return;
    const [particle] = idleParticles(bar);
    if (!particle) return;
    emitParticle(particle, bar, theme, 0);
    lastEmit = now;
}

const THEME_DEFAULTS = { priority: 0, dates: [], particles: [], particleCount: 32, particleMode: 'scroll', physics: { lifetime: [0.45, 1.1], vx: 90, vy: [-135, -35], gravity: 200, drag: 2, spin: 0, stretch: 1, size: 2, glow: 7, originSpreadX: 12, originSpreadY: 4, colorByAge: true, colors: ['#fffbea', '#ffd16a', '#d95b16'] } };

function merge(base, patch) {
    if (patch === undefined) return base;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
    const result = { ...base };
    Object.entries(patch).forEach(([key, value]) => { result[key] = merge(result[key], value); });
    return result;
}

export function registerScrollProxyTheme(theme, defer = false) {
    if (!theme?.id) return false;
    const index = themes.findIndex((candidate) => candidate.id === theme.id);
    const merged = merge(merge(THEME_DEFAULTS, index < 0 ? {} : themes[index]), theme);
    if (index < 0) themes.push(merged); else themes[index] = merged;
    themes.sort((left, right) => right.priority - left.priority);
    if (installedBar && !defer) applyTheme(installedBar, currentTheme());
    return true;
}

function resolveThemeAssets(theme, base) {
    const patch = {};
    if (theme.flag?.src) patch.flag = { src: new URL(theme.flag.src, base).href };
    if (theme.tip?.src) patch.tip = { src: new URL(theme.tip.src, base).href };
    if (theme.particles?.some((entry) => entry?.src)) patch.particles = theme.particles
        .map((entry) => entry?.src ? { ...entry, src: new URL(entry.src, base).href } : entry);
    return Object.keys(patch).length ? merge(theme, patch) : theme;
}

function themeTip(theme) {
    return theme.tip?.link && (theme.tip.src || theme.tip.emoji) ? theme.tip : null;
}

function mountTip(bar, theme) {
    const tip = themeTip(theme);
    if (!tip) return () => {};
    let destination;
    try { destination = new URL(tip.link, location.href); } catch { return () => {}; }
    if (!['http:', 'https:'].includes(destination.protocol)) return () => {};
    const link = document.createElement('a');
    link.className = 'vyasa-scroll-proxy-tip';
    link.href = destination.href;
    link.setAttribute('aria-label', tip.label || theme.id);
    link.title = tip.label || theme.id;
    if (destination.origin !== location.origin) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    if (tip.src) {
        const image = document.createElement('img');
        image.src = tip.src; image.alt = ''; link.appendChild(image);
    } else link.textContent = tip.emoji;
    bar.appendChild(link);
    return () => link.remove();
}

async function loadScrollProxyThemes() {
    const extra = new URL(import.meta.url).searchParams.get('themes') || '';
    const sources = ['./themes.json', ...extra.split(',')].map((source) => source.trim()).filter(Boolean);
    for (const source of sources) {
        const base = new URL(source, import.meta.url).href;
        const payload = await fetch(base).then((response) => response.ok ? response.json() : null).catch(() => null);
        (Array.isArray(payload) ? payload : payload?.themes || [])
            .forEach((theme) => registerScrollProxyTheme(resolveThemeAssets(theme, base), true));
    }
    (globalThis.VyasaScrollProxyThemes || []).forEach((theme) => registerScrollProxyTheme(theme, true));
    const theme = currentTheme();
    if (installedBar) applyTheme(installedBar, theme);
    console.info(`[vyasa scroll proxy] ${describeScrollProxyTheme(theme, themeReason())}`);
}

function themeReason() {
    if (dateOverride) return previewDate().toDateString();
    return randomEnabled() ? 'random mode' : previewDate().toDateString();
}

export function describeScrollProxyTheme(theme, reason) {
    if (!theme) return `no theme matched ${reason}`;
    const notes = [`${theme.particleCount || 0} particles (${theme.particleMode})`];
    if (theme.flag?.src) notes.push('flag');
    if (themeTip(theme)) notes.push('tip');
    if (stillEnabled()) notes.push('still');
    return `${theme.id} — ${reason} — ${notes.join(', ')}`;
}

export function matchesScrollProxyDate(theme, date) {
    return (theme.dates || []).some(({ month, startDay = 1, endDay = 31 }) =>
        date.getMonth() + 1 === month && date.getDate() >= startDay && date.getDate() <= endDay
    );
}

export function resolveScrollProxyTheme(date = new Date(), random = false, randomValue = Math.random()) {
    if (random) return themes[Math.floor(randomValue * themes.length)] || themes[0];
    return themes.find((theme) => matchesScrollProxyDate(theme, date)) || themes.find((theme) => theme.id === 'default');
}

function randomEnabled() {
    return new URL(import.meta.url).searchParams.get('random') === '1';
}

let stillOverride = null;

export function parseScrollProxyDate(stamp, today = new Date()) {
    const parts = /^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})$/.exec((stamp || '').trim());
    if (!parts) return today;
    // built from local parts on purpose: new Date('2026-01-26') is UTC midnight and slips a day west of Greenwich
    const date = new Date(parts[1] ? Number(parts[1]) : today.getFullYear(), Number(parts[2]) - 1, Number(parts[3]));
    return Number.isNaN(date.getTime()) ? today : date;
}

let dateOverride = null;

function previewDate() {
    return dateOverride || new Date();
}

// an explicitly requested date is a question about the calendar, so random mode must not answer it
function currentTheme() {
    return resolveScrollProxyTheme(previewDate(), dateOverride ? false : randomEnabled());
}


function stillEnabled() {
    if (stillOverride !== null) return stillOverride;
    return new URL(import.meta.url).searchParams.get('still') === '1'
        || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function emitParticle(particle, bar, theme, stagger = null) {
    if (!particle.isConnected) return;
    const physics = theme.physics;
    const lifetime = physics.lifetime[0] + Math.random() * (physics.lifetime[1] - physics.lifetime[0]);
    const momentum = scrollMotion.velocity * Math.exp(-Math.max(0, performance.now() - scrollMotion.time) / 120);
    const vx = (Math.random() - 0.5) * physics.vx * 2 + momentum;
    const vy = physics.vy[0] + Math.random() * (physics.vy[1] - physics.vy[0]);
    const spin = (Math.random() - 0.5) * physics.spin;
    const resistance = Math.max(0, physics.drag);
    particle.style.fontSize = `${physics.size}px`;
    particle.style.width = particle.style.height = `${physics.size}px`;
    const painted = Boolean(particle.textContent) || 'image' in particle.dataset;
    const swatch = physics.colors[Math.floor(Math.random() * physics.colors.length)];
    const origin = parseFloat(bar.style.getPropertyValue('--vyasa-scroll-position')) / 100 * bar.clientWidth || 0;
    const originX = origin + (Math.random() * 2 - 1) * physics.originSpreadX;
    const originY = (Math.random() * 2 - 1) * physics.originSpreadY;
    const frames = Array.from({ length: 25 }, (_, index) => {
        const age = index / 24;
        const time = age * lifetime;
        const drag = Math.exp(-resistance * time);
        const travel = resistance ? (1 - drag) / resistance : time;
        const fall = resistance ? (time - travel) / resistance : time * time / 2;
        const color = physics.colorByAge ? physics.colors[Math.min(physics.colors.length - 1, Math.floor(age * physics.colors.length))] : swatch;
        const dx = vx * drag;
        const dy = vy * drag + physics.gravity * travel;
        return {
            offset: age,
            transform: `translate(${originX + vx * travel}px, ${originY + vy * travel + physics.gravity * fall}px) rotate(${Math.atan2(dy, dx) * physics.stretch + spin * time}rad) scale(${1 + physics.stretch * (Math.max(0.4, Math.hypot(dx, dy) / 35) - 1)}, ${1 - age * 0.7 * physics.stretch})`,
            opacity: Math.min(1, age * 16) * (1 - age) ** 1.5,
            color,
            backgroundColor: painted ? 'transparent' : color,
            filter: `drop-shadow(0 0 ${physics.glow}px ${color})`,
        };
    });
    particle.animate(frames, { duration: lifetime * 1000, delay: stagger ?? Math.random() * 120, easing: 'linear' })
        .onfinish = () => { if (emitsAlways(theme) || scrolling()) emitParticle(particle, bar, theme); };
}

export function createFlagCloth(width, height, { foldStiffness = 0.15, gravity = 500, windStrength = 350, windCalm = 2.5, windBurstLength = 1.4, windReversal = 0.5, flutter = 0.9, flutterWaves = 1.6, flutterSpeed = 2.5, damping = 0.99 } = {}) {
    const points = Array.from({ length: 45 }, (_, i) => {
        const u = i % 9 / 8, v = Math.floor(i / 9) / 4;
        const p = [u * width, v * height, u ? Math.sin(i) * u * 0.5 : 0];
        return { u, v, p, previous: [...p], weight: u ? 1 : 0 };
    });
    const links = [], triangles = [];
    points.forEach((a, i) => {
        [1, 9, 10, 8].forEach((offset) => {
            const b = points[i + offset];
            if (!b || Math.abs(a.u - b.u) > 1 / 8 || Math.abs(a.v - b.v) > 1 / 4) return;
            links.push({ a, b, stiffness: offset === 8 ? Math.max(0, Math.min(1, foldStiffness)) : 1, length: Math.hypot(...a.p.map((value, axis) => value - b.p[axis])) });
        });
        if (a.u < 1 && a.v < 1) triangles.push([i, i + 1, i + 10], [i, i + 10, i + 9]);
    });
    let quiet = 0, wavePhase = 0, burstLeft = 0, burstSpan = 1, burstPower = 0, burstSide = 0, calmLeft = 0;
    return { points, triangles, step(movement = 0, windScale = 1) {
        const strength = Math.max(0, windStrength) * windScale;
        if (burstLeft > 0) burstLeft -= 1 / 120;
        else if (calmLeft > 0) calmLeft -= 1 / 120;
        else if (strength) {
            burstSpan = Math.max(0.05, windBurstLength) * (0.5 + Math.random());
            burstLeft = burstSpan;
            calmLeft = Math.max(0, windCalm) * (0.3 + 1.4 * Math.random());
            burstPower = (0.4 + Math.random() * 0.6) * (Math.random() < Math.max(0, Math.min(1, windReversal)) ? -1 : 1);
            burstSide = Math.random() * 2 - 1;
        }
        const envelope = burstLeft > 0 ? burstPower * Math.sin(Math.PI * (1 - burstLeft / burstSpan)) : 0;
        const wind = [strength * envelope, strength * Math.abs(envelope) * burstSide * 0.6];
        wavePhase += Math.max(0, Math.min(20, flutterSpeed)) * Math.PI / 60;
        const ripple = (point, offset) => Math.abs(wind[0]) * flutter * point.u * Math.sin(wavePhase - point.u * flutterWaves * Math.PI * 2 + offset);
        const force = (point, axis) => axis === 1 ? gravity + ripple(point, 0) * 0.5
            : axis === 0 ? wind[0] * (0.3 + 0.7 * point.u)
            : wind[1] * (0.3 + 0.7 * point.u) + ripple(point, Math.PI / 2);
        if (movement || strength) quiet = 0;
        if (quiet >= 30) return;
        const before = points.map(({ p }) => [...p]);
        points.forEach((point, i) => {
            if (!point.weight) return;
            point.p[0] -= movement; point.previous[0] -= movement;
            point.p = point.p.map((value, axis) => value + (value - point.previous[axis]) * damping + force(point, axis) / 14400);
            point.previous = before[i].map((value, axis) => value - (axis === 0 ? movement : 0));
        });
        for (let iteration = 0; iteration < 8; iteration++) links.forEach(({ a, b, length, stiffness }) => {
            const delta = b.p.map((value, axis) => value - a.p[axis]), distance = Math.hypot(...delta);
            const correction = stiffness * (distance - length) / (distance || 1) / (a.weight + b.weight || 1);
            delta.forEach((value, axis) => { a.p[axis] += value * correction * a.weight; b.p[axis] -= value * correction * b.weight; });
        });
        const motion = Math.max(...points.map(({ p }, i) => Math.hypot(...p.map((value, axis) => value - before[i][axis]))));
        quiet = motion < 0.02 ? quiet + 1 : 0;
    } };
}

export function pointOnFlag(outline, x, y) {
    const side = (a, b) => (x - b.x) * (a.y - b.y) - (a.x - b.x) * (y - b.y);
    return outline.some(([a, b, c]) => {
        const d1 = side(a, b), d2 = side(b, c), d3 = side(c, a);
        return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    });
}

function mountFlag(bar, theme) {
    const flag = theme.flag;
    const canvas = document.createElement('canvas'), image = new Image();
    canvas.width = 640; canvas.height = 400;
    const context = canvas.getContext('2d');
    if (!context) return () => {};
    context.scale(2, 2);
    const holder = document.createElement(theme.link ? 'a' : 'span');
    holder.className = 'vyasa-scroll-proxy-flag';
    if (theme.link) {
        holder.href = theme.link;
        holder.target = '_blank';
        holder.rel = 'noopener noreferrer';
        holder.setAttribute('aria-label', flag.label || theme.id);
    }
    holder.appendChild(canvas);
    bar.appendChild(holder);
    let outline = [];
    const hover = (event) => {
        const rect = canvas.getBoundingClientRect();
        holder.style.pointerEvents = pointOnFlag(outline, event.clientX - rect.left, event.clientY - rect.top) ? 'auto' : 'none';
    };
    if (theme.link) document.addEventListener('pointermove', hover, { passive: true });
    const position = () => (parseFloat(bar.style.getPropertyValue('--vyasa-scroll-position')) || 0) * bar.clientWidth / 100;
    const windRecovery = Math.max(0.05, flag.physics?.windRecovery ?? 0.8);
    let frame = 0, previous = 0, pole = position(), remainder = 0, still = 0, cloth, flagHeight = 0;
    const draw = (now) => {
        if (!canvas.isConnected) return;
        remainder += Math.min((now - (previous || now)) / 1000, 0.05);
        const steps = Math.floor(remainder * 120), nextPole = position();
        const animate = !stillEnabled();
        if (nextPole !== pole) still = windRecovery;
        still = Math.max(0, still - steps / 120);
        for (let step = 0; step < steps && animate; step++) cloth.step((nextPole - pole) / steps, 1 - still / windRecovery);
        remainder -= steps / 120; previous = now;
        if (steps) pole = nextPole;
        context.clearRect(0, 0, 320, 200);
        context.fillStyle = '#64748b'; context.fillRect(159, 0, 2, 20 + flagHeight);
        const vertices = cloth.points.map(({ u, v, p }) => ({ x: 160 + p[0] + p[2] / 4, y: 20 + p[1], u: u * image.naturalWidth, v: v * image.naturalHeight }));
        outline = cloth.triangles.map((triangle) => triangle.map((i) => vertices[i]));
        const depth = (triangle) => triangle.reduce((sum, i) => sum + cloth.points[i].p[2], 0);
        [...cloth.triangles].sort((a, b) => depth(a) - depth(b)).forEach((triangle) => {
            const [a, b, c] = triangle.map((i) => vertices[i]);
            const det = (b.u - a.u) * (c.v - a.v) - (c.u - a.u) * (b.v - a.v);
            const xx = ((b.x - a.x) * (c.v - a.v) - (c.x - a.x) * (b.v - a.v)) / det;
            const xy = ((b.y - a.y) * (c.v - a.v) - (c.y - a.y) * (b.v - a.v)) / det;
            const yx = ((c.x - a.x) * (b.u - a.u) - (b.x - a.x) * (c.u - a.u)) / det;
            const yy = ((c.y - a.y) * (b.u - a.u) - (b.y - a.y) * (c.u - a.u)) / det;
            context.save(); context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.lineTo(c.x, c.y); context.closePath(); context.clip();
            context.transform(xx, xy, yx, yy, a.x - xx * a.u - yx * a.v, a.y - xy * a.u - yy * a.v);
            context.drawImage(image, 0, 0); context.restore();
        });
        frame = requestAnimationFrame(draw);
    };
    image.onload = () => {
        flagHeight = Math.min(60, 90 * image.naturalHeight / image.naturalWidth);
        cloth = createFlagCloth(flagHeight * image.naturalWidth / image.naturalHeight, flagHeight, flag.physics);
        for (let step = 0; step < 1200; step++) cloth.step();
        frame = requestAnimationFrame(draw);
    };
    image.onerror = () => holder.remove();
    image.src = flag.src;
    return () => {
        document.removeEventListener('pointermove', hover);
        image.onload = image.onerror = null; cancelAnimationFrame(frame); holder.remove();
    };
}

export function scrollProxyStops(colors) {
    const stops = (colors || []).filter((color) => typeof color === 'string' && color.trim() && !/[;{}]/.test(color));
    return stops.length === 1 ? [stops[0], stops[0]] : stops;
}

function applyTheme(bar, theme) {
    if (!theme) return;
    stopFlag();
    stopTip();
    stopTip = mountTip(bar, theme);
    stopFlag = theme.flag?.src ? mountFlag(bar, theme) : () => {};
    bar.dataset.vyasaScrollTheme = theme.id;
    bar.dataset.vyasaScrollEffect = theme.effect || 'none';
    const stops = scrollProxyStops(theme.colors);
    if (stops.length) {
        bar.style.setProperty('--vyasa-scroll-proxy-colors', stops.join(', '));
        bar.style.setProperty('--vyasa-scroll-proxy-end', stops[stops.length - 1]);
    } else ['colors', 'end'].forEach((name) => bar.style.removeProperty(`--vyasa-scroll-proxy-${name}`));
    const effects = bar.querySelector('.vyasa-scroll-proxy-effects');
    effects.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    effects.replaceChildren(...Array.from({ length: stillEnabled() ? 0 : theme.particleCount || 0 }, (_, index) => {
        const entry = theme.particles[index % theme.particles.length];
        const particle = document.createElement('span');
        if (entry?.src) {
            particle.dataset.image = '';
            particle.style.backgroundImage = `url("${encodeURI(entry.src)}")`;
        } else particle.textContent = entry || '';
        return particle;
    }));
    activeTheme = theme;
    if (emitsAlways(theme)) wakeParticles(bar, theme);
}

function installScrollProxy() {
    if (installedBar?.isConnected) return installedBar;
    document.getElementById('vyasa-scroll-progress')?.remove();
    const bar = document.createElement('div');
    bar.id = 'vyasa-scroll-progress';
    bar.className = 'vyasa-scroll-progress vyasa-scroll-proxy';
    bar.innerHTML = '<span class="vyasa-scroll-proxy-fill" aria-hidden="true"></span><span class="vyasa-scroll-proxy-effects" aria-hidden="true"></span>';
    (document.getElementById('page-container') || document.body).appendChild(bar);
    installedBar = bar;
    scrollMotion.y = window.scrollY;
    const sync = () => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const now = performance.now();
        scrollMotion.velocity = Math.max(-400, Math.min(400, (window.scrollY - scrollMotion.y) / max * bar.clientWidth * 1000 / Math.max(16, now - scrollMotion.time)));
        if (window.scrollY !== scrollMotion.y) scrollMotion.movedAt = now;
        Object.assign(scrollMotion, { y: window.scrollY, time: now });
        if (activeTheme && !emitsAlways(activeTheme) && scrolling()) sprinkle(bar, activeTheme, now);
        const progress = Math.min(1, Math.max(0, window.scrollY / max));
        bar.style.setProperty('--vyasa-scroll-progress', String(progress));
        bar.style.setProperty('--vyasa-scroll-position', `${progress * 100}%`);
    };
    let frame = null;
    const schedule = () => {
        if (frame !== null) return;
        frame = requestAnimationFrame(() => { frame = null; sync(); });
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('htmx:afterSwap', schedule);
    sync();
    applyTheme(bar, currentTheme());
    return bar;
}

globalThis.VyasaScrollProxy = { setDate: (stamp) => {
    dateOverride = stamp === null ? null : parseScrollProxyDate(stamp);
    const theme = currentTheme();
    if (installedBar) applyTheme(installedBar, theme);
    return `${previewDate().toDateString()} -> ${theme?.id}${dateOverride && randomEnabled() ? ' (random mode bypassed)' : ''}`;
}, setStill: (on) => {
    stillOverride = on === null ? null : Boolean(on);
    if (installedBar) applyTheme(installedBar, currentTheme());
    return stillEnabled();
}, registerTheme: registerScrollProxyTheme, resolveTheme: resolveScrollProxyTheme, list: () => themes.map(({ id, dates, colors, particleCount, flag }) => ({
    id,
    when: (dates || []).map(({ month, startDay = 1, endDay = 31 }) =>
        `${month}/${startDay}${endDay === startDay ? '' : `-${endDay}`}`).join(' ') || 'fallback',
    stops: (colors || []).length,
    particles: particleCount,
    flag: Boolean(flag?.src),
})), refresh: (id) => installedBar && applyTheme(installedBar, themes.find((theme) => theme.id === id) || currentTheme()) };

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installScrollProxy, { once: true });
    else installScrollProxy();
    loadScrollProxyThemes();
}
