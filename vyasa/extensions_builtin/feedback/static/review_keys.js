export function reviewKeyAction({ key, open, editing, bodyFocused = false, repeat = false, metaKey = false, ctrlKey = false, altKey = false }) {
  if (repeat || metaKey || ctrlKey || altKey) return null;
  if (!open) return !editing && key.toLowerCase() === 'r' ? 'open' : null;
  if (key === 'Escape') return editing ? 'blur' : 'close';
  if (editing) return null;
  if (key.toLowerCase() === 'a') return 'toggle-annotation';
  if (key === 'Enter' && bodyFocused) return 'focus-chat';
  return null;
}
