import type { ChartStyle } from '../model/hillChartConfig';
import {
  resolveChartStyleWith,
  type ResolvedChartStyle,
  type ResolvableDescriptor,
} from '../model/chartStyle';
import {
  styleSchema,
  parseByKind,
  type StyleFieldDescriptor,
  type StyleGroup,
  type InvalidReport,
} from './styleSchema';
import type { ParseContext } from './parseContext';

function reportInvalid(
  invalid: InvalidReport,
  ctx: ParseContext,
  key: string,
  rawValue: unknown,
): void {
  if (!invalid) return;
  // Color fields silently ignore non-string values (only a string that fails
  // CSS-color validation produces a warning). Preserves legacy behavior.
  if (invalid.kind === 'color' && typeof rawValue !== 'string') return;
  const message =
    invalid.kind === 'color'
      ? `${ctx.path}.${key}: invalid CSS color "${String(rawValue)}". Field ignored.`
      : `${ctx.path}.${key}: invalid value (${invalid.hint}). Field ignored.`;
  ctx.push({ message, severity: 'warning' });
}

// Schema-driven field applier. For each descriptor in the given group, if the key
// is present on `raw`, parse it via the descriptor's kind: on success assign to
// the partial; on failure emit an error per the descriptor's `invalid` contract.
// Returns undefined when `raw` is not a mapping or no fields were assigned.
export function applySchemaGroup<T extends object>(
  raw: unknown,
  group: StyleGroup,
  ctx: ParseContext,
): T | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const style: Record<string, unknown> = {};
  const descriptors = styleSchema.filter((d) => d.group === group);
  for (const d of descriptors) {
    if (!(d.key in obj)) continue;
    const rawValue = obj[d.key];
    const parsed = parseByKind(d.kind, rawValue);
    if (parsed !== undefined) {
      style[d.target] = parsed;
    } else {
      reportInvalid(d.invalid, ctx, d.key, rawValue);
    }
  }
  return Object.keys(style).length > 0 ? (style as T) : undefined;
}

function toResolvableDescriptors(descriptors: StyleFieldDescriptor[]): ResolvableDescriptor[] {
  return descriptors.map((d) => ({ key: d.key, default: d.kind.default }));
}

function buildChartStyleSchema() {
  const byGroup = (g: StyleGroup) =>
    toResolvableDescriptors(styleSchema.filter((d) => d.group === g));
  return {
    curveDescriptors: byGroup('curve'),
    baselineDescriptors: byGroup('baseline'),
    dividerDescriptors: byGroup('divider'),
    uphillDescriptors: byGroup('uphill'),
    downhillDescriptors: byGroup('downhill'),
    dotDescriptors: byGroup('dot'),
  };
}

// Bound wrapper: slices styleSchema at call time so runtime mutations
// (e.g. in tests) are reflected without re-importing this module.
export function resolveChartStyle(partial: ChartStyle | undefined): ResolvedChartStyle {
  return resolveChartStyleWith(buildChartStyleSchema(), partial);
}
