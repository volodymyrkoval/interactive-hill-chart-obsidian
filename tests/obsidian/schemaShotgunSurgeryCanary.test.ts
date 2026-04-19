import { describe, it, expect, afterEach } from 'vitest';

/**
 * T5.5 canary — Shotgun Surgery regression guard.
 *
 * The claim under test: adding a new field to the style parsing pipeline
 * requires touching exactly ONE place (styleSchema). Before the schema-driven
 * applier refactor, a new field had to be wired through:
 *   1. styleSchema (descriptor + default)
 *   2. parseYamlHillChart (a new applier callback)
 *   3. styleFieldHelpers (per-type helper re-use)
 *   4. knownKeysFor consumers (implicit; now derived)
 *
 * After the refactor, step 1 is sufficient. This test proves it by mutating
 * `styleSchema` at runtime with a test-only descriptor and asserting the
 * pipeline picks it up end to end with NO other file changed.
 */

import { styleSchema } from '../../src/obsidian/styleSchema';
import { resolveChartStyle } from '../../src/obsidian/resolvedStylesApplier';
import { parseYamlHillChart } from '../../src/obsidian/parseYamlHillChart';

const CANARY_KEY = 'canaryFontWeight';
const CANARY_DEFAULT = 400;

describe('styleSchema — Shotgun Surgery canary (T5.5)', () => {
  afterEach(() => {
    // Strip the test-only descriptor so other tests see the pristine schema.
    const idx = (styleSchema as Array<{ key: string }>).findIndex((d) => d.key === CANARY_KEY);
    if (idx >= 0) (styleSchema as unknown[]).splice(idx, 1);
  });

  it('registering a descriptor on styleSchema alone flows through resolve + parse without editing other files', () => {
    // Precondition: the key is NOT yet in the schema.
    expect(styleSchema.some((d) => d.key === CANARY_KEY)).toBe(false);

    // Add a test-only descriptor. This is the ONLY mutation we perform.
    (styleSchema as unknown as Array<Record<string, unknown>>).push({
      group: 'dot',
      key: CANARY_KEY,
      target: CANARY_KEY,
      kind: { kind: 'nonNegativeNumber', default: CANARY_DEFAULT },
      invalid: { kind: 'hint', hint: 'must be a non-negative number' },
    });

    // 1. resolveChartStyle picks up the new default without code changes.
    const resolved = resolveChartStyle(undefined) as unknown as Record<string, Record<string, unknown>>;
    expect(resolved.dot[CANARY_KEY]).toBe(CANARY_DEFAULT);

    // 2. Parsing YAML that uses the new key does NOT produce an "unknown key"
    //    warning — knownKeysFor is derived from the schema.
    const source = `
chart:
  dot:
    ${CANARY_KEY}: 700
dots: []
`.trim();
    const result = parseYamlHillChart(source);
    const unknownKeyWarn = result.errors.find((e) =>
      e.message.includes(`unknown key "${CANARY_KEY}"`),
    );
    expect(unknownKeyWarn, 'unexpected unknown-key warning emitted').toBeUndefined();

    // 3. The parsed value appears on the chart config object.
    const parsedDot = result.chart?.dot as Record<string, unknown> | undefined;
    expect(parsedDot?.[CANARY_KEY]).toBe(700);
  });

  it('invalid value against the new descriptor emits a hint-shaped warning with no code change elsewhere', () => {
    (styleSchema as unknown as Array<Record<string, unknown>>).push({
      group: 'dot',
      key: CANARY_KEY,
      target: CANARY_KEY,
      kind: { kind: 'nonNegativeNumber', default: CANARY_DEFAULT },
      invalid: { kind: 'hint', hint: 'must be a non-negative number' },
    });

    const source = `
chart:
  dot:
    ${CANARY_KEY}: -5
dots: []
`.trim();
    const result = parseYamlHillChart(source);

    // Field dropped…
    const parsedDot = result.chart?.dot as Record<string, unknown> | undefined;
    expect(parsedDot?.[CANARY_KEY]).toBeUndefined();
    // …and a warning was emitted via the schema's invalid contract.
    expect(
      result.errors.some(
        (e) =>
          e.severity === 'warning' &&
          e.message.includes(`dot.${CANARY_KEY}`) &&
          e.message.includes('must be a non-negative number'),
      ),
    ).toBe(true);
  });
});
