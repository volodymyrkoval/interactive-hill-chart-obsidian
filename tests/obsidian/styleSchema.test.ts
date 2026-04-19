import { describe, it, expect } from 'vitest';

// NOTE: This module does not exist yet. These are RED-phase specification tests
// that will drive the implementation of src/obsidian/styleSchema.ts.
import {
  styleSchema,
  knownKeysFor,
  parseByKind,
  type StyleFieldDescriptor,
  type StyleGroup,
  type ResolvedChartStyle,
} from '../../src/obsidian/styleSchema';
import { resolveChartStyle } from '../../src/obsidian/resolvedStylesApplier';

/**
 * Contract under test:
 *
 *   export interface StyleFieldDescriptor {
 *     key: string;                     // YAML key (e.g. "stroke")
 *     target: string;                  // property on the style object
 *     group: StyleGroup;               // curve | baseline | divider | uphill | downhill | dot
 *     kind: StyleFieldKind;            // discriminated union carrying default + parse contract
 *     invalid?: InvalidReport;
 *   }
 *
 * Parsing is dispatched via `parseByKind(d.kind, raw)` — descriptors no longer
 * store a parse function. This eliminates the `as StyleFieldDescriptor<X, Y>`
 * casts that the prior generic shape required.
 */

type AnyDescriptor = StyleFieldDescriptor;
const parse = (d: AnyDescriptor, raw: unknown): unknown => parseByKind(d.kind, raw);

const GROUPS: readonly StyleGroup[] = [
  'curve',
  'baseline',
  'divider',
  'uphill',
  'downhill',
  'dot',
] as const;

function byGroup(group: StyleGroup): AnyDescriptor[] {
  return (styleSchema as AnyDescriptor[]).filter((d) => d.group === group);
}

