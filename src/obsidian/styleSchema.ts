import { isValidCssColor, isNonNegativeFinite, isOpacity } from './validateStyleValue';

export type {
  ResolvedCurveStyle,
  ResolvedBaselineStyle,
  ResolvedDividerStyle,
  ResolvedSectionLabelStyle,
  ResolvedDotStyle,
  ResolvedChartStyle,
} from '../model/chartStyle';

export type StyleGroup =
  | 'curve'
  | 'baseline'
  | 'divider'
  | 'uphill'
  | 'downhill'
  | 'dot';

// How to report a value that was present but failed parsing.
//   { kind: 'color' } → "<ctx>.<key>: invalid CSS color "<raw>". Field ignored."
//   { kind: 'hint' }  → "<ctx>.<key>: invalid value (<hint>). Field ignored."
//   undefined         → silently ignore invalid values (no error emitted).
export type InvalidReport =
  | { kind: 'color' }
  | { kind: 'hint'; hint: string }
  | undefined;

// Discriminated union describing a descriptor's value contract.
// Each kind implies a parser (applied by the resolvedStylesApplier) and a default.
export type StyleFieldKind =
  | { kind: 'color'; default: string }
  | { kind: 'nonNegativeNumber'; default: number }
  | { kind: 'opacity'; default?: number }
  | { kind: 'boolean'; default: boolean }
  | { kind: 'string'; default: string }
  | { kind: 'dividerStyle'; default: 'line' | 'dots' | 'dashed' };

export interface StyleFieldDescriptor {
  key: string;
  target: string;
  group: StyleGroup;
  kind: StyleFieldKind;
  invalid?: InvalidReport;
}

// ───── primitive parsers (kind → parse fn) ─────

export const DIVIDER_STYLES: ReadonlyArray<'line' | 'dots' | 'dashed'> = ['line', 'dots', 'dashed'];

export function parseColor(raw: unknown): string | undefined {
  return typeof raw === 'string' && isValidCssColor(raw) ? raw : undefined;
}

export function parseNonNegativeNumber(raw: unknown): number | undefined {
  return typeof raw === 'number' && isNonNegativeFinite(raw) ? raw : undefined;
}

export function parseOpacityValue(raw: unknown): number | undefined {
  return typeof raw === 'number' && isOpacity(raw) ? raw : undefined;
}

export function parseBool(raw: unknown): boolean | undefined {
  return typeof raw === 'boolean' ? raw : undefined;
}

export function parseString(raw: unknown): string | undefined {
  return typeof raw === 'string' ? raw : undefined;
}

export function parseDividerStyleEnum(raw: unknown): 'line' | 'dots' | 'dashed' | undefined {
  if (typeof raw !== 'string') return undefined;
  const match = DIVIDER_STYLES.find((s) => s === raw);
  return match;
}

export function parseByKind(kind: StyleFieldKind, raw: unknown): unknown {
  switch (kind.kind) {
    case 'color': return parseColor(raw);
    case 'nonNegativeNumber': return parseNonNegativeNumber(raw);
    case 'opacity': return parseOpacityValue(raw);
    case 'boolean': return parseBool(raw);
    case 'string': return parseString(raw);
    case 'dividerStyle': return parseDividerStyleEnum(raw);
  }
}

// ───── invalid-report presets ─────

const INVALID_COLOR: InvalidReport = { kind: 'color' };
const INVALID_NON_NEGATIVE: InvalidReport = { kind: 'hint', hint: 'must be a non-negative number' };
const INVALID_OPACITY: InvalidReport = { kind: 'hint', hint: 'must be a number in [0, 1]' };
const INVALID_BOOLEAN: InvalidReport = { kind: 'hint', hint: 'must be boolean' };
const INVALID_DIVIDER_STYLE: InvalidReport = {
  kind: 'hint',
  hint: `must be one of: ${DIVIDER_STYLES.join(', ')}`,
};

// ───── schema data ─────

