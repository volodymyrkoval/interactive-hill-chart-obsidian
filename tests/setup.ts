// Obsidian exposes activeDocument/activeWindow as ambient globals.
// In tests (happy-dom) we alias them to the jsdom document/window.
(globalThis as Record<string, unknown>).activeDocument = document;
(globalThis as Record<string, unknown>).activeWindow = window;
