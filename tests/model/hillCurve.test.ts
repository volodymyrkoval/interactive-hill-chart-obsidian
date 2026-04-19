import { describe, it, expect } from 'vitest';
import { HillCurve } from '../../src/model/hillCurve';

describe('HillCurve', () => {
  describe('pointAt', () => {
    it('pointAt(0) returns { x: 0, y: 0 } (left baseline)', () => {
      const curve = new HillCurve();
      const point = curve.pointAt(0);
      expect(point.x).toBeCloseTo(0);
      expect(point.y).toBeCloseTo(0);
    });

    it('pointAt(1) returns { x: 1, y: 0 } (right baseline)', () => {
      const curve = new HillCurve();
      const point = curve.pointAt(1);
      expect(point.x).toBeCloseTo(1);
      expect(point.y).toBeCloseTo(0);
    });

    it('pointAt(0.5) returns { x: 0.5, y: 0.8 } (bell peak)', () => {
      const curve = new HillCurve();
      const point = curve.pointAt(0.5);
      // Two-segment composite Bézier design:
      // Left half:  P0=(0,0), P1=(0.15,0), P2=(0.25,0.8), P3=(0.5,0.8)
      // Right half: P0=(0.5,0.8), P1=(0.75,0.8), P2=(0.85,0), P3=(1,0)
      // At t=0.5 (junction between segments): point is exactly P3 of left = (0.5, 0.8)
      expect(point.x).toBeCloseTo(0.5);
      expect(point.y).toBeCloseTo(0.8);
    });

    it('pointAt(0.5).x equals 0.5 by symmetry', () => {
      const curve = new HillCurve();
      const point = curve.pointAt(0.5);
      expect(point.x).toBeCloseTo(0.5);
    });
  });

  describe('toSvgPoint', () => {
    it('toSvgPoint(0, 400×200) matches the start point of toSvgPath', () => {
      const curve = new HillCurve();
      const size = { width: 400, height: 200 };
      const point = curve.toSvgPoint(0, size);

      const pathD = curve.toSvgPath(size);
      // Extract first M x y from "M x y C ..."
      const match = pathD.match(/^M\s+([\d.]+)\s+([\d.]+)/);
      expect(match).not.toBeNull();
      if (match) {
        const [, x, y] = match;
        expect(point.x).toBeCloseTo(Number(x));
        expect(point.y).toBeCloseTo(Number(y));
      }
    });

    it('toSvgPoint(0.5, 400×200).x equals 200 (centred)', () => {
      const curve = new HillCurve();
      const size = { width: 400, height: 200 };
      const point = curve.toSvgPoint(0.5, size);
      expect(point.x).toBeCloseTo(200);
    });
  });

  describe('projectToCurve', () => {
    it('projectToCurve({ x: 0.5, y: 0.8 }) returns ~0.5 (smoke test)', () => {
      const curve = new HillCurve();
      // Point (0.5, 0.8) is the peak of the two-segment curve (P3 of left = P0 of right).
      // Smoke test verifies projection works; full accuracy tested with drag slice.
      const t = curve.projectToCurve({ x: 0.5, y: 0.8 });
      expect(Math.abs(t - 0.5)).toBeLessThan(0.15); // Smoke threshold
    });
  });

  describe('tFromSvgX', () => {
    const tValues = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
    const size = { width: 400, height: 200 };

    tValues.forEach((t) => {
      it(`round-trips toSvgPoint(${t}) → tFromSvgX within ±0.001`, () => {
        const curve = new HillCurve();
        const svgPt = curve.toSvgPoint(t, size);
        const result = curve.tFromSvgX(svgPt.x, size);
        expect(Math.abs(result - t)).toBeLessThan(0.001);
      });
    });

    it('off-curve left (svgX = -100) returns exactly 0', () => {
      const curve = new HillCurve();
      expect(curve.tFromSvgX(-100, { width: 400, height: 200 })).toBe(0);
    });

    it('off-curve right (svgX = size.width + 100) returns exactly 1', () => {
      const curve = new HillCurve();
      expect(curve.tFromSvgX(500, { width: 400, height: 200 })).toBe(1);
    });

    it('is non-decreasing (monotonic) as svgX increases', () => {
      const curve = new HillCurve();
      const size = { width: 400, height: 200 };
      const xs = [0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400];
      const ts = xs.map((x) => curve.tFromSvgX(x, size));
      for (let i = 1; i < ts.length; i++) {
        expect(ts[i]).toBeGreaterThanOrEqual(ts[i - 1]);
      }
    });
  });

  describe('projectFromSvgPoint', () => {
    it('round-trips toSvgPoint → projectFromSvgPoint within ±0.01 for t=0', () => {
      const curve = new HillCurve();
      const size = { width: 400, height: 200 };
      const svgPt = curve.toSvgPoint(0, size);
      const result = curve.projectFromSvgPoint(svgPt, size);
      expect(Math.abs(result - 0)).toBeLessThan(0.01);
    });

    it('round-trips toSvgPoint → projectFromSvgPoint within ±0.01 for t=0.25', () => {
      const curve = new HillCurve();
      const size = { width: 400, height: 200 };
      const svgPt = curve.toSvgPoint(0.25, size);
      const result = curve.projectFromSvgPoint(svgPt, size);
      expect(Math.abs(result - 0.25)).toBeLessThan(0.01);
    });

    it('round-trips toSvgPoint → projectFromSvgPoint within ±0.01 for t=0.5', () => {
      const curve = new HillCurve();
      const size = { width: 400, height: 200 };
      const svgPt = curve.toSvgPoint(0.5, size);
      const result = curve.projectFromSvgPoint(svgPt, size);
      expect(Math.abs(result - 0.5)).toBeLessThan(0.01);
    });

    it('round-trips toSvgPoint → projectFromSvgPoint within ±0.01 for t=0.75', () => {
      const curve = new HillCurve();
      const size = { width: 400, height: 200 };
      const svgPt = curve.toSvgPoint(0.75, size);
      const result = curve.projectFromSvgPoint(svgPt, size);
      expect(Math.abs(result - 0.75)).toBeLessThan(0.01);
    });

    it('round-trips toSvgPoint → projectFromSvgPoint within ±0.01 for t=1', () => {
      const curve = new HillCurve();
      const size = { width: 400, height: 200 };
      const svgPt = curve.toSvgPoint(1, size);
      const result = curve.projectFromSvgPoint(svgPt, size);
      expect(Math.abs(result - 1)).toBeLessThan(0.01);
    });
  });
});
