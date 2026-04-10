if (!window.__vyasaZenBound) {
  window.__vyasaZenBound = true;
  let revealTimers = [];
  const revealLog = (...args) => console.info('[vyasa:reveal]', ...args);
  let pendingRevealDirection = null;
  let pendingSlideBottomScroll = false;

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

  const getBaselineVisibleCount = (root = document) => {
    const units = getStepUnits(root);
    const headingCount = units.filter((unit) => unit.dataset.revealKind === 'heading').length;
    return headingCount > 0 ? headingCount : Math.min(1, units.length);
  };

  const revealNextUnit = (root = document) => {
    const body = getRevealBody(root);
    if (!body || (body.dataset.revealPolicy || 'step') !== 'step') return false;
    const next = getStepUnits(root).find((unit) => unit.dataset.revealState !== 'visible');
    if (!next) {
      revealLog('revealNextUnit: no hidden units remain');
      return false;
    }
    showUnit(next);
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
    revealLog('hidePreviousUnit: hid unit', {
      index: target.dataset.revealIndex,
      text: (target.textContent || '').trim().slice(0, 140),
    });
    return true;
  };

  const clearRevealTimers = () => {
    revealTimers.forEach((timer) => window.clearTimeout(timer));
    revealTimers = [];
  };

  const getRevealViewportInsets = () => {
    const navbarBottom = document.getElementById('site-navbar')?.getBoundingClientRect().bottom || 0;
    return {
      top: Math.max(24, Math.ceil(navbarBottom + 16)),
      bottom: 24,
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
    window.scrollTo({
      top: Math.max(0, Math.round(targetTop)),
      behavior: 'smooth',
    });
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

  const showUnit = (unit, { keepVisible = true } = {}) => {
    unit.dataset.revealState = 'entering';
    if (keepVisible) {
      window.requestAnimationFrame(() => keepUnitInView(unit));
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        unit.dataset.revealState = 'visible';
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
    window.setTimeout(() => {
      unit.dataset.revealState = 'hidden';
    }, Number.isFinite(duration) ? duration : 420);
  };

  const initReveal = (root = document) => {
    clearRevealTimers();
    const body = root.querySelector('.vyasa-zen-slide-body[data-reveal-mode="stagger"]');
    if (!body) {
      revealLog('initReveal: no reveal body on page', { url: location.href });
      return;
    }
    if (body.dataset.revealInitialized === '1') {
      revealLog('initReveal: already initialized, skipping', { url: location.href });
      return;
    }
    const readMs = (value, fallback) => {
      const parsed = parseInt(String(value || '').replace(/ms$/, ''), 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const units = Array.from(body.querySelectorAll('.vyasa-reveal-unit'));
    const policy = body.dataset.revealPolicy || 'step';
    const navDirection = pendingRevealDirection;
    pendingRevealDirection = null;
    const stagger = readMs(body.style.getPropertyValue('--vyasa-reveal-stagger') || getComputedStyle(body).getPropertyValue('--vyasa-reveal-stagger'), 220);
    const fallbackDuration = readMs(body.style.getPropertyValue('--vyasa-reveal-duration') || getComputedStyle(body).getPropertyValue('--vyasa-reveal-duration'), 420);
    const baseDelay = Math.max(120, Math.round(stagger * 0.6));
    units.forEach((unit, index) => {
      const style = unit.dataset.revealStyle || body.dataset.revealStyle || 'slide-right';
      unit.dataset.revealStyle = style;
      if (style === 'none' || style === 'instant') {
        unit.dataset.revealState = 'visible';
        return;
      }
      if (unit.dataset.revealState !== 'visible') {
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
    if (!backNavMode && policy === 'step' && !units.some((unit) => unit.dataset.revealState === 'visible')) {
      revealNextUnit(root);
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
  };

  const follow = (side) => {
    const link = document.querySelector(`[data-zen-nav="${side}"]`);
    if (!link) return false;
    pendingRevealDirection = side === 'left' ? 'back' : 'forward';
    pendingSlideBottomScroll = side === 'left';
    link.click();
    return true;
  };

  const disableNavbarBoost = () => {
    document
      .querySelectorAll('#site-navbar a')
      .forEach((link) => link.setAttribute('hx-boost', 'false'));
  };

  disableNavbarBoost();
  document.body.addEventListener('htmx:afterSwap', disableNavbarBoost);
  document.body.addEventListener('htmx:afterSwap', () => initReveal());
  initReveal();

  const toggleOverview = () => {
    const panel = document.getElementById('slide-overview');
    if (!panel) return;
    panel.classList.toggle('hidden');
  };
  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-zen-overview-toggle="true"]');
    if (toggle) {
      event.preventDefault();
      toggleOverview();
      return;
    }
    if (!event.target.closest('#slide-overview')) {
      document.getElementById('slide-overview')?.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      document.getElementById('slide-overview')?.classList.add('hidden');
    }
    if (event.key === 'ArrowLeft' && follow('left')) {
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
    if (dx > 0 && follow('left')) {
      revealLog('touch swipe left->right handled');
      event.preventDefault();
    }
  }, { passive: false });
}
