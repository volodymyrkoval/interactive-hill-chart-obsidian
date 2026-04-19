import type {
  ChartStyle,
  SectionLabelStyle,
  DividerStyle,
  DotStyle,
} from './hillChartConfig';

export interface ResolvedCurveStyle {
  stroke: string;
  strokeWidth: number;
  fill: string;
}

export interface ResolvedBaselineStyle {
  visible: boolean;
  stroke: string;
  opacity: number;
  strokeWidth: number;
}

export interface ResolvedDividerStyle {
  visible?: boolean;  // undefined means "do not render divider" (opt-in)
  stroke: string;
  strokeWidth: number;
  style: 'line' | 'dots' | 'dashed';
}

export interface ResolvedSectionLabelStyle {
  label?: string;  // undefined means "do not render section label"
  fontSize: number;
  color: string;
}

export interface ResolvedDotStyle {
  color: string;
  opacity?: number;  // undefined means "do not set fill-opacity" (opt-in)
  radius: number;
  fontSize: number;
  fontColor: string;
}

export interface ResolvedChartStyle {
  curve: ResolvedCurveStyle;
  baseline: ResolvedBaselineStyle;
  divider: ResolvedDividerStyle;
  uphill: ResolvedSectionLabelStyle;
  downhill: ResolvedSectionLabelStyle;
  dot: ResolvedDotStyle;
}

// Minimal shape needed from a schema descriptor to resolve defaults.
// Used by obsidian/styleSchema to inject the runtime schema so that
// schema mutations (e.g. in the Shotgun Surgery canary test) are reflected.
export interface ResolvableDescriptor {
  key: string;
  default: unknown;
}

export interface ChartStyleSchema {
  curveDescriptors: ResolvableDescriptor[];
  baselineDescriptors: ResolvableDescriptor[];
  dividerDescriptors: ResolvableDescriptor[];
  uphillDescriptors: ResolvableDescriptor[];
  downhillDescriptors: ResolvableDescriptor[];
  dotDescriptors: ResolvableDescriptor[];
}

function resolveGroupWith<T extends object>(
  descriptors: ResolvableDescriptor[],
  partial: Partial<T> | undefined,
): T {
  const result: Record<string, unknown> = {};
  for (const d of descriptors) {
    const value = (partial as Record<string, unknown> | undefined)?.[d.key];
    result[d.key] = value !== undefined ? value : d.default;
  }
  return result as T;
}

function resolveSectionLabelWith(
  descriptors: ResolvableDescriptor[],
  partial: SectionLabelStyle | undefined,
): ResolvedSectionLabelStyle {
  const resolved = resolveGroupWith<ResolvedSectionLabelStyle>(descriptors, partial);
  if (partial?.label === undefined) {
    return { ...resolved, label: undefined };
  }
  return resolved;
}

function resolveDividerWith(
  descriptors: ResolvableDescriptor[],
  partial: DividerStyle | undefined,
): ResolvedDividerStyle {
  const resolved = resolveGroupWith<ResolvedDividerStyle>(descriptors, partial);
  if (partial?.visible === undefined) {
    return { ...resolved, visible: undefined };
  }
  return resolved;
}

function resolveDotWith(
  descriptors: ResolvableDescriptor[],
  partial: DotStyle | undefined,
): ResolvedDotStyle {
  const resolved = resolveGroupWith<ResolvedDotStyle>(descriptors, partial);
  if (partial?.opacity === undefined) {
    return { ...resolved, opacity: undefined };
  }
  return resolved;
}

// Schema-driven resolver used by obsidian/styleSchema to keep the runtime
// styleSchema as the single source of truth for defaults and field discovery.
export function resolveChartStyleWith(
  schema: ChartStyleSchema,
  partial: ChartStyle | undefined,
): ResolvedChartStyle {
  const p = partial ?? {};
  return {
    curve: resolveGroupWith<ResolvedCurveStyle>(schema.curveDescriptors, p.curve),
    baseline: resolveGroupWith<ResolvedBaselineStyle>(schema.baselineDescriptors, p.baseline),
    divider: resolveDividerWith(schema.dividerDescriptors, p.divider),
    uphill: resolveSectionLabelWith(schema.uphillDescriptors, p.uphill),
    downhill: resolveSectionLabelWith(schema.downhillDescriptors, p.downhill),
    dot: resolveDotWith(schema.dotDescriptors, p.dot),
  };
}
