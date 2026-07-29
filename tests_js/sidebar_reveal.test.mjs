import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../vyasa/static/scripts.js', import.meta.url), 'utf8');
const start = source.indexOf('function normalizeSidebarPath');
const end = source.indexOf('function postsHoverExpandAvailable');
const revealSource = source.slice(start, end);

test('locate current file refreshes a stale sidebar tree before scrolling', async () => {
    let hydrated = false;
    let requestUrl = '';
    let scrollTop = null;
    const postsSection = {
        open: true,
        matches: () => true,
        parentElement: { closest: () => null },
        querySelectorAll: () => hydrated ? [activeLink] : [],
    };
    const activeLink = {
        dataset: { path: 'guides/current' },
        closest: () => postsSection,
        getBoundingClientRect: () => ({ top: 80, height: 20 }),
    };
    const currentList = { replaceWith: () => { hydrated = true; } };
    const scrollContainer = {
        scrollTop: 0,
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
        scrollTo: ({ top }) => { scrollTop = top; },
    };
    const sidebar = {
        open: false,
        contains: () => true,
        querySelector: (selector) => {
            if (selector === 'details[data-section="posts-tree"]') return postsSection;
            if (selector === '#vyasa-posts-section-list') return currentList;
            if (selector === '#sidebar-scroll-container') return scrollContainer;
            return null;
        },
        querySelectorAll: () => [],
    };
    const nextList = {};
    const wrapper = { querySelector: () => nextList, set innerHTML(_) {} };
    const document = {
        querySelector: () => sidebar,
        createElement: () => wrapper,
    };
    const context = {
        document,
        fetch: async (url) => {
            requestUrl = url;
            return { ok: true, text: async () => '<aside />' };
        },
        initFolderChevronState: () => {},
        initFolderHoverExpand: () => {},
        syncPostsHoverToggleButtons: () => {},
        window: { location: { pathname: '/posts/guides/current' } },
    };
    vm.runInNewContext(revealSource, context);

    await context.window.focusCurrentPostInSidebar({ closest: () => sidebar });

    assert.equal(requestUrl, '/_sidebar/posts?current_path=guides%2Fcurrent');
    assert.equal(hydrated, true);
    assert.equal(scrollTop, 40);
});

test('an older sidebar response cannot replace a newer path', async () => {
    const pending = new Map();
    const replacements = [];
    const currentList = {
        replaceWith: (nextList) => replacements.push(nextList.path),
    };
    const root = {
        querySelector: (selector) => selector === '#vyasa-posts-section-list' ? currentList : null,
    };
    const document = {
        createElement: () => {
            let html = '';
            return {
                set innerHTML(value) { html = value; },
                querySelector: () => ({ path: html }),
            };
        },
    };
    const context = {
        document,
        fetch: (url) => new Promise((resolve) => pending.set(url, resolve)),
        initFolderChevronState: () => {},
        initFolderHoverExpand: () => {},
        syncPostsHoverToggleButtons: () => {},
        window: {},
    };
    vm.runInNewContext(revealSource, context);
    const older = context.window.__vyasaRefreshPostsTreeForPath('older', root);
    const newer = context.window.__vyasaRefreshPostsTreeForPath('newer', root);
    pending.get('/_sidebar/posts?current_path=newer')({
        ok: true,
        text: async () => 'newer',
    });
    await newer;
    pending.get('/_sidebar/posts?current_path=older')({
        ok: true,
        text: async () => 'older',
    });
    await older;

    assert.deepEqual(replacements, ['newer']);
});
