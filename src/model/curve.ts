import type { Point, Size } from '../types';

export interface Curve {
  /**
   * Point on the curve at parameter t ∈ [0, 1].
   * Returns coordinates in the curve's native space (typically normalised [0,1]²).
   */
  pointAt(t: number): Point;

  /**
   * SVG path `d` attribute for rendering the curve within the given size.
   * Handles coordinate transformation (normalised → scaled, y-flip).
   */
  toSvgPath(size: Size): string;

  /**
   * Point at parameter t ∈ [0, 1], mapped into SVG pixel space
   * for the given `size` (uses the same margin as `toSvgPath`).
   */
  toSvgPoint(t: number, size: Size): Point;

  /**
   * Project an arbitrary point onto the curve and return the parameter t
   * of the closest point on the curve.
   * Point is in the same coordinate system as `pointAt` (typically normalised [0,1]²).
   * Enables drag-to-snap behaviour.
   */
  projectToCurve(point: Point): number;

  /**
   * Convert an SVG pixel-space point back to a curve parameter t ∈ [0, 1].
   * Inverse of `toSvgPoint`: un-applies the margin scaling then calls `projectToCurve`.
   */
  projectFromSvgPoint(svgPoint: Point, size: Size): number;

  /**
   * Convert an SVG x-coordinate to a curve parameter t ∈ [0, 1] using
   * x-only inversion (binary search). More stable than Euclidean projection
   * for drag UX because the Bézier x(t) is strictly monotonic.
   * Clamps to [0, 1] for out-of-range inputs.
   */
  tFromSvgX(svgX: number, size: Size): number;
}
