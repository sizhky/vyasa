// Review interaction model derived from lavish-axi. See ../LAVISH_LICENSE.
(function () {
  let documentPath = '';
  let apiDocument = '';
  let queueKey = '';
  let queued = [];
  let presence = 'waiting';
  let snapshot = '';
  let sending = false;
  let captureLoaded = false;
  let annotationEnabled = true;
  let knownEvents = '';
  let lastRefreshCursor = 0;
  let sidebar;
  let launcher;
  let chat;
  let input;
  let pills;
  let sendButton;
  let copyPayloadButton;
  let presenceNode;
  let banner;
  let annotationToggle;

  const pathOf = () => document.getElementById('main-content')?.dataset.feedbackPath || '';

  function createUi() {
    if (sidebar) return;
    launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'vyasa-floating-bubble vyasa-feedback-launcher';
    launcher.title = 'Review document (R)';
    launcher.setAttribute('aria-label', 'Review document');
    launcher.setAttribute('aria-keyshortcuts', 'R');
    launcher.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" class="vyasa-feedback-icon"><path d="M5 5.75h14v9.5H9l-4 3v-12.5Z"/><path d="M8 9h8M8 12h5"/></svg>';
    launcher.dataset.lavishUi = 'true';
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'vyasa-feedback-sidebar');
    sidebar = document.createElement('aside');
    sidebar.id = 'vyasa-feedback-sidebar';
    sidebar.className = 'vyasa-feedback-sidebar';
    sidebar.dataset.lavishUi = 'true';
    sidebar.setAttribute('aria-label', 'Agent review conversation');
    sidebar.addEventListener('keydown', (event) => event.stopPropagation());
    sidebar.innerHTML = `
      <header class="vyasa-feedback-head"><div><div class="vyasa-feedback-heading">Conversation</div><span class="vyasa-feedback-presence" data-state="waiting">waiting</span></div><div class="vyasa-feedback-head-actions"><label class="vyasa-feedback-mode"><span>Annotate Mode (A)</span><input type="checkbox" role="switch" checked data-annotation-mode aria-keyshortcuts="A"></label><button class="vyasa-feedback-close" type="button" aria-label="Close review">×</button></div></header>
      <div class="vyasa-feedback-chat"></div>
      <div class="vyasa-feedback-compose"><div class="vyasa-feedback-banner">Your agent is not connected. Copy the command, run it in a terminal, then send feedback.</div><div class="vyasa-feedback-pills"></div><textarea class="vyasa-feedback-input" placeholder="Write a message for the agent..."></textarea><div class="vyasa-feedback-actions"><button class="vyasa-feedback-action secondary" type="button" data-copy-listener>Copy command to start agent</button><button class="vyasa-feedback-action secondary" type="button" data-copy-payload>Copy feedback payload</button><button class="vyasa-feedback-action" type="button" data-send>Send to Agent</button></div></div>`;
    document.body.appendChild(sidebar);
    floatingActions().prepend(launcher);
    chat = sidebar.querySelector('.vyasa-feedback-chat');
    input = sidebar.querySelector('.vyasa-feedback-input');
    pills = sidebar.querySelector('.vyasa-feedback-pills');
    sendButton = sidebar.querySelector('[data-send]');
    copyPayloadButton = sidebar.querySelector('[data-copy-payload]');
    presenceNode = sidebar.querySelector('.vyasa-feedback-presence');
    banner = sidebar.querySelector('.vyasa-feedback-banner');
    annotationToggle = sidebar.querySelector('[data-annotation-mode]');
    launcher.onclick = openReview;
    sidebar.querySelector('.vyasa-feedback-close').onclick = closeReview;
    sidebar.querySelector('[data-copy-listener]').onclick = copyListener;
    copyPayloadButton.onclick = copyFeedbackPayload;
    sendButton.onclick = requestSnapshotAndSend;
    annotationToggle.onchange = () => {
      annotationEnabled = annotationToggle.checked;
      if (document.body.classList.contains('vyasa-feedback-open')) setAnnotationMode(annotationEnabled);
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        requestSnapshotAndSend();
      }
    });
    input.addEventListener('input', renderQueue);
  }

  function floatingActions() {
    const shared = window.__vyasaEnsureFloatingActions?.();
    if (shared) return shared;
    const existing = document.getElementById('vyasa-floating-actions');
    if (existing) return existing;
    const rail = document.createElement('div');
    rail.id = 'vyasa-floating-actions';
    rail.className = 'vyasa-floating-actions';
    document.body.appendChild(rail);
    return rail;
  }

  function openReview() {
    loadCapture();
    document.body.classList.add('vyasa-feedback-open');
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      window.__vyasaSyncFloatingActions?.();
    });
    launcher.setAttribute('aria-expanded', 'true');
    setAnnotationMode(annotationEnabled);
    input.focus();
    refreshSession();
  }

  function closeReview() {
    document.body.classList.remove('vyasa-feedback-open');
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      window.__vyasaSyncFloatingActions?.();
    });
    launcher.setAttribute('aria-expanded', 'false');
    setAnnotationMode(false);
  }

  function setAnnotationMode(enabled) {
    const message = { type: 'lavish:setAnnotationMode', enabled };
    window.postMessage(message, '*');
    document.querySelector('#main-content iframe[src*=".html"]')?.contentWindow?.postMessage(message, '*');
  }

  function toggleAnnotationMode() {
    annotationEnabled = !annotationEnabled;
    if (annotationToggle) annotationToggle.checked = annotationEnabled;
    setAnnotationMode(annotationEnabled);
  }

  function loadCapture() {
    if (captureLoaded || document.querySelector('script[data-vyasa-lavish-capture]')) return;
    captureLoaded = true;
    const script = document.createElement('script');
    script.src = '/static/extensions/feedback/lavish-capture.js?v=af721003';
    script.dataset.vyasaLavishCapture = 'true';
    script.onload = () => {
      setAnnotationMode(document.body.classList.contains('vyasa-feedback-open') && annotationEnabled);
      bindNestedHtmlFrame();
    };
    document.head.appendChild(script);
  }

  function bindNestedHtmlFrame() {
    const frame = document.querySelector('#main-content iframe[src*=".html"]');
    if (!frame) return;
    const inject = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc || doc.querySelector('script[data-vyasa-lavish-capture]')) return;
        const script = doc.createElement('script');
        script.src = '/static/extensions/feedback/lavish-capture.js?v=af721003';
        script.dataset.vyasaLavishCapture = 'true';
        script.onload = () => frame.contentWindow?.postMessage({
          type: 'lavish:setAnnotationMode',
          enabled: document.body.classList.contains('vyasa-feedback-open') && annotationEnabled,
        }, '*');
        (doc.head || doc.documentElement).appendChild(script);
      } catch (_) {}
    };
    frame.addEventListener('load', inject);
    inject();
  }

  function loadQueued() {
    try {
      const value = JSON.parse(sessionStorage.getItem(queueKey) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function refreshCursorKey() {
    return `vyasa-feedback:refresh:${documentPath}`;
  }

  function loadLastRefreshCursor() {
    try {
      return Number(sessionStorage.getItem(refreshCursorKey()) || 0) || 0;
    } catch (_) { return 0; }
  }

  function rememberRefreshCursor(cursor) {
    lastRefreshCursor = Math.max(lastRefreshCursor, Number(cursor) || 0);
    try { sessionStorage.setItem(refreshCursorKey(), String(lastRefreshCursor)); } catch (_) {}
  }

  function refreshCurrentDocument() {
    if (window.htmx?.ajax) {
      window.htmx.ajax('GET', location.pathname + location.search, {
        target: '#main-content',
        swap: 'outerHTML show:window:top settle:0.1s',
      });
      return;
    }
    window.location.reload();
  }

  function maybeRefreshDocument(events) {
    const refresh = events
      .filter((event) => event.kind === 'reply' && event.action === 'refresh' && Number(event.cursor) > lastRefreshCursor)
      .pop();
    if (!refresh) return;
    rememberRefreshCursor(refresh.cursor);
    refreshCurrentDocument();
  }

  function persistQueued() {
    try {
      if (queued.length) sessionStorage.setItem(queueKey, JSON.stringify(queued));
      else sessionStorage.removeItem(queueKey);
    } catch (_) {}
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
  }

  function safeHref(value) {
    const href = String(value || '').trim();
    return /^(https?:|mailto:|\/|#)/i.test(href) ? href : '#';
  }

  function renderInlineMarkdown(value) {
    const links = [];
    const linked = String(value || '').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, href) => {
      links.push({ label, href });
      return `@@LAVISH_LINK_${links.length - 1}@@`;
    });
    return escapeHtml(linked)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/@@LAVISH_LINK_(\d+)@@/g, (_match, index) => {
        const link = links[Number(index)] || {};
        return `<a href="${escapeHtml(safeHref(link.href))}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`;
      });
  }

  function renderMarkdown(value) {
    const lines = String(value || '').split(/\r?\n/);
    const html = [];
    let list = '';
    let inCode = false;
    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        if (list) { html.push(`</${list}>`); list = ''; }
        html.push(inCode ? '</code></pre>' : '<pre><code>');
        inCode = !inCode;
      } else if (inCode) html.push(`${escapeHtml(line)}\n`);
      else {
        const item = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
        if (item) {
          const tag = /^\d+\./.test(item[2]) ? 'ol' : 'ul';
          if (list !== tag) { if (list) html.push(`</${list}>`); html.push(`<${tag}>`); list = tag; }
          html.push(`<li>${renderInlineMarkdown(item[3])}</li>`);
        } else {
          if (list) { html.push(`</${list}>`); list = ''; }
          if (line.trim()) html.push(`<p>${renderInlineMarkdown(line)}</p>`);
        }
      }
    }
    if (list) html.push(`</${list}>`);
    if (inCode) html.push('</code></pre>');
    return html.join('');
  }

  function hydrateReply(body) {
    window.__vyasaRenderMathSafely?.(body);
  }

  function enqueue(prompt) {
    if (!prompt || typeof prompt !== 'object') return;
    const replacement = typeof prompt._lavishQueueKey === 'string' ? prompt._lavishQueueKey.trim() : '';
    const index = replacement ? queued.findIndex((item) => item._lavishQueueKey === replacement) : -1;
    if (index >= 0) queued[index] = prompt;
    else queued.push(prompt);
    persistQueued();
    renderQueue();
  }

  function renderQueue() {
    pills.replaceChildren(...queued.map((prompt, index) => {
      const pill = document.createElement('div');
      const text = document.createElement('span');
      const remove = document.createElement('button');
      pill.className = 'vyasa-feedback-pill';
      text.textContent = prompt.prompt;
      text.title = `${prompt.selector || 'Document'}\n${prompt.prompt}`;
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Remove queued feedback');
      remove.onclick = () => { queued.splice(index, 1); persistQueued(); renderQueue(); };
      pill.append(text, remove);
      return pill;
    }));
    sendButton.disabled = sending || presence === 'working';
    copyPayloadButton.disabled = sending || !pendingPrompts().length;
  }

  function syncChat(events) {
    const signature = JSON.stringify([presence, events.map((event) => [event.cursor, event.kind])]);
    if (signature === knownEvents) return;
    knownEvents = signature;
    chat.replaceChildren(...events.map((event) => {
      const bubble = document.createElement('div');
      const label = document.createElement('small');
      const body = document.createElement('div');
      const role = event.kind === 'reply' ? 'agent' : 'user';
      bubble.className = 'vyasa-feedback-bubble';
      bubble.dataset.role = role;
      label.textContent = role === 'agent' ? 'Agent' : 'You';
      body.className = 'vyasa-feedback-body';
      if (role === 'agent') {
        body.innerHTML = event.message_html || renderMarkdown(event.message || '');
        body.dataset.rendered = event.message_html ? 'true' : 'false';
        hydrateReply(body);
      }
      else body.textContent = event.comment || '';
      bubble.append(label, body);
      return bubble;
    }));
    if (presence === 'working') {
      const working = document.createElement('div');
      working.className = 'vyasa-feedback-bubble';
      working.textContent = 'Agent working…';
      chat.appendChild(working);
    }
    chat.scrollTop = chat.scrollHeight;
  }

  async function refreshSession() {
    if (!apiDocument) return;
    try {
      const response = await fetch(`/api/feedback/session/${apiDocument}`, { headers: { accept: 'application/json' } });
      if (!response.ok) return;
      const state = await response.json();
      presence = state.presence || 'waiting';
      presenceNode.dataset.state = presence;
      presenceNode.textContent = presence;
      banner.hidden = presence !== 'waiting';
      syncChat(state.events || []);
      maybeRefreshDocument(state.events || []);
      renderQueue();
    } catch (_) {}
  }

  function requestSnapshotAndSend() {
    if (sending || presence === 'working') return;
    const message = input.value.trim();
    if (message) {
      enqueue({ prompt: message, selector: '', tag: 'message', text: 'Freeform message' });
      input.value = '';
    }
    if (!queued.length) { input.focus(); return; }
    submitQueued();
  }

  function targetFor(prompt) {
    if (prompt.target) return { ...prompt.target, kind: prompt.target.kind || prompt.target.type || 'text-range' };
    if (prompt.selector) return { kind: prompt.tag === 'text' ? 'text-range' : 'element', locator: { selector: prompt.selector }, quote: prompt.text || '' };
    return { kind: 'document', locator: {} };
  }

  function pendingPrompts() {
    const message = input?.value.trim();
    return message
      ? queued.concat({ prompt: message, selector: '', tag: 'message', text: 'Freeform message' })
      : queued.slice();
  }

  function feedbackPayload(prompt) {
    return {
      url: location.pathname + location.search,
      surface: prompt.surface || surface(),
      comment: String(prompt.prompt || ''),
      target: targetFor(prompt),
      snapshot: { selector: prompt.selector || '', tag: prompt.tag || '', selected: prompt.text || '' },
    };
  }

  function agentFeedbackPayload() {
    return {
      document: documentPath,
      status: 'feedback',
      events: pendingPrompts().map((prompt, index) => ({
        cursor: index + 1,
        kind: 'feedback',
        ...feedbackPayload(prompt),
      })),
    };
  }

  function surface() {
    if (document.querySelector('.vyasa-mdx-payload')) return 'mdx';
    if (document.querySelector('.pdf-viewer')) return 'pdf';
    if (document.querySelector('[data-vyasa-review-surface="knowledge-graph"], [data-node-id], [data-edge-id]')) return 'knowledge-graph';
    if (document.querySelector('#main-content iframe[src*=".html"]')) return 'html';
    return 'markdown';
  }

  async function submitQueued() {
    if (sending || !queued.length) return;
    sending = true;
    renderQueue();
    const prompts = queued.slice();
    try {
      for (const prompt of prompts) {
        const documentSurface = surface();
        const response = await fetch(`/api/feedback/submit/${apiDocument}`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(feedbackPayload({ ...prompt, surface: documentSurface })),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const index = queued.indexOf(prompt);
        if (index >= 0) queued.splice(index, 1);
      }
      persistQueued();
      presence = 'working';
      await refreshSession();
    } catch (error) {
      banner.hidden = false;
      banner.textContent = `Could not send feedback: ${error.message}`;
    } finally { sending = false; renderQueue(); }
  }

  async function copyListener() {
    const command = `vyasa feedback poll ${JSON.stringify(location.href)}`;
    const button = sidebar.querySelector('[data-copy-listener]');
    try { await navigator.clipboard.writeText(command); button.textContent = 'Copied'; }
    catch (_) { banner.hidden = false; banner.textContent = command; }
    setTimeout(() => { button.textContent = 'Copy command to start agent'; }, 1500);
  }

  async function copyFeedbackPayload() {
    const payload = JSON.stringify(agentFeedbackPayload(), null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      copyPayloadButton.textContent = 'Copied feedback payload';
    } catch (_) {
      banner.hidden = false;
      banner.textContent = payload;
    }
    setTimeout(() => { copyPayloadButton.textContent = 'Copy feedback payload'; }, 1500);
  }

  function init() {
    const path = pathOf();
    if (!path) return;
    createUi();
    if (path !== documentPath) {
      documentPath = path;
      apiDocument = path.split('/').map(encodeURIComponent).join('/');
      queueKey = `vyasa-feedback:queued:${path}`;
      lastRefreshCursor = loadLastRefreshCursor();
      queued = loadQueued();
      knownEvents = '';
      renderQueue();
      refreshSession();
      if (captureLoaded) bindNestedHtmlFrame();
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window && event.source !== document.querySelector('#main-content iframe[src*=".html"]')?.contentWindow) return;
    const message = event.data || {};
    if (message.type === 'lavish:queuePrompt') enqueue(message.prompt);
    if (message.type === 'lavish:sendQueuedPrompts') requestSnapshotAndSend();
    if (message.type === 'lavish:snapshot') { snapshot = String(message.snapshot || ''); submitQueued(); }
  });
  window.addEventListener('keydown', (event) => {
    const open = document.body.classList.contains('vyasa-feedback-open');
    const editing = event.composedPath().some((node) => (
      node instanceof Element
      && (node.matches('input, textarea, select') || node.isContentEditable || node.closest('[data-lavish-ui] input, [data-lavish-ui] textarea, [data-lavish-ui] select'))
    ));
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeReview();
      return;
    }
    if (open && event.key.toLowerCase() === 'a' && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey && !editing) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleAnnotationMode();
      return;
    }
    if (open || event.key.toLowerCase() !== 'r' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (editing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openReview();
  }, true);
  document.addEventListener('DOMContentLoaded', init);
  document.body.addEventListener('htmx:afterSwap', init);
  setInterval(refreshSession, 2000);
})();
