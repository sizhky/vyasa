import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../vyasa/extensions_builtin/feedback/static/lavish-capture.js', import.meta.url), 'utf8');
const feedbackSource = fs.readFileSync(new URL('../vyasa/extensions_builtin/feedback/static/feedback.js', import.meta.url), 'utf8');

test('annotation capture leaves native interactive controls untouched', () => {
    assert.match(source, /if \(isInteractiveControl\(target\)\) return;/);
    assert.match(feedbackSource, /if \(isReviewUiEvent\(event\)\) return;/);
});
