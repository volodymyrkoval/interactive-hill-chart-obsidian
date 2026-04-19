import { describe, it, expect } from 'vitest';
import { tangentAngle } from '../../src/ui/labelPlacement';
import { HillCurve } from '../../src/model/hillCurve';
import type { Size } from '../../src/types';

describe('tangentAngle', () => {
  const curve = new HillCurve();
  const size: Size = { width: 400, height: 150 };

  it('at t=0.5 (peak) returns angle near 0 (nearly horizontal)', () => {
    const angle = tangentAngle(curve, 0.5, size);

    expect(angle).toBeDefined();
    expect(typeof angle).toBe('number');
    expect(Number.isFinite(angle)).toBe(true);
    expect(Math.abs(angle)).toBeLessThan(0.1);
  });

  it('at t=0.25 (uphill) returns negative angle (rising left-to-right, y decreases in SVG)', () => {
    const angle = tangentAngle(curve, 0.25, size);

    expect(Number.isFinite(angle)).toBe(true);
    expect(angle).toBeLessThan(0);
    expect(angle).toBeGreaterThan(-Math.PI / 2);
  });

  it('at t=0.75 (downhill) returns positive angle (falling left-to-right, y increases in SVG)', () => {
    const angle = tangentAngle(curve, 0.75, size);

    expect(Number.isFinite(angle)).toBe(true);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(Math.PI / 2);
  });

  it('at t=0 (left endpoint) returns a finite angle', () => {
    const angle = tangentAngle(curve, 0, size);

    expect(Number.isFinite(angle)).toBe(true);
  });

  it('at t=1 (right endpoint) returns a finite angle', () => {
    const angle = tangentAngle(curve, 1, size);

    expect(Number.isFinite(angle)).toBe(true);
  });

  it('peak is flatter than uphill side (smaller absolute angle at t=0.5 than t=0.25)', () => {
    const anglePeak = tangentAngle(curve, 0.5, size);
    const angleUphill = tangentAngle(curve, 0.25, size);

    expect(Math.abs(anglePeak)).toBeLessThan(Math.abs(angleUphill));
  });
});