describe('styleSchema — descriptor table', () => {
  describe('completeness', () => {
    it('exports a non-empty array', () => {
      expect(Array.isArray(styleSchema)).toBe(true);
      expect((styleSchema as unknown[]).length).toBeGreaterThan(0);
    });

    it('covers every known style group', () => {
      for (const g of GROUPS) {
        expect(byGroup(g).length, `group ${g} must have descriptors`).toBeGreaterThan(0);
      }
    });
  });

  describe('key uniqueness', () => {
    it('no two descriptors in the same group share the same key', () => {
      for (const g of GROUPS) {
        const keys = byGroup(g).map((d) => d.key);
        const unique = new Set(keys);
        expect(unique.size, `duplicate keys in group ${g}: ${keys.join(', ')}`).toBe(keys.length);
      }
    });
  });

  describe('descriptor shape', () => {
    it('every descriptor has key, target, kind, group; opt-in fields may omit default', () => {
      for (const d of styleSchema as AnyDescriptor[]) {
        expect(typeof d.key).toBe('string');
        expect(d.key.length).toBeGreaterThan(0);
        expect(typeof d.target).toBe('string');
        expect(typeof d.kind.kind).toBe('string');
        expect(GROUPS).toContain(d.group);
      }
    });

    it('target equals key for leaf style fields (identity mapping)', () => {
      // All current style fields use the same name in YAML as on the object.
      for (const d of styleSchema as AnyDescriptor[]) {
        expect(d.target).toBe(d.key);
      }
    });
  });

  describe('knownKeysFor', () => {
    it('returns the exact key set for each group', () => {
      expect(knownKeysFor('curve')).toEqual(new Set(['stroke', 'strokeWidth', 'fill']));
      expect(knownKeysFor('baseline')).toEqual(new Set(['visible', 'stroke', 'opacity', 'strokeWidth']));
      expect(knownKeysFor('divider')).toEqual(new Set(['visible', 'stroke', 'strokeWidth', 'style']));
      expect(knownKeysFor('uphill')).toEqual(new Set(['label', 'fontSize', 'color']));
      expect(knownKeysFor('downhill')).toEqual(new Set(['label', 'fontSize', 'color']));
      expect(knownKeysFor('dot')).toEqual(new Set(['color', 'opacity', 'radius', 'fontSize', 'fontColor']));
    });
  });

  describe('known-keys derivability', () => {
    function keysOf(group: StyleGroup): Set<string> {
      return new Set(byGroup(group).map((d) => d.key));
    }

    it('curve exposes stroke, strokeWidth, fill', () => {
      expect(keysOf('curve')).toEqual(new Set(['stroke', 'strokeWidth', 'fill']));
    });

    it('baseline exposes visible, stroke, opacity, strokeWidth', () => {
      expect(keysOf('baseline')).toEqual(
        new Set(['visible', 'stroke', 'opacity', 'strokeWidth']),
      );
    });

    it('divider exposes visible, stroke, strokeWidth, style', () => {
      expect(keysOf('divider')).toEqual(
        new Set(['visible', 'stroke', 'strokeWidth', 'style']),
      );
    });

    it('uphill exposes label, fontSize, color', () => {
      expect(keysOf('uphill')).toEqual(new Set(['label', 'fontSize', 'color']));
    });

    it('downhill exposes label, fontSize, color', () => {
      expect(keysOf('downhill')).toEqual(new Set(['label', 'fontSize', 'color']));
    });

    it('dot exposes color, opacity, radius, fontSize, fontColor', () => {
      expect(keysOf('dot')).toEqual(
        new Set(['color', 'opacity', 'radius', 'fontSize', 'fontColor']),
      );
    });
  });

  describe('default contract', () => {
    it('every defined default is of the correct primitive type for its parser', () => {
      // Round-trip: when a default is present it must be acceptable to parse().
      // Opt-in fields (e.g. dot.opacity) legitimately have no default.
      for (const d of styleSchema as AnyDescriptor[]) {
        if (d.kind.default === undefined) continue;
        const parsed = parse(d, d.kind.default);
        expect(
          parsed,
          `default for ${d.group}.${d.key} must round-trip through parse()`,
        ).not.toBeUndefined();
      }
    });
  });

  describe('parse contract — color fields', () => {
    const colorDescriptors: Array<[StyleGroup, string]> = [
      ['curve', 'stroke'],
      ['curve', 'fill'],
      ['baseline', 'stroke'],
      ['divider', 'stroke'],
      ['uphill', 'color'],
      ['downhill', 'color'],
      ['dot', 'color'],
      ['dot', 'fontColor'],
    ];

    it.each(colorDescriptors)('%s.%s parses valid CSS color and rejects garbage', (group, key) => {
      const d = byGroup(group).find((x) => x.key === key);
      expect(d, `${group}.${key} must exist in schema`).toBeDefined();
      expect(parse(d!,'#ff0000')).toBe('#ff0000');
      expect(parse(d!,'red')).toBe('red');
      expect(parse(d!,'not-a-color')).toBeUndefined();
      expect(parse(d!,42)).toBeUndefined();
      expect(parse(d!,null)).toBeUndefined();
      expect(parse(d!,undefined)).toBeUndefined();
    });
  });

  describe('parse contract — non-negative number fields', () => {
    const numberDescriptors: Array<[StyleGroup, string]> = [
      ['curve', 'strokeWidth'],
      ['baseline', 'strokeWidth'],
      ['divider', 'strokeWidth'],
      ['uphill', 'fontSize'],
      ['downhill', 'fontSize'],
      ['dot', 'radius'],
      ['dot', 'fontSize'],
    ];

    it.each(numberDescriptors)('%s.%s accepts non-negative finite numbers', (group, key) => {
      const d = byGroup(group).find((x) => x.key === key);
      expect(d, `${group}.${key} must exist in schema`).toBeDefined();
      expect(parse(d!,0)).toBe(0);
      expect(parse(d!,2.5)).toBe(2.5);
      expect(parse(d!,-1)).toBeUndefined();
      expect(parse(d!,Number.POSITIVE_INFINITY)).toBeUndefined();
      expect(parse(d!,Number.NaN)).toBeUndefined();
      expect(parse(d!,'2')).toBeUndefined();
      expect(parse(d!,null)).toBeUndefined();
    });
  });

  describe('parse contract — opacity fields', () => {
    const opacityDescriptors: Array<[StyleGroup, string]> = [
      ['baseline', 'opacity'],
      ['dot', 'opacity'],
    ];

    it.each(opacityDescriptors)('%s.%s accepts [0,1] only', (group, key) => {
      const d = byGroup(group).find((x) => x.key === key);
      expect(d, `${group}.${key} must exist in schema`).toBeDefined();
      expect(parse(d!,0)).toBe(0);
      expect(parse(d!,0.5)).toBe(0.5);
      expect(parse(d!,1)).toBe(1);
      expect(parse(d!,-0.01)).toBeUndefined();
      expect(parse(d!,1.01)).toBeUndefined();
      expect(parse(d!,'0.5')).toBeUndefined();
    });
  });

  describe('parse contract — boolean fields', () => {
    const booleanDescriptors: Array<[StyleGroup, string]> = [
      ['baseline', 'visible'],
      ['divider', 'visible'],
    ];

    it.each(booleanDescriptors)('%s.%s accepts booleans only', (group, key) => {
      const d = byGroup(group).find((x) => x.key === key);
      expect(d, `${group}.${key} must exist in schema`).toBeDefined();
      expect(parse(d!,true)).toBe(true);
      expect(parse(d!,false)).toBe(false);
      expect(parse(d!,'true')).toBeUndefined();
      expect(parse(d!,1)).toBeUndefined();
      expect(parse(d!,null)).toBeUndefined();
    });
  });

  describe('parse contract — divider.style enum', () => {
    it('accepts only line | dots | dashed', () => {
      const d = byGroup('divider').find((x) => x.key === 'style');
      expect(d).toBeDefined();
      expect(parse(d!,'line')).toBe('line');
      expect(parse(d!,'dots')).toBe('dots');
      expect(parse(d!,'dashed')).toBe('dashed');
      expect(parse(d!,'solid')).toBeUndefined();
      expect(parse(d!,'')).toBeUndefined();
      expect(parse(d!,null)).toBeUndefined();
    });
  });

  describe('parse contract — section label text', () => {
    it.each([['uphill'], ['downhill']] as Array<[StyleGroup]>)(
      '%s.label accepts any string, rejects non-strings',
      (group) => {
        const d = byGroup(group).find((x) => x.key === 'label');
        expect(d).toBeDefined();
        expect(parse(d!,'UPHILL')).toBe('UPHILL');
        expect(parse(d!,'')).toBe('');
        expect(parse(d!,42)).toBeUndefined();
        expect(parse(d!,null)).toBeUndefined();
      },
    );
  });

  describe('round-trip against current parser semantics', () => {
    // Given canonical YAML-like values, the descriptor-based parse must agree
    // with what parseYamlHillChart produces today for the same field.
    it('curve.strokeWidth=3 round-trips to 3', () => {
      const d = byGroup('curve').find((x) => x.key === 'strokeWidth')!;
      expect(parse(d,3)).toBe(3);
    });

    it('baseline.opacity=0.3 round-trips to 0.3', () => {
      const d = byGroup('baseline').find((x) => x.key === 'opacity')!;
      expect(parse(d,0.3)).toBe(0.3);
    });

    it('divider.style="dashed" round-trips to "dashed"', () => {
      const d = byGroup('divider').find((x) => x.key === 'style')!;
      expect(parse(d,'dashed')).toBe('dashed');
    });

    it('dot.color="#abc" round-trips to "#abc"', () => {
      const d = byGroup('dot').find((x) => x.key === 'color')!;
      expect(parse(d,'#abc')).toBe('#abc');
    });
  });
});

