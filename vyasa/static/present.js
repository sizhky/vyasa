if (!window.__vyasaZenBound) {
  window.__vyasaZenBound = true;

  const follow = (side) => {
    const link = document.querySelector(`[data-zen-nav="${side}"]`);
    if (!link) return false;
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
      event.preventDefault();
    }
    if (event.key === 'ArrowRight' && follow('right')) {
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
    if (dx < 0 && follow('right')) event.preventDefault();
    if (dx > 0 && follow('left')) event.preventDefault();
  }, { passive: false });
}
