import { computeLabelPlacement } from './labelPlacement';
import type { LabelPlacement } from './labelPlacement';
import { LabelLayout } from './labelLayout';
import type { LabelEntry } from './labelLayout';
import type { LabelCeilingPolicy } from './labelCeilingPolicy';
import { HillPosition } from '../model/hillPosition';

/**
 * Applies a computed LabelPlacement to an SVG text element by setting
 * x, y, text-anchor, and dominant-baseline attributes.
 */
export function applyPlacement(textEl: SVGTextElement, placement: LabelPlacement): void {
  textEl.setAttribute('x', `${placement.labelX}`);
  textEl.setAttribute('y', `${placement.labelY}`);
  textEl.setAttribute('text-anchor', placement.textAnchor);
  textEl.setAttribute('dominant-baseline', 'middle');
}

/**
 * Owns label-entry mutation and label-layout finalization for a single dot
 * during a drag gesture.
 *
 * On each call to `update()`:
 *  - Computes the LabelPlacement for the new dot position.
 *  - Applies the placement to the SVG text element.
 *  - Mutates labelEntry.position, textAnchor, and baseY.
 *  - Triggers LabelLayout.finalize when a ceiling is available.
 */
export class LabelDragBinding {
  constructor(
    private readonly labelEntry: LabelEntry | null,
    private readonly textEl: SVGTextElement | null,
    private readonly labelLayout: LabelLayout,
    private readonly ceilingPolicy: LabelCeilingPolicy,
  ) {}

  update(t: number, x: number, y: number): void {
    const placement = computeLabelPlacement(t, x, y);

    if (this.textEl !== null) {
      applyPlacement(this.textEl, placement);
    }

    if (this.labelEntry !== null) {
      this.labelEntry.position = HillPosition.fromPercent(Math.round(t * 100));
      this.labelEntry.textAnchor = placement.textAnchor;
      this.labelEntry.baseY = placement.labelY;
    }

    const ceiling = this.ceilingPolicy.getCeiling();
    if (ceiling !== null) {
      this.labelLayout.finalize(ceiling, this.ceilingPolicy.getMaxFontSize());
    }
  }
}
