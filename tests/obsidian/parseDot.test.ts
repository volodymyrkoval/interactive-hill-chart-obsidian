/**
 * Unit tests for parseDots / parseMappingFormDot edge cases.
 *
 * Scenario: js-yaml can produce NaN / Infinity / -Infinity for .nan / .inf / -.inf.
 * These values pass `typeof x === 'number'` but are not valid finite positions.
 * The parser must reject them with a warning instead of crashing.
 */

import { describe, it, expect } from 'vitest';
import type { HillChartParseError } from '../../src/model/parseErrors';
import { parseDots } from '../../src/obsidian/parseDot';

function collectErrors(): HillChartParseError[] {
  return [];
}

function parsedWith(position: number): unknown {
  return { dots: [{ position }] };
}

describe('parseDots — mapping-form dot with non-finite position', () => {
  it('NaN position returns no dot and pushes a warning', () => {
    const errors = collectErrors();
    const dots = parseDots(parsedWith(NaN), errors);
    expect(dots).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe('warning');
    expect(errors[0].message).toMatch(/NaN|not finite|finite/i);
  });

  it('Infinity position returns no dot and pushes a warning', () => {
    const errors = collectErrors();
    const dots = parseDots(parsedWith(Infinity), errors);
    expect(dots).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe('warning');
  });

  it('-Infinity position returns no dot and pushes a warning', () => {
    const errors = collectErrors();
    const dots = parseDots(parsedWith(-Infinity), errors);
    expect(dots).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe('warning');
  });

  it('valid finite position still parses correctly', () => {
    const errors = collectErrors();
    const dots = parseDots(parsedWith(50), errors);
    expect(dots).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });
});
