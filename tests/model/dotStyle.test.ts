import { describe, it, expect } from 'vitest';
import { resolveDotStyle } from '../../src/ui/dotStyle';

describe('resolveDotStyle — field-by-field merge', () => {
  it('per-dot wins over global when both are defined on all 5 fields', () => {
    const global = { color: '#000', opacity: 0.5, radius: 6, fontSize: 12, fontColor: '#111' };
    const perDot = { color: '#f00', opacity: 1, radius: 10, fontSize: 18, fontColor: '#fff' };
    const result = resolveDotStyle(global, perDot);
    expect(result.color).toBe('#f00');
    expect(result.opacity).toBe(1);
    expect(result.radius).toBe(10);
    expect(result.fontSize).toBe(18);
    expect(result.fontColor).toBe('#fff');
  });

  it('global fallback is used when per-dot field is absent', () => {
    const global = { color: '#000', radius: 6 };
    const perDot = { color: '#f00' };
    const result = resolveDotStyle(global, perDot);
    expect(result.color).toBe('#f00');
    expect(result.radius).toBe(6);
  });

  it('returns undefined for each field when both global and per-dot are undefined', () => {
    const result = resolveDotStyle(undefined, undefined);
    expect(result.color).toBeUndefined();
    expect(result.opacity).toBeUndefined();
    expect(result.radius).toBeUndefined();
    expect(result.fontSize).toBeUndefined();
    expect(result.fontColor).toBeUndefined();
  });
});
