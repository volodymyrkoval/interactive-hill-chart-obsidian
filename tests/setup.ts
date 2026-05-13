// Obsidian exposes activeDocument/activeWindow as ambient globals.
// In tests (happy-dom) we alias them to the jsdom document/window.
(globalThis as Record<string, unknown>).activeDocument = document;
(globalThis as Record<string, unknown>).activeWindow = window;

// Obsidian DOM helpers used in source code.
(globalThis as Record<string, unknown>).createEl = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts?: { cls?: string; text?: string },
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (opts?.cls) el.className = opts.cls;
  if (opts?.text) el.textContent = opts.text;
  return el;
};
(globalThis as Record<string, unknown>).createDiv = (opts?: { cls?: string; text?: string }): HTMLDivElement =>
  (globalThis as Record<string, unknown>).createEl('div', opts) as HTMLDivElement;
