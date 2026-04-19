import { describe, it, expect } from 'vitest';
import { LabelCeilingPolicy } from '../../src/ui/labelCeilingPolicy';
import { HillPosition } from '../../src/model/hillPosition';
import type { HillChartConfig } from '../../src/model/hillChartConfig';
import type { ResolvedChartStyle } from '../../src/model/chartStyle';

function pos(n: number): HillPosition { return HillPosition.fromPercent(n); }

function makeConfig(fontSizes: number[] = []): HillChartConfig {
  return {
    errors: [],
    dots: fontSizes.map((fs) => ({
      position: pos(50),
      style: { fontSize: fs },
    })),
  };
}

function makeResolved(): ResolvedChartStyle {
  return {
    curve: { stroke: 'currentColor', strokeWidth: 2, fill: 'none' },
    baseline: { visible: true, stroke: 'currentColor', opacity: 0.3, strokeWidth: 1 },
    divider: { stroke: 'currentColor', strokeWidth: 1, style: 'line' },
    uphill: { fontSize: 12, color: 'currentColor' },
    downhill: { fontSize: 12, color: 'currentColor' },
    dot: { color: 'currentColor', radius: 6, fontSize: 12, fontColor: 'currentColor' },
  };
}

describe('LabelCeilingPolicy', () => {
  it('getCeiling returns null before compute is called', () => {
    const policy = new LabelCeilingPolicy();
    expect(policy.getCeiling()).toBeNull();
  });

  it('getMaxFontSize returns 12 before compute is called', () => {
    const policy = new LabelCeilingPolicy();
    expect(policy.getMaxFontSize()).toBe(12);
  });

  it('compute sets ceiling based on sectionY formula', () => {
    const policy = new LabelCeilingPolicy();
    // SECTION_LABEL_OFFSET = 18, so sectionY = baselineY + 18
    // ceiling = sectionY - sectionFontSize/2 - labelFontSize/2
    const baselineY = 138;
    const sectionFontSize = 12;
    // With no dots, maxFontSize stays 12
    // sectionY = 138 + 18 = 156
    // ceiling = 156 - 6 - 6 = 144
    policy.compute(baselineY, sectionFontSize, makeConfig(), makeResolved());
    expect(policy.getCeiling()).toBe(144);
  });

  it('compute sets maxFontSize to the largest dot font size', () => {
    const policy = new LabelCeilingPolicy();
    policy.compute(100, 12, makeConfig([10, 16, 14]), makeResolved());
    expect(policy.getMaxFontSize()).toBe(16);
  });

  it('compute with no dots keeps maxFontSize at default 12', () => {
    const policy = new LabelCeilingPolicy();
    policy.compute(100, 12, makeConfig(), makeResolved());
    expect(policy.getMaxFontSize()).toBe(12);
  });

  it('compute uses default 12 when dot fontSize is below default', () => {
    const policy = new LabelCeilingPolicy();
    policy.compute(100, 12, makeConfig([8]), makeResolved());
    expect(policy.getMaxFontSize()).toBe(12);
  });

  it('reset restores ceiling to null and maxFontSize to 12', () => {
    const policy = new LabelCeilingPolicy();
    policy.compute(100, 12, makeConfig([20]), makeResolved());
    policy.reset();
    expect(policy.getCeiling()).toBeNull();
    expect(policy.getMaxFontSize()).toBe(12);
  });

  it('ceiling accounts for maxFontSize when dots have large font', () => {
    const policy = new LabelCeilingPolicy();
    // maxFontSize = 20, sectionFontSize = 12, baselineY = 138
    // sectionY = 138 + 18 = 156
    // ceiling = 156 - 6 - 10 = 140
    policy.compute(138, 12, makeConfig([20]), makeResolved());
    expect(policy.getCeiling()).toBe(140);
  });
});
