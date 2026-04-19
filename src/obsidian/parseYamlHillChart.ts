import * as yaml from 'js-yaml';
import type { HillChartConfig, ChartStyle } from '../model/hillChartConfig';
import type { HillChartParseError } from '../model/parseErrors';
import { emitUnknownKeyWarnings } from './styleFieldHelpers';
import { knownKeysFor, type StyleGroup } from './styleSchema';
import { applySchemaGroup } from './resolvedStylesApplier';
import { parseDots } from './parseDot';
import { ParseContext, ParsePath } from './parseContext';

const TAB_WIDTH = 4;

const KNOWN_TOP_LEVEL_KEYS = new Set(['chart', 'dots']);

const CHART_STYLE_GROUPS: StyleGroup[] = ['curve', 'baseline', 'divider', 'uphill', 'downhill', 'dot'];

function parseChartStyle(raw: unknown, errors: HillChartParseError[]): ChartStyle | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const style: ChartStyle = {};
  for (const group of CHART_STYLE_GROUPS) {
    const groupCtx = new ParseContext(ParsePath.of(group), errors);
    emitUnknownKeyWarnings(obj[group], groupCtx, knownKeysFor(group));
    const parsed = applySchemaGroup(obj[group], group, groupCtx);
    if (parsed !== undefined) (style as Record<string, unknown>)[group] = parsed;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

function normalizeIndentation(source: string): string {
  return source.replace(/^[ \t]+/gm, (leading) => {
    let col = 0;
    for (const ch of leading) {
      if (ch === '\t') {
        col = Math.ceil((col + 1) / TAB_WIDTH) * TAB_WIDTH;
      } else {
        col += 1;
      }
    }
    return ' '.repeat(col);
  });
}

function loadYaml(source: string, errors: HillChartParseError[]): unknown {
  try {
    return yaml.load(normalizeIndentation(source));
  } catch (err) {
    errors.push({
      message: err instanceof Error ? err.message : String(err),
      severity: 'error',
    });
    return undefined;
  }
}

function warnUnknownTopLevel(parsed: unknown, errors: HillChartParseError[]): void {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
  for (const key of Object.keys(parsed as Record<string, unknown>)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
      errors.push({
        message: `Unknown top-level key: "${key}". Known keys are: chart, dots.`,
        severity: 'warning',
      });
    }
  }
}

export function parseYamlHillChart(source: string): HillChartConfig {
  if (source.trim() === '') return { dots: [], errors: [] };

  const errors: HillChartParseError[] = [];
  const parsed = loadYaml(source, errors);

  if (errors.length > 0) return { dots: [], errors };
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { dots: [], errors: [] };

  warnUnknownTopLevel(parsed, errors);
  const chart = parseChartStyle((parsed as Record<string, unknown>)['chart'], errors);
  const dots = parseDots(parsed, errors);

  const config: HillChartConfig = { dots, errors };
  if (chart) config.chart = chart;
  return config;
}
