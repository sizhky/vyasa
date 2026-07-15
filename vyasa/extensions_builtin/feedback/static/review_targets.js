function parsed(value) {
    try { return JSON.parse(value || ''); }
    catch (_) { return null; }
}

export function reviewTargets(element) {
    const direct = element.closest?.('[data-vyasa-review-target]');
    const directTarget = parsed(direct?.dataset.vyasaReviewTarget);
    if (directTarget?.id) return [directTarget];
    const pointer = element.closest?.('[data-vyasa-review-pointer-target]');
    const pointerTarget = parsed(pointer?.dataset.vyasaReviewPointerTarget);
    if (pointerTarget?.id) return [pointerTarget];
    const carrier = element.closest?.('[data-vyasa-review-targets]');
    const targets = parsed(carrier?.dataset.vyasaReviewTargets);
    return Array.isArray(targets) ? targets.filter((item) => item?.id) : [];
}

export function reviewTargetElement(element) {
    return element.closest?.('[data-vyasa-review-target], [data-vyasa-review-surface]') || element;
}