export const styleSchema: StyleFieldDescriptor[] = [
  { group: 'curve', key: 'stroke', target: 'stroke',
    kind: { kind: 'color', default: 'currentColor' }, invalid: INVALID_COLOR },
  { group: 'curve', key: 'strokeWidth', target: 'strokeWidth',
    kind: { kind: 'nonNegativeNumber', default: 2 }, invalid: INVALID_NON_NEGATIVE },
  { group: 'curve', key: 'fill', target: 'fill',
    kind: { kind: 'color', default: 'none' }, invalid: INVALID_COLOR },

  { group: 'baseline', key: 'visible', target: 'visible',
    kind: { kind: 'boolean', default: true }, invalid: INVALID_BOOLEAN },
  { group: 'baseline', key: 'stroke', target: 'stroke',
    kind: { kind: 'color', default: 'currentColor' }, invalid: INVALID_COLOR },
  { group: 'baseline', key: 'opacity', target: 'opacity',
    kind: { kind: 'opacity', default: 0.3 }, invalid: INVALID_OPACITY },
  { group: 'baseline', key: 'strokeWidth', target: 'strokeWidth',
    kind: { kind: 'nonNegativeNumber', default: 1 }, invalid: INVALID_NON_NEGATIVE },

  { group: 'divider', key: 'visible', target: 'visible',
    kind: { kind: 'boolean', default: true }, invalid: INVALID_BOOLEAN },
  { group: 'divider', key: 'stroke', target: 'stroke',
    kind: { kind: 'color', default: 'currentColor' }, invalid: INVALID_COLOR },
  { group: 'divider', key: 'strokeWidth', target: 'strokeWidth',
    kind: { kind: 'nonNegativeNumber', default: 1 }, invalid: INVALID_NON_NEGATIVE },
  { group: 'divider', key: 'style', target: 'style',
    kind: { kind: 'dividerStyle', default: 'line' }, invalid: INVALID_DIVIDER_STYLE },

  // uphill — label silently ignores non-string (invalid undefined)
  { group: 'uphill', key: 'label', target: 'label',
    kind: { kind: 'string', default: 'UPHILL' }, invalid: undefined },
  { group: 'uphill', key: 'fontSize', target: 'fontSize',
    kind: { kind: 'nonNegativeNumber', default: 12 }, invalid: INVALID_NON_NEGATIVE },
  { group: 'uphill', key: 'color', target: 'color',
    kind: { kind: 'color', default: 'currentColor' }, invalid: INVALID_COLOR },

  { group: 'downhill', key: 'label', target: 'label',
    kind: { kind: 'string', default: 'DOWNHILL' }, invalid: undefined },
  { group: 'downhill', key: 'fontSize', target: 'fontSize',
    kind: { kind: 'nonNegativeNumber', default: 12 }, invalid: INVALID_NON_NEGATIVE },
  { group: 'downhill', key: 'color', target: 'color',
    kind: { kind: 'color', default: 'currentColor' }, invalid: INVALID_COLOR },

  { group: 'dot', key: 'color', target: 'color',
    kind: { kind: 'color', default: 'currentColor' }, invalid: INVALID_COLOR },
  { group: 'dot', key: 'opacity', target: 'opacity',
    kind: { kind: 'opacity' }, invalid: INVALID_OPACITY },
  { group: 'dot', key: 'radius', target: 'radius',
    kind: { kind: 'nonNegativeNumber', default: 6 }, invalid: INVALID_NON_NEGATIVE },
  { group: 'dot', key: 'fontSize', target: 'fontSize',
    kind: { kind: 'nonNegativeNumber', default: 12 }, invalid: INVALID_NON_NEGATIVE },
  { group: 'dot', key: 'fontColor', target: 'fontColor',
    kind: { kind: 'color', default: 'currentColor' }, invalid: INVALID_COLOR },
];

export function knownKeysFor(group: StyleGroup): Set<string> {
  return new Set(styleSchema.filter((d) => d.group === group).map((d) => d.key));
}
