import { describe, it, expect } from 'vitest';
import { inwardNormal } from '../../src/ui/labelPlacement';

describe('inwardNormal', () => {
  it('returns (0, -1) for horizontal tangent at angleRad = 0', () => {
    const result = inwardNormal(0);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(-1);
  });

  it('has negative y component for 45° rising tangent', () => {
    const result = inwardNormal(Math.PI / 4);
    expect(result.y).toBeLessThan(0);
  });

  it('has negative y component for 45° descending tangent', () => {
    const result = inwardNormal(-Math.PI / 4);
    expect(result.y).toBeLessThan(0);
  });

  it('returns vector with negative y for vertical tangent (π/2)', () => {
    const result = inwardNormal(Math.PI / 2);
    expect(result.y).toBeLessThanOrEqual(0);
  });

  it('always returns a unit vector', () => {
    const angles = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI, -Math.PI];
    for (const angle of angles) {
      const result = inwardNormal(angle);
      const magnitude = Math.sqrt(result.x * result.x + result.y * result.y);
      expect(magnitude).toBeCloseTo(1, 5);
    }
  });
});
