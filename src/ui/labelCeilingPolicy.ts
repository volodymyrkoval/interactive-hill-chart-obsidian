import type { HillChartConfig } from '../model/hillChartConfig';
import type { ResolvedChartStyle } from '../model/chartStyle';
import { resolveDotStyle } from './dotStyle';
import { SECTION_LABEL_OFFSET, DEFAULT_DOT_LABEL_FONT_SIZE } from './visualConstants';

export class LabelCeilingPolicy {
  private ceiling: number | null = null;
  private maxFontSize: number = DEFAULT_DOT_LABEL_FONT_SIZE;

  compute(baselineY: number, sectionFontSize: number, config: HillChartConfig, resolved: ResolvedChartStyle): void {
    this.maxFontSize = config.dots.reduce((max, dot) => {
      const effective = resolveDotStyle(resolved.dot, dot.style);
      return Math.max(max, effective.fontSize ?? DEFAULT_DOT_LABEL_FONT_SIZE);
    }, DEFAULT_DOT_LABEL_FONT_SIZE);

    const sectionY = baselineY + SECTION_LABEL_OFFSET;
    this.ceiling = sectionY - sectionFontSize / 2 - this.maxFontSize / 2;
  }

  getCeiling(): number | null { return this.ceiling; }
  getMaxFontSize(): number { return this.maxFontSize; }

  reset(): void {
    this.ceiling = null;
    this.maxFontSize = DEFAULT_DOT_LABEL_FONT_SIZE;
  }
}
