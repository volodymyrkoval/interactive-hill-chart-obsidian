import type {
  HillChartItem,
  DotStyle,
} from '../model/hillChartConfig';
import type { HillChartParseError } from '../model/parseErrors';
import { HillPosition } from '../model/hillPosition';
import { emitUnknownKeyWarnings } from './styleFieldHelpers';
import { knownKeysFor } from './styleSchema';
import { applySchemaGroup } from './resolvedStylesApplier';
import { ParseContext, ParsePath } from './parseContext';

const MIN_POSITION = 0;
const MAX_POSITION = 100;

const KNOWN_DOT_STYLE_KEYS = knownKeysFor('dot');

export function parseDotStyle(
  raw: unknown,
  ctx: ParseContext,
  warnUnknownKeys = false,
): DotStyle | undefined {
  if (warnUnknownKeys) {
    emitUnknownKeyWarnings(raw, ctx, KNOWN_DOT_STYLE_KEYS);
  }
  return applySchemaGroup<DotStyle>(raw, 'dot', ctx);
}

function parseWikiLink(raw: string): { label: string; noteLink: string } | null {
  const match = raw.match(/^\[\[(.+)\]\]$/);
  if (!match) return null;
  return { label: match[1], noteLink: match[1] };
}

function applyLabelAndLink(item: HillChartItem, rawLabel: string): void {
  const wikiLink = parseWikiLink(rawLabel);
  if (wikiLink) {
    item.label = wikiLink.label;
    item.noteLink = wikiLink.noteLink;
  } else {
    item.label = rawLabel;
  }
}

function reportUnquotedWikiLink(errors: HillChartParseError[], index: number): void {
  errors.push({
    message:
      `Unquoted wiki-link detected at dots[${index}] (e.g. [[Note]]). ` +
      'Quote it in YAML: "[[Note]]". Item dropped.',
    severity: 'warning',
  });
}

function parseDotLabel(item: HillChartItem, obj: Record<string, unknown>): void {
  if ('label' in obj && typeof obj['label'] === 'string' && obj['label'] !== '') {
    applyLabelAndLink(item, obj['label']);
  }
}

function parseDotStyleField(
  item: HillChartItem,
  obj: Record<string, unknown>,
  dotCtx: ParseContext,
): void {
  if (!('style' in obj)) return;
  const styleCtx = dotCtx.childCtx('style');
  const rawStyle = obj['style'];
  const isInvalidMapping =
    rawStyle !== null && rawStyle !== undefined && (typeof rawStyle !== 'object' || Array.isArray(rawStyle));
  if (isInvalidMapping) {
    styleCtx.push({ message: `${styleCtx.path}: must be a mapping`, severity: 'warning' });
    return;
  }
  const style = parseDotStyle(rawStyle, styleCtx, true);
  if (style !== undefined) item.style = style;
}

function parseMappingFormDot(
  obj: Record<string, unknown>,
  dotCtx: ParseContext,
): HillChartItem | null {
  const raw = obj['position'] as number;
  if (!Number.isFinite(raw)) {
    dotCtx.push({
      message: `${dotCtx.path}.position: must be a finite number (got ${raw}). Item dropped.`,
      severity: 'warning',
    });
    return null;
  }
  if (raw < MIN_POSITION || raw > MAX_POSITION) {
    dotCtx.push({
      message: `${dotCtx.path}.position: must be between ${MIN_POSITION} and ${MAX_POSITION} (got ${raw}). Clamped to ${Math.min(MAX_POSITION, Math.max(MIN_POSITION, raw))}.`,
      severity: 'warning',
    });
  }
  const item: HillChartItem = { position: HillPosition.fromPercent(raw) };
  parseDotLabel(item, obj);
  parseDotStyleField(item, obj, dotCtx);
  return item;
}

function isValidShorthandPosition(raw: number): boolean {
  return Number.isFinite(raw) && raw >= MIN_POSITION && raw <= MAX_POSITION;
}

function buildShorthandItem(raw: number, val: unknown): HillChartItem {
  const item: HillChartItem = { position: HillPosition.fromPercent(raw) };
  if (typeof val === 'string' && val !== '') applyLabelAndLink(item, val);
  return item;
}

function parseShorthandFormDot(obj: Record<string, unknown>): HillChartItem | null {
  for (const [key, val] of Object.entries(obj)) {
    const raw = Number(key);
    if (!isValidShorthandPosition(raw)) continue;
    return buildShorthandItem(raw, val);
  }
  return null;
}

// Returns true when an unquoted wiki-link is present in the entry (top-level array
// or an array value on any non-style key). Reports the error as a side-effect.
function detectUnquotedWikiLinkInEntry(
  entry: unknown,
  errors: HillChartParseError[],
  index: number,
): boolean {
  if (Array.isArray(entry)) {
    reportUnquotedWikiLink(errors, index);
    return true;
  }
  if (!entry || typeof entry !== 'object') return false;
  const obj = entry as Record<string, unknown>;
  // YAML parses [[Note]] as an array; skip 'style' — handled separately
  for (const [key, val] of Object.entries(obj)) {
    if (key !== 'style' && Array.isArray(val)) {
      reportUnquotedWikiLink(errors, index);
      return true;
    }
  }
  return false;
}

// Dispatches an already-confirmed object entry to the appropriate dot parser.
function dispatchByEntryShape(
  obj: Record<string, unknown>,
  dotCtx: ParseContext,
): HillChartItem | null {
  if ('position' in obj && typeof obj['position'] === 'number') {
    return parseMappingFormDot(obj, dotCtx);
  }
  if ('position' in obj) {
    dotCtx.push({
      message: `${dotCtx.path}.position: must be a number (0–100). Item dropped.`,
      severity: 'warning',
    });
    return null;
  }
  const shorthand = parseShorthandFormDot(obj);
  if (shorthand === null) {
    dotCtx.push({
      message: `${dotCtx.path}: no valid position found. Use "- 50: Label" or "position: 50". Item dropped.`,
      severity: 'warning',
    });
  }
  return shorthand;
}

function parseDotEntry(
  entry: unknown,
  index: number,
  errors: HillChartParseError[],
): HillChartItem | null {
  if (entry === null || entry === undefined) return null;
  if (detectUnquotedWikiLinkInEntry(entry, errors, index)) return null;
  if (typeof entry !== 'object') return null;
  const dotCtx = new ParseContext(ParsePath.of('dots').index(index), errors);
  return dispatchByEntryShape(entry as Record<string, unknown>, dotCtx);
}

export function parseDots(parsed: unknown, errors: HillChartParseError[]): HillChartItem[] {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
  const rawDots = (parsed as Record<string, unknown>)['dots'];
  if (!Array.isArray(rawDots)) return [];
  const dots: HillChartItem[] = [];
  for (let i = 0; i < rawDots.length; i++) {
    const item = parseDotEntry(rawDots[i], i, errors);
    if (item !== null) dots.push(item);
  }
  return dots;
}
