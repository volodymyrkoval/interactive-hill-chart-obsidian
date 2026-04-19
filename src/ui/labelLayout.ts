import { separateLabels } from './labelSeparation';
import type { LabelSpec, LabelAnchor } from './labelSeparation';
import { HillPosition } from '../model/hillPosition';

export interface LabelEntry {
  textEl: SVGTextElement;
  position: HillPosition;
  textAnchor: string;
  baseY: number;
}

export class LabelLayout {
  private entries: LabelEntry[] = [];

  add(entry: LabelEntry): void {
    this.entries.push(entry);
  }

  finalize(ceiling: number, maxFontSize: number): void {
    if (this.entries.length === 0) return;
    const specs: LabelSpec[] = this.entries.map(e => ({
      position: e.position.toPercent(),
      textAnchor: e.textAnchor as LabelAnchor,
      baseY: e.baseY,
    }));
    const adjusted = separateLabels(specs, { fontSize: maxFontSize });
    adjusted.forEach((a, i) => {
      const entry = this.entries[i];
      const clampedY = Math.min(a.baseY, ceiling);
      entry.textEl.setAttribute('y', `${clampedY}`);
      // entry.baseY intentionally not mutated — always the natural placement Y
    });
  }

  getEntries(): readonly LabelEntry[] {
    return this.entries;
  }
}
