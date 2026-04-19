import type { Curve } from '../model/curve';
import type { Size } from '../types';

const LABEL_OFFSET_PX = 10;
export const LEFT_ANCHOR_THRESHOLD = 80;
export const MIDDLE_ANCHOR_HI = 60;
export const MIDDLE_ANCHOR_LO = 40;

export interface LabelPlacement {
  labelX: number;
  labelY: number;
  textAnchor: 'start' | 'middle' | 'end';
}

export function computeLabelPlacement(t: number, dotX: number, dotY: number): LabelPlacement {
  const position = t * 100;
  if (position >= LEFT_ANCHOR_THRESHOLD) {
    return { labelX: dotX - LABEL_OFFSET_PX, labelY: dotY, textAnchor: 'end' };
  } else if (position >= MIDDLE_ANCHOR_LO && position <= MIDDLE_ANCHOR_HI) {
    return { labelX: dotX, labelY: dotY - LABEL_OFFSET_PX, textAnchor: 'middle' };
  } else {
    return { labelX: dotX + LABEL_OFFSET_PX, labelY: dotY, textAnchor: 'start' };
  }
}

/**
 * Computes the tangent angle of the curve at parameter t using finite differences.
 *
 * Uses ε = 0.01, clamped so both t - ε and t + ε stay in [0, 1].
 * Returns the angle in radians using Math.atan2(dy, dx) in SVG space.
 *
 * In SVG, y increases downward. The angle is measured counter-clockwise from the positive x-axis.
 */
export function tangentAngle(curve: Curve, t: number, size: Size): number {
  const epsilon = 0.01;
  const tMinus = Math.max(0, t - epsilon);
  const tPlus = Math.min(1, t + epsilon);

  const pMinus = curve.toSvgPoint(tMinus, size);
  const pPlus = curve.toSvgPoint(tPlus, size);

  const dx = pPlus.x - pMinus.x;
  const dy = pPlus.y - pMinus.y;

  return Math.atan2(dy, dx);
}

/**
 * Computes the unit inward normal vector for a tangent angle in SVG space.
 *
 * Given a tangent angle (in radians), returns the perpendicular unit vector
 * pointing toward the inward (concave) side of the hill curve.
 * For a hill (concave downward), "inward" = upward in screen space = negative SVG y.
 *
 * The tangent direction is (cos θ, sin θ). The two perpendiculars are:
 * - Option 1: (-sin θ, cos θ)
 * - Option 2: (sin θ, -cos θ)
 * We pick the one with y ≤ 0 (pointing upward).
 *
 * @param angleRad - Tangent angle in radians (SVG space, y increases downward)
 * @returns Unit vector {x, y} with y component ≤ 0 (pointing upward)
 */
export function inwardNormal(angleRad: number): { x: number; y: number } {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // Option 1: (-sin, cos)  — y component is cos θ
  // Option 2: (sin, -cos)  — y component is -cos θ
  // Both y components are 0 iff cos θ = 0 (vertical tangent, angle = ±π/2).
  if (cos === 0) {
    return { x: 0, y: -1 }; // Safe default: straight up
  }

  // Pick the option with y ≤ 0.
  if (cos <= 0) {
    return { x: -sin, y: cos };
  } else {
    return { x: sin, y: -cos };
  }
}
