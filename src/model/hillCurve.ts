import type { Curve } from './curve';
import type { Point, Size } from '../types';

const GSS_ITERATIONS = 5;

interface HillCurveOptions {
  marginRatio?: number;
}

interface BezierSegment {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

export class HillCurve implements Curve {
  // Two cubic Bézier segments in normalized space.
  // Left half (t ∈ [0, 0.5]): hugs baseline, rises steeply to peak
  private static readonly LEFT: BezierSegment = {
    p0: { x: 0, y: 0 },
    p1: { x: 0.25, y: 0 },
    p2: { x: 0.35, y: 0.8 },
    p3: { x: 0.5, y: 0.8 },
  };
  // Right half (t ∈ [0.5, 1]): mirror-symmetric descent from peak to baseline
  private static readonly RIGHT: BezierSegment = {
    p0: { x: 0.5, y: 0.8 },
    p1: { x: 0.65, y: 0.8 },
    p2: { x: 0.75, y: 0 },
    p3: { x: 1, y: 0 },
  };

  private readonly marginRatio: number;

  constructor(options?: HillCurveOptions) {
    this.marginRatio = options?.marginRatio ?? 0.08;
  }

  pointAt(t: number): Point {
    const seg = t <= 0.5 ? HillCurve.LEFT : HillCurve.RIGHT;
    const u = t <= 0.5 ? t * 2 : (t - 0.5) * 2;

    const mu = 1 - u;
    const mu2 = mu * mu;
    const mu3 = mu2 * mu;
    const u2 = u * u;
    const u3 = u2 * u;

    // B(u) = (1-u)³P₀ + 3(1-u)²u P₁ + 3(1-u)u² P₂ + u³ P₃
    const x =
      mu3 * seg.p0.x +
      3 * mu2 * u * seg.p1.x +
      3 * mu * u2 * seg.p2.x +
      u3 * seg.p3.x;

    const y =
      mu3 * seg.p0.y +
      3 * mu2 * u * seg.p1.y +
      3 * mu * u2 * seg.p2.y +
      u3 * seg.p3.y;

    return { x, y };
  }

  private scaleToSize(normPoint: Point, size: Size): Point {
    const margin = this.marginRatio;
    const availableWidth = size.width * (1 - 2 * margin);
    const availableHeight = size.height * (1 - 2 * margin);
    const offsetX = size.width * margin;
    const offsetY = size.height * margin;

    return {
      x: offsetX + normPoint.x * availableWidth,
      y: offsetY + (1 - normPoint.y) * availableHeight,
    };
  }

  toSvgPath(size: Size): string {
    const L = HillCurve.LEFT;
    const R = HillCurve.RIGHT;

    const lp0 = this.scaleToSize(L.p0, size);
    const lp1 = this.scaleToSize(L.p1, size);
    const lp2 = this.scaleToSize(L.p2, size);
    const lp3 = this.scaleToSize(L.p3, size);
    const rp1 = this.scaleToSize(R.p1, size);
    const rp2 = this.scaleToSize(R.p2, size);
    const rp3 = this.scaleToSize(R.p3, size);

    // SVG chained cubics: second C starts implicitly from lp3
    return (
      `M ${lp0.x} ${lp0.y} ` +
      `C ${lp1.x} ${lp1.y}, ${lp2.x} ${lp2.y}, ${lp3.x} ${lp3.y} ` +
      `C ${rp1.x} ${rp1.y}, ${rp2.x} ${rp2.y}, ${rp3.x} ${rp3.y}`
    );
  }

  toSvgPoint(t: number, size: Size): Point {
    return this.scaleToSize(this.pointAt(t), size);
  }

  tFromSvgX(svgX: number, size: Size): number {
    const margin = this.marginRatio;
    const availW = size.width * (1 - 2 * margin);
    const normX = (svgX - size.width * margin) / availW;
    if (normX <= 0) return 0;
    if (normX >= 1) return 1;
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (this.pointAt(mid).x < normX) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  projectFromSvgPoint(svgPoint: Point, size: Size): number {
    const margin = this.marginRatio;
    const availW = size.width * (1 - 2 * margin);
    const availH = size.height * (1 - 2 * margin);
    const normX = (svgPoint.x - size.width * margin) / availW;
    const normY = 1 - (svgPoint.y - size.height * margin) / availH;
    return this.projectToCurve({ x: normX, y: normY });
  }

  projectToCurve(point: Point): number {
    // Sample ~100 points along the curve to find the closest
    const sampleCount = 100;
    let bestT = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i <= sampleCount; i++) {
      const t = i / sampleCount;
      const p = this.pointAt(t);
      const dx = p.x - point.x;
      const dy = p.y - point.y;
      const distance = dx * dx + dy * dy; // Skip sqrt for comparison

      if (distance < bestDistance) {
        bestDistance = distance;
        bestT = t;
      }
    }

    // If exact match found (e.g. boundary), skip refinement
    if (bestDistance === 0) return bestT;

    // Refine with golden-section search (~5 iterations)
    return this.refineProjection(point, bestT);
  }

  private refineProjection(point: Point, initialT: number): number {
    let left = Math.max(0, initialT - 0.1);
    let right = Math.min(1, initialT + 0.1);
    const goldenRatio = (3 - Math.sqrt(5)) / 2; // ≈ 0.381

    // Golden-section search refinement
    for (let i = 0; i < GSS_ITERATIONS; i++) {
      const x1 = right - goldenRatio * (right - left);
      const x2 = left + goldenRatio * (right - left);

      const p1 = this.pointAt(x1);
      const p2 = this.pointAt(x2);
      const d1 = (p1.x - point.x) ** 2 + (p1.y - point.y) ** 2;
      const d2 = (p2.x - point.x) ** 2 + (p2.y - point.y) ** 2;

      if (d1 < d2) {
        right = x2;
      } else {
        left = x1;
      }
    }

    // Also evaluate the endpoints so boundary minima (t=0, t=1) are captured.
    // Include initialT: the coarse search found it as best, but GSS may drift
    // when probes are nearly equidistant from the minimum.
    const candidates = [left, (left + right) / 2, right, initialT];
    let bestT = candidates[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const t of candidates) {
      const p = this.pointAt(t);
      const d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestT = t;
      }
    }
    return bestT;
  }
}