describe('resolveChartStyle', () => {
  describe('empty partial fills all defaults', () => {
    it('curve defaults: stroke=currentColor, strokeWidth=2, fill=none', () => {
      const resolved: ResolvedChartStyle = resolveChartStyle({});
      expect(resolved.curve.stroke).toBe('currentColor');
      expect(resolved.curve.strokeWidth).toBe(2);
      expect(resolved.curve.fill).toBe('none');
    });

    it('baseline defaults: visible=true, stroke=currentColor, opacity=0.3, strokeWidth=1', () => {
      const resolved = resolveChartStyle({});
      expect(resolved.baseline.visible).toBe(true);
      expect(resolved.baseline.stroke).toBe('currentColor');
      expect(resolved.baseline.opacity).toBe(0.3);
      expect(resolved.baseline.strokeWidth).toBe(1);
    });

    it('divider defaults: visible=undefined (opt-in), stroke=currentColor, strokeWidth=1, style=line', () => {
      const resolved = resolveChartStyle({});
      expect(resolved.divider.visible).toBeUndefined();
      expect(resolved.divider.stroke).toBe('currentColor');
      expect(resolved.divider.strokeWidth).toBe(1);
      expect(resolved.divider.style).toBe('line');
    });

    it('uphill defaults: label=undefined (opt-in), fontSize=12, color=currentColor', () => {
      const resolved = resolveChartStyle({});
      expect(resolved.uphill.label).toBeUndefined();
      expect(resolved.uphill.fontSize).toBe(12);
      expect(resolved.uphill.color).toBe('currentColor');
    });

    it('downhill defaults: label=undefined (opt-in), fontSize=12, color=currentColor', () => {
      const resolved = resolveChartStyle({});
      expect(resolved.downhill.label).toBeUndefined();
      expect(resolved.downhill.fontSize).toBe(12);
      expect(resolved.downhill.color).toBe('currentColor');
    });

    it('dot defaults: color=currentColor, opacity=undefined (opt-in), radius=6, fontSize=12, fontColor=currentColor', () => {
      const resolved = resolveChartStyle({});
      expect(resolved.dot.color).toBe('currentColor');
      expect(resolved.dot.opacity).toBeUndefined();
      expect(resolved.dot.radius).toBe(6);
      expect(resolved.dot.fontSize).toBe(12);
      expect(resolved.dot.fontColor).toBe('currentColor');
    });
  });

  describe('provided values are preserved', () => {
    it('keeps curve.stroke when provided', () => {
      const resolved = resolveChartStyle({ curve: { stroke: '#ff0000' } });
      expect(resolved.curve.stroke).toBe('#ff0000');
      expect(resolved.curve.strokeWidth).toBe(2);
      expect(resolved.curve.fill).toBe('none');
    });

    it('keeps baseline.opacity when provided', () => {
      const resolved = resolveChartStyle({ baseline: { opacity: 0.5 } });
      expect(resolved.baseline.opacity).toBe(0.5);
      expect(resolved.baseline.visible).toBe(true);
    });

    it('keeps divider.style when provided', () => {
      const resolved = resolveChartStyle({ divider: { style: 'dashed' } });
      expect(resolved.divider.style).toBe('dashed');
      expect(resolved.divider.strokeWidth).toBe(1);
    });

    it('keeps uphill.label when provided', () => {
      const resolved = resolveChartStyle({ uphill: { label: 'In Progress' } });
      expect(resolved.uphill.label).toBe('In Progress');
      expect(resolved.uphill.fontSize).toBe(12);
    });

    it('keeps dot.radius when provided', () => {
      const resolved = resolveChartStyle({ dot: { radius: 10 } });
      expect(resolved.dot.radius).toBe(10);
      expect(resolved.dot.color).toBe('currentColor');
    });

    it('keeps all fields when all are provided', () => {
      const resolved = resolveChartStyle({
        curve: { stroke: 'red', strokeWidth: 3, fill: 'blue' },
        dot: { color: '#abc', opacity: 0.5, radius: 8, fontSize: 14, fontColor: '#def' },
      });
      expect(resolved.curve.stroke).toBe('red');
      expect(resolved.curve.strokeWidth).toBe(3);
      expect(resolved.curve.fill).toBe('blue');
      expect(resolved.dot.color).toBe('#abc');
      expect(resolved.dot.opacity).toBe(0.5);
      expect(resolved.dot.radius).toBe(8);
      expect(resolved.dot.fontSize).toBe(14);
      expect(resolved.dot.fontColor).toBe('#def');
    });
  });

  describe('undefined partial is treated as empty', () => {
    it('resolves defaults when called with undefined', () => {
      const resolved = resolveChartStyle(undefined);
      expect(resolved.curve.stroke).toBe('currentColor');
      expect(resolved.dot.radius).toBe(6);
    });
  });

  describe('dot.opacity opt-in override', () => {
    it('resolveChartStyle({ dot: {} }).dot.opacity is undefined (opt-in field, not defaulted)', () => {
      // dot.opacity is opt-in: the resolver overrides to undefined when the caller
      // did not explicitly set it, regardless of any default in the schema descriptor.
      const resolved = resolveChartStyle({ dot: {} });
      expect(resolved.dot.opacity).toBeUndefined();
    });
  });
});
