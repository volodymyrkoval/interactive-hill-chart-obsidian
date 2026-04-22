import type { ParseContext } from './parseContext';

export function emitUnknownKeyWarnings(
  raw: unknown,
  ctx: ParseContext,
  knownKeys: Set<string>,
): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
  for (const key of Object.keys(raw)) {
    if (!knownKeys.has(key)) {
      ctx.push({ message: `${ctx.path}: unknown key "${key}"`, severity: 'warning' });
    }
  }
}
