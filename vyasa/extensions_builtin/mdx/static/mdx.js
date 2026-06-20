const CDN = {
  react: 'https://unpkg.com/react@18/umd/react.production.min.js',
  reactDom: 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  babel: 'https://unpkg.com/@babel/standalone/babel.min.js',
};

const loadedScripts = new Map();

function loadScript(src) {
  if (loadedScripts.has(src)) return loadedScripts.get(src);
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
  loadedScripts.set(src, promise);
  return promise;
}

async function ensureRuntime() {
  await loadScript(CDN.react);
  await loadScript(CDN.reactDom);
  await loadScript(CDN.babel);
  if (!window.React || !window.ReactDOM || !window.Babel) {
    throw new Error('MDX runtime missing React, ReactDOM, or Babel');
  }
}

function transform(source) {
  return window.Babel.transform(source, {
    presets: [['react', { runtime: 'classic' }]],
    plugins: ['transform-modules-commonjs'],
  }).code;
}

function localUrl(base, spec) {
  const normalizedBase = base && base !== '.' ? `/posts/${base.replace(/^\/+|\/+$/g, '')}/` : '/posts/';
  return new URL(spec, window.location.origin + normalizedBase).toString();
}

async function loadComponent(base, spec) {
  const url = localUrl(base, spec);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load ${spec}: ${response.status}`);
  const source = await response.text();
  if (/^\s*<!doctype html/i.test(source) || /^\s*<html[\s>]/i.test(source)) {
    throw new Error(`Cannot load ${spec}: server returned HTML for ${url}`);
  }
  const module = { exports: {} };
  const require = (name) => {
    if (name === 'react') return window.React;
    throw new Error(`Unsupported import ${name} in ${spec}`);
  };
  Function('React', 'require', 'exports', 'module', transform(source))(window.React, require, module.exports, module);
  return module.exports.default || module.exports;
}

function compileIsland(source, components) {
  const names = Object.keys(components);
  const module = { exports: {} };
  const wrapped = `module.exports = function VyasaMdxIsland(){ return (${source}); }`;
  Function('React', 'exports', 'module', ...names, transform(wrapped))(
    window.React,
    module.exports,
    module,
    ...names.map((name) => components[name]),
  );
  return module.exports;
}

function renderError(target, error) {
  target.innerHTML = '';
  const box = document.createElement('pre');
  box.className = 'vyasa-mdx-error my-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 overflow-auto';
  box.textContent = error?.stack || error?.message || String(error);
  target.appendChild(box);
}

async function hydratePayload(script) {
  if (script.dataset.vyasaMdxHydrated === 'true') return;
  script.dataset.vyasaMdxHydrated = 'true';
  const payload = JSON.parse(script.textContent || '{}');
  const root = script.closest('main, article, body') || document;
  const targets = Array.from(root.querySelectorAll('.vyasa-mdx-island[data-vyasa-mdx-island]'));
  if (!targets.length) return;
  await ensureRuntime();
  const components = { ...(window.VyasaMdxComponents || {}) };
  for (const [name, spec] of Object.entries(payload.imports || {})) {
    components[name] = await loadComponent(payload.base || '.', spec);
  }
  for (const target of targets) {
    try {
      const island = payload.islands[Number(target.dataset.vyasaMdxIsland)];
      const Component = compileIsland(island, components);
      const rootApi = window.ReactDOM.createRoot ? window.ReactDOM.createRoot(target) : null;
      if (rootApi) rootApi.render(window.React.createElement(Component));
      else window.ReactDOM.render(window.React.createElement(Component), target);
    } catch (error) {
      renderError(target, error);
    }
  }
}

async function hydrateMdx() {
  const payloads = Array.from(document.querySelectorAll('script.vyasa-mdx-payload[type="application/json"]'));
  for (const payload of payloads) {
    try {
      await hydratePayload(payload);
    } catch (error) {
      const target = payload.previousElementSibling?.querySelector?.('.vyasa-mdx-island') || document.body;
      renderError(target, error);
    }
  }
}

document.addEventListener('DOMContentLoaded', hydrateMdx);
document.addEventListener('htmx:afterSwap', hydrateMdx);
