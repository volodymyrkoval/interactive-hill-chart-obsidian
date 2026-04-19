import { describe, it, expect } from 'vitest';
import { parseYamlHillChart } from '../../src/obsidian/parseYamlHillChart';
import { HillPosition } from '../../src/model/hillPosition';
import type { DotStyle, ChartStyle } from '../../src/model/hillChartConfig';

function pos(n: number): HillPosition {
  return HillPosition.fromPercent(n);
}


describe('parseDotEntry — per-dot style', () => {
  it('partial style (only color) → item.style has only color, no other fields', () => {
    const source = 'dots:\n  - position: 50\n    style:\n      color: red';
    const result = parseYamlHillChart(source);
    expect(result.dots[0].style).toEqual({ color: 'red' });
    expect(result.dots[0].style?.opacity).toBeUndefined();
    expect(result.dots[0].style?.radius).toBeUndefined();
    expect(result.dots[0].style?.fontSize).toBeUndefined();
    expect(result.dots[0].style?.fontColor).toBeUndefined();
    expect(result.errors).toHaveLength(0);
  });

  it('mapping-form dot with full style → item.style set, no errors', () => {
    const source = [
      'dots:',
      '  - position: 50',
      '    label: "My Feature"',
      '    style:',
      '      color: "#ff0000"',
      '      radius: 10',
    ].join('\n');
    const result = parseYamlHillChart(source);
    expect(result.dots).toHaveLength(1);
    expect(result.dots[0].style).toEqual({ color: '#ff0000', radius: 10 });
    expect(result.errors).toHaveLength(0);
  });
});

describe('parseDotEntry — index increments across dots', () => {
  it('second dot bad color → warning mentions dots[1].style.color', () => {
    const source = [
      'dots:',
      '  - position: 25',
      '    label: First',
      '  - position: 75',
      '    style:',
      '      color: notacolor',
    ].join('\n');
    const result = parseYamlHillChart(source);
    expect(result.errors.some(e => e.message.includes('dots[1].style.color'))).toBe(true);
    expect(result.errors.some(e => e.message.includes('dots[0]'))).toBe(false);
  });
});

describe('parseDotEntry — shorthand form regression', () => {
  it('shorthand dot - 50: Label still parses correctly, no style, no errors', () => {
    const source = 'dots:\n  - 50: Label';
    const result = parseYamlHillChart(source);
    expect(result.dots).toHaveLength(1);
    expect(result.dots[0].position.toPercent()).toBe(50);
    expect(result.dots[0].label).toBe('Label');
    expect(result.dots[0].style).toBeUndefined();
    expect(result.errors).toHaveLength(0);
  });
});

describe('parseDotEntry — style: non-object', () => {
  it('style: "red" (scalar) → no item.style, warning must be a mapping', () => {
    const source = 'dots:\n  - position: 50\n    style: "red"';
    const result = parseYamlHillChart(source);
    expect(result.dots[0].style).toBeUndefined();
    expect(result.errors.some(e => e.message.includes('dots[0].style: must be a mapping'))).toBe(true);
  });

  it('style: [1,2] (array) → no item.style, warning must be a mapping', () => {
    const source = 'dots:\n  - position: 50\n    style:\n      - 1\n      - 2';
    const result = parseYamlHillChart(source);
    expect(result.dots[0].style).toBeUndefined();
    expect(result.errors.some(e => e.message.includes('dots[0].style: must be a mapping'))).toBe(true);
  });

  it('style: null → no item.style, no error', () => {
    const source = 'dots:\n  - position: 50\n    style: null';
    const result = parseYamlHillChart(source);
    expect(result.dots[0].style).toBeUndefined();
    expect(result.errors).toHaveLength(0);
  });
});

describe('parseDotEntry — unknown key in per-dot style', () => {
  it('unknown key foo → warning "dots[0].style: unknown key \\"foo\\"", valid color kept', () => {
    const source = [
      'dots:',
      '  - position: 50',
      '    style:',
      '      color: red',
      '      foo: 1',
    ].join('\n');
    const result = parseYamlHillChart(source);
    expect(result.errors.some(e => e.message.includes('dots[0].style: unknown key "foo"'))).toBe(true);
    expect(result.dots[0].style).toEqual({ color: 'red' });
  });
});

describe('parseDotEntry — out-of-range numbers in per-dot style', () => {
  it('opacity:2, radius:-1, fontSize:-5 → three warnings with dots[0].style.* context, style undefined', () => {
    const source = [
      'dots:',
      '  - position: 50',
      '    style:',
      '      opacity: 2',
      '      radius: -1',
      '      fontSize: -5',
    ].join('\n');
    const result = parseYamlHillChart(source);
    expect(result.errors.some(e => e.message.includes('dots[0].style.opacity'))).toBe(true);
    expect(result.errors.some(e => e.message.includes('dots[0].style.radius'))).toBe(true);
    expect(result.errors.some(e => e.message.includes('dots[0].style.fontSize'))).toBe(true);
    expect(result.dots[0].style).toBeUndefined();
  });
});

describe('parseDotEntry — invalid fields in per-dot style', () => {
  it('invalid color in style → warning dots[0].style.color, valid sibling radius kept', () => {
    const source = [
      'dots:',
      '  - position: 50',
      '    style:',
      '      color: not-a-color',
      '      radius: 10',
    ].join('\n');
    const result = parseYamlHillChart(source);
    expect(result.errors.some(e => e.message.includes('dots[0].style.color'))).toBe(true);
    expect(result.dots[0].style).toEqual({ radius: 10 });
  });
});

describe('parseDotStyle with custom context', () => {
  it('invalid color with context dots[0].style emits dots[0].style.color in error', () => {
    const source = [
      'dots:',
      '  - position: 50',
      '    label: Test',
      '    style:',
      '      color: notacolor',
      '      radius: 8',
    ].join('\n');
    const result = parseYamlHillChart(source);
    expect(result.errors.some(e => e.message.includes('dots[0].style.color'))).toBe(true);
    expect(result.dots[0].style?.radius).toBe(8);
  });
});

describe('parseYamlHillChart - chart.dot parsing (wired)', () => {
  it('chart.dot.color valid → config.chart.dot.color set', () => {
    const source = 'chart:\n  dot:\n    color: "#ff6b6b"\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.dot?.color).toBe('#ff6b6b');
  });
});

describe('parseYamlHillChart - chart.dot happy path', () => {
  it('all 5 valid fields → all set on config.chart.dot, no errors', () => {
    const source = [
      'chart:',
      '  dot:',
      '    color: "#ff6b6b"',
      '    opacity: 0.8',
      '    radius: 8',
      '    fontSize: 14',
      '    fontColor: "#333"',
      'dots: []',
    ].join('\n');
    const result = parseYamlHillChart(source);
    expect(result.chart?.dot?.color).toBe('#ff6b6b');
    expect(result.chart?.dot?.opacity).toBe(0.8);
    expect(result.chart?.dot?.radius).toBe(8);
    expect(result.chart?.dot?.fontSize).toBe(14);
    expect(result.chart?.dot?.fontColor).toBe('#333');
    expect(result.errors).toHaveLength(0);
  });

  it('partial (only color) → only color set, other fields absent', () => {
    const source = 'chart:\n  dot:\n    color: red\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.dot?.color).toBe('red');
    expect(result.chart?.dot?.opacity).toBeUndefined();
    expect(result.chart?.dot?.radius).toBeUndefined();
    expect(result.chart?.dot?.fontSize).toBeUndefined();
    expect(result.chart?.dot?.fontColor).toBeUndefined();
  });

  it('chart.dot absent → config.chart?.dot is undefined', () => {
    const source = 'chart:\n  curve:\n    stroke: red\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.dot).toBeUndefined();
  });

  it('chart.dot: {} → config.chart?.dot is undefined', () => {
    const source = 'chart:\n  dot: {}\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.dot).toBeUndefined();
  });
});

describe('parseYamlHillChart - chart.dot validation failures', () => {
  it('invalid color → warning dot.color, field omitted, valid fields kept', () => {
    const source = 'chart:\n  dot:\n    color: notacolor\n    radius: 8\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.dot?.color).toBeUndefined();
    expect(result.chart?.dot?.radius).toBe(8);
    expect(result.errors.some(e => e.message.includes('dot.color'))).toBe(true);
  });

  it('invalid fontColor → warning dot.fontColor', () => {
    const source = 'chart:\n  dot:\n    fontColor: badcolor\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.dot?.fontColor).toBeUndefined();
    expect(result.errors.some(e => e.message.includes('dot.fontColor'))).toBe(true);
  });

  it('negative radius → warning dot.radius', () => {
    const source = 'chart:\n  dot:\n    radius: -3\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.dot?.radius).toBeUndefined();
    expect(result.errors.some(e => e.message.includes('dot.radius'))).toBe(true);
  });

  it('opacity: 2 → warning dot.opacity', () => {
    const source = 'chart:\n  dot:\n    opacity: 2\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.dot?.opacity).toBeUndefined();
    expect(result.errors.some(e => e.message.includes('dot.opacity'))).toBe(true);
  });

  it('negative fontSize → warning dot.fontSize', () => {
    const source = 'chart:\n  dot:\n    fontSize: -5\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.dot?.fontSize).toBeUndefined();
    expect(result.errors.some(e => e.message.includes('dot.fontSize'))).toBe(true);
  });

  it('radius: "big" (non-number) → warning, omitted', () => {
    const source = 'chart:\n  dot:\n    radius: big\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.dot?.radius).toBeUndefined();
    expect(result.errors.some(e => e.message.includes('dot.radius'))).toBe(true);
  });

  it('chart.dot as array → returns undefined, no crash', () => {
    const source = 'chart:\n  dot:\n    - color: red\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.dot).toBeUndefined();
  });

  it('chart.dot as string → returns undefined, no crash', () => {
    const source = 'chart:\n  dot: "something"\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.dot).toBeUndefined();
  });

  it('chart.dot: null → returns undefined, no crash', () => {
    const source = 'chart:\n  dot: null\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.dot).toBeUndefined();
  });
});

describe('parseYamlHillChart - empty/blank source', () => {
  it('empty string → { dots: [] }', () => {
    expect(parseYamlHillChart('')).toEqual({ dots: [], errors: [] });
  });

  it('whitespace only → { dots: [] }', () => {
    expect(parseYamlHillChart('   \n  ')).toEqual({ dots: [], errors: [] });
  });
});

describe('parseYamlHillChart - dots shorthand form', () => {
  it('single shorthand dot → [{ position: 50, label: "Label" }]', () => {
    const source = 'dots:\n  - 50: Label';
    expect(parseYamlHillChart(source)).toEqual({
      dots: [{ position: pos(50), label: 'Label' }],
      errors: [],
    });
  });

  it('multiple shorthand dots → multiple items', () => {
    const source = 'dots:\n  - 25: Alpha\n  - 75: Beta';
    expect(parseYamlHillChart(source)).toEqual({
      dots: [
        { position: pos(25), label: 'Alpha' },
        { position: pos(75), label: 'Beta' },
      ],
      errors: [],
    });
  });

  it('shorthand dot without label → { position: 50 }', () => {
    const source = 'dots:\n  - 50:';
    expect(parseYamlHillChart(source)).toEqual({
      dots: [{ position: pos(50) }],
      errors: [],
    });
  });
});

describe('parseYamlHillChart - dots mapping form', () => {
  it('mapping form → { position, label }', () => {
    const source = 'dots:\n  - position: 50\n    label: Foo';
    expect(parseYamlHillChart(source)).toEqual({
      dots: [{ position: pos(50), label: 'Foo' }],
      errors: [],
    });
  });

  it('mapping form without label → { position }', () => {
    const source = 'dots:\n  - position: 75';
    expect(parseYamlHillChart(source)).toEqual({
      dots: [{ position: pos(75) }],
      errors: [],
    });
  });
});

describe('parseYamlHillChart - wiki-links', () => {
  it('quoted wiki-link → { label, noteLink }', () => {
    const source = 'dots:\n  - 25: "[[Research Notes]]"';
    expect(parseYamlHillChart(source)).toEqual({
      dots: [{ position: pos(25), label: 'Research Notes', noteLink: 'Research Notes' }],
      errors: [],
    });
  });

  it('unquoted [[Note]] → error in config.errors, item dropped', () => {
    // YAML treats [[Note]] as an array → causes error
    const source = 'dots:\n  - 50: [[Bad Link]]';
    const result = parseYamlHillChart(source);
    expect(result.dots).toEqual([]);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].severity).toBe('warning');
  });
});

describe('parseYamlHillChart - chart.curve.*', () => {
  it('chart.curve.stroke → config.chart.curve.stroke', () => {
    const source = 'chart:\n  curve:\n    stroke: var(--interactive-accent)\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.curve?.stroke).toBe('var(--interactive-accent)');
  });

  it('chart.curve.strokeWidth → config.chart.curve.strokeWidth', () => {
    const source = 'chart:\n  curve:\n    strokeWidth: 3\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.curve?.strokeWidth).toBe(3);
  });

  it('chart.curve.fill → config.chart.curve.fill', () => {
    const source = 'chart:\n  curve:\n    fill: none\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.curve?.fill).toBe('none');
  });
});

describe('parseYamlHillChart - chart.baseline.*', () => {
  it('chart.baseline.visible: false → config.chart.baseline.visible = false', () => {
    const source = 'chart:\n  baseline:\n    visible: false\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.baseline?.visible).toBe(false);
  });

  it('chart.baseline.opacity → config.chart.baseline.opacity', () => {
    const source = 'chart:\n  baseline:\n    opacity: 0.2\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.baseline?.opacity).toBe(0.2);
  });

  it('chart.baseline.stroke → config.chart.baseline.stroke', () => {
    const source = 'chart:\n  baseline:\n    stroke: "#ff0000"\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.baseline?.stroke).toBe('#ff0000');
  });

  it('chart.baseline.strokeWidth → config.chart.baseline.strokeWidth', () => {
    const source = 'chart:\n  baseline:\n    strokeWidth: 2\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.baseline?.strokeWidth).toBe(2);
  });
});


describe('parseYamlHillChart - chart.uphill / chart.downhill', () => {
  it('chart.uphill.label → config.chart.uphill.label', () => {
    const source = 'chart:\n  uphill:\n    label: "Figuring things out"\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.uphill?.label).toBe('Figuring things out');
  });

  it('chart.uphill.fontSize → config.chart.uphill.fontSize', () => {
    const source = 'chart:\n  uphill:\n    fontSize: 11\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.uphill?.fontSize).toBe(11);
  });

  it('chart.uphill.color → config.chart.uphill.color', () => {
    const source = 'chart:\n  uphill:\n    color: var(--text-muted)\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.uphill?.color).toBe('var(--text-muted)');
  });

  it('chart.downhill.label → config.chart.downhill.label', () => {
    const source = 'chart:\n  downhill:\n    label: "Making it happen"\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.downhill?.label).toBe('Making it happen');
  });

  it('chart.downhill.fontSize and color', () => {
    const source = 'chart:\n  downhill:\n    fontSize: 10\n    color: red\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.downhill?.fontSize).toBe(10);
    expect(result.chart?.downhill?.color).toBe('red');
  });
});

describe('chart.divider', () => {
  it('no divider key → config.chart?.divider is undefined, no errors', () => {
    const source = 'chart:\n  curve:\n    stroke: red\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.divider).toBeUndefined();
    expect(result.errors).toHaveLength(0);
  });

  it('visible: true → parsed, no errors', () => {
    const source = 'chart:\n  divider:\n    visible: true\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.divider?.visible).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('visible: "yes" → warning, field ignored (visible undefined)', () => {
    const source = 'chart:\n  divider:\n    visible: "yes"\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.divider?.visible).toBeUndefined();
    expect(result.errors.some(e => e.severity === 'warning' && e.message.includes('divider.visible'))).toBe(true);
  });

  it('stroke: "#abc" → parsed; invalid color "notacolor" → warning + ignored', () => {
    const source = 'chart:\n  divider:\n    stroke: "#abc"\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.divider?.stroke).toBe('#abc');
    expect(result.errors).toHaveLength(0);

    const source2 = 'chart:\n  divider:\n    stroke: notacolor\ndots: []';
    const result2 = parseYamlHillChart(source2);
    expect(result2.chart?.divider?.stroke).toBeUndefined();
    expect(result2.errors?.some(e => e.severity === 'warning' && e.message.includes('divider.stroke'))).toBe(true);
  });

  it('strokeWidth: 2 → parsed; strokeWidth: -1 → warning + ignored', () => {
    const source = 'chart:\n  divider:\n    strokeWidth: 2\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.divider?.strokeWidth).toBe(2);
    expect(result.errors).toHaveLength(0);

    const source2 = 'chart:\n  divider:\n    strokeWidth: -1\ndots: []';
    const result2 = parseYamlHillChart(source2);
    expect(result2.chart?.divider?.strokeWidth).toBeUndefined();
    expect(result2.errors?.some(e => e.severity === 'warning' && e.message.includes('divider.strokeWidth'))).toBe(true);
  });

  it('style: "dashed" → parsed; style: "dotted" → warning + ignored', () => {
    const source = 'chart:\n  divider:\n    style: dashed\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.divider?.style).toBe('dashed');
    expect(result.errors).toHaveLength(0);

    const source2 = 'chart:\n  divider:\n    style: dotted\ndots: []';
    const result2 = parseYamlHillChart(source2);
    expect(result2.chart?.divider?.style).toBeUndefined();
    expect(result2.errors?.some(e => e.severity === 'warning' && e.message.includes('divider.style'))).toBe(true);
  });

  it('all three valid styles parse: line, dots, dashed', () => {
    for (const style of ['line', 'dots', 'dashed']) {
      const source = `chart:\n  divider:\n    style: ${style}\ndots: []`;
      const result = parseYamlHillChart(source);
      expect(result.chart?.divider?.style).toBe(style);
      expect(result.errors).toHaveLength(0);
    }
  });

  it('partial config visible: true only → only visible in result, no error', () => {
    const source = 'chart:\n  divider:\n    visible: true\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.chart?.divider).toEqual({ visible: true });
    expect(result.errors).toHaveLength(0);
  });
});

describe('parseDotEntry — out-of-range position: clamp + error coexist', () => {
  it('position: -10 → item kept with toPercent() === 0 AND out-of-range error emitted', () => {
    const source = 'dots:\n  - position: -10\n    label: NegativeFeature';
    const result = parseYamlHillChart(source);
    expect(result.dots).toHaveLength(1);
    expect(result.dots[0].position.toPercent()).toBe(0);
    expect(result.errors.some(e => e.message.includes('dots[0].position') && e.severity === 'warning')).toBe(true);
  });

  it('position: 150 → item kept with toPercent() === 100 AND out-of-range error emitted', () => {
    const source = 'dots:\n  - position: 150\n    label: OverFeature';
    const result = parseYamlHillChart(source);
    expect(result.dots).toHaveLength(1);
    expect(result.dots[0].position.toPercent()).toBe(100);
    expect(result.errors.some(e => e.message.includes('dots[0].position') && e.severity === 'warning')).toBe(true);
  });
});

describe('parseDotEntry — invalid position warnings', () => {
  it('mapping form position: "50" (string) → warning dots[0].position must be a number, dot dropped', () => {
    const source = 'dots:\n  - position: "50"\n    label: Foo';
    const result = parseYamlHillChart(source);
    expect(result.dots).toHaveLength(0);
    expect(result.errors.some(e => e.message.includes('dots[0].position: must be a number (0–100). Item dropped.'))).toBe(true);
    expect(result.errors.some(e => e.severity === 'warning')).toBe(true);
  });

  it('mapping form position: 150 (out of range) → warning dots[0].position, dot kept with clamped value', () => {
    const source = 'dots:\n  - position: 150\n    label: Foo';
    const result = parseYamlHillChart(source);
    expect(result.dots).toHaveLength(1);
    expect(result.dots[0].position.toPercent()).toBe(100);
    expect(result.errors.some(e => e.message.includes('dots[0].position') && e.severity === 'warning')).toBe(true);
  });

  it('mapping form with no position key (only label) → warning no valid position found, dot dropped', () => {
    const source = 'dots:\n  - label: Foo';
    const result = parseYamlHillChart(source);
    expect(result.dots).toHaveLength(0);
    expect(result.errors.some(e => e.message.includes('dots[0]: no valid position found.'))).toBe(true);
    expect(result.errors.some(e => e.severity === 'warning')).toBe(true);
  });

  it('shorthand form with no numeric key (only label) → warning no valid position found, dot dropped', () => {
    // YAML: "- label: Foo" parses as { label: 'Foo' } — no numeric key, shorthand also fails
    const source = 'dots:\n  - label: Foo';
    const result = parseYamlHillChart(source);
    expect(result.dots).toHaveLength(0);
    expect(result.errors.some(e => e.message.includes('dots[0]: no valid position found.'))).toBe(true);
  });
});

describe('parseYamlHillChart - error handling', () => {
  it('malformed YAML → { dots: [], errors: [{ severity: "error" }] }', () => {
    const source = 'chart: {\n  invalid yaml';
    const result = parseYamlHillChart(source);
    expect(result.dots).toEqual([]);
    expect(result.errors).toBeDefined();
    expect(result.errors[0].severity).toBe('error');
  });

  it('unknown top-level key → warning in errors, rest still parses', () => {
    const source = 'unknownKey: value\ndots:\n  - 50: Feature';
    const result = parseYamlHillChart(source);
    expect(result.dots).toEqual([{ position: pos(50), label: 'Feature' }]);
    expect(result.errors).toBeDefined();
    expect(result.errors.some(e => e.severity === 'warning')).toBe(true);
  });
});

describe('parseYamlHillChart - value validation', () => {
  describe('invalid colors → warning, field dropped', () => {
    it('chart.curve.stroke: invalid color → warning, field dropped', () => {
      const source = 'chart:\n  curve:\n    stroke: notacolor\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.curve?.stroke).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors.some(e => e.severity === 'warning')).toBe(true);
      expect(result.errors.some(e => e.message.includes('curve.stroke'))).toBe(true);
    });

    it('chart.curve.fill: invalid color → warning, field dropped', () => {
      const source = 'chart:\n  curve:\n    fill: "#gg0000"\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.curve?.fill).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors.some(e => e.severity === 'warning')).toBe(true);
    });

    it('chart.baseline.stroke: invalid color → warning, field dropped', () => {
      const source = 'chart:\n  baseline:\n    stroke: badcolor\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.baseline?.stroke).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors.some(e => e.severity === 'warning')).toBe(true);
    });

    it('chart.uphill.color: invalid color → warning, field dropped', () => {
      const source = 'chart:\n  uphill:\n    color: notacolor\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.uphill?.color).toBeUndefined();
      expect(result.errors).toBeDefined();
    });

    it('chart.downhill.color: invalid color → warning, field dropped', () => {
      const source = 'chart:\n  downhill:\n    color: invalidcolor\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.downhill?.color).toBeUndefined();
      expect(result.errors).toBeDefined();
    });
  });

  describe('invalid non-negative fields → warning, field dropped', () => {
    it('chart.curve.strokeWidth: negative → warning, field dropped', () => {
      const source = 'chart:\n  curve:\n    strokeWidth: -1\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.curve?.strokeWidth).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors.some(e => e.severity === 'warning')).toBe(true);
    });

    it('chart.curve.strokeWidth: NaN → warning, field dropped', () => {
      const source = 'chart:\n  curve:\n    strokeWidth: NaN\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.curve?.strokeWidth).toBeUndefined();
    });

    it('chart.baseline.strokeWidth: negative → warning, field dropped', () => {
      const source = 'chart:\n  baseline:\n    strokeWidth: -5\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.baseline?.strokeWidth).toBeUndefined();
      expect(result.errors).toBeDefined();
    });

    it('chart.uphill.fontSize: negative → warning, field dropped', () => {
      const source = 'chart:\n  uphill:\n    fontSize: -10\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.uphill?.fontSize).toBeUndefined();
      expect(result.errors).toBeDefined();
    });

    it('chart.downhill.fontSize: Infinity → warning, field dropped', () => {
      const source = 'chart:\n  downhill:\n    fontSize: Infinity\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.downhill?.fontSize).toBeUndefined();
    });
  });

  describe('string value for numeric fields → warning, field dropped', () => {
    it('chart.curve.strokeWidth: string → warning, field dropped', () => {
      const source = 'chart:\n  curve:\n    strokeWidth: thick\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.curve?.strokeWidth).toBeUndefined();
      expect(result.errors.some(e => e.severity === 'warning' && e.message.includes('curve.strokeWidth'))).toBe(true);
    });

    it('chart.baseline.strokeWidth: string → warning, field dropped', () => {
      const source = 'chart:\n  baseline:\n    strokeWidth: thin\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.baseline?.strokeWidth).toBeUndefined();
      expect(result.errors.some(e => e.severity === 'warning' && e.message.includes('baseline.strokeWidth'))).toBe(true);
    });

    it('chart.baseline.opacity: string → warning, field dropped', () => {
      const source = 'chart:\n  baseline:\n    opacity: half\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.baseline?.opacity).toBeUndefined();
      expect(result.errors.some(e => e.severity === 'warning' && e.message.includes('baseline.opacity'))).toBe(true);
    });

    it('chart.uphill.fontSize: string → warning, field dropped', () => {
      const source = 'chart:\n  uphill:\n    fontSize: large\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.uphill?.fontSize).toBeUndefined();
      expect(result.errors.some(e => e.severity === 'warning' && e.message.includes('uphill.fontSize'))).toBe(true);
    });

    it('chart.downhill.fontSize: string → warning, field dropped', () => {
      const source = 'chart:\n  downhill:\n    fontSize: small\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.downhill?.fontSize).toBeUndefined();
      expect(result.errors.some(e => e.severity === 'warning' && e.message.includes('downhill.fontSize'))).toBe(true);
    });
  });

  describe('invalid opacity → warning, field dropped', () => {
    it('chart.baseline.opacity: negative → warning, field dropped', () => {
      const source = 'chart:\n  baseline:\n    opacity: -0.1\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.baseline?.opacity).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors.some(e => e.severity === 'warning')).toBe(true);
    });

    it('chart.baseline.opacity: > 1 → warning, field dropped', () => {
      const source = 'chart:\n  baseline:\n    opacity: 1.5\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.baseline?.opacity).toBeUndefined();
      expect(result.errors).toBeDefined();
    });
  });

  describe('invalid boolean → warning, field dropped', () => {
    it('chart.baseline.visible: non-boolean string → warning, field dropped', () => {
      const source = 'chart:\n  baseline:\n    visible: "yes"\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.baseline?.visible).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors.some(e => e.severity === 'warning')).toBe(true);
    });

    it('chart.baseline.visible: number → warning, field dropped', () => {
      const source = 'chart:\n  baseline:\n    visible: 1\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.baseline?.visible).toBeUndefined();
      expect(result.errors).toBeDefined();
    });
  });

  describe('valid values → no error, field included', () => {
    it('chart.curve.stroke: valid hex color → no error', () => {
      const source = 'chart:\n  curve:\n    stroke: "#23ad32"\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.curve?.stroke).toBe('#23ad32');
      expect(result.errors).toHaveLength(0);
    });

    it('chart.curve.stroke: valid CSS named color → no error', () => {
      const source = 'chart:\n  curve:\n    stroke: red\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.curve?.stroke).toBe('red');
      expect(result.errors).toHaveLength(0);
    });

    it('chart.curve.stroke: var(--...) → no error', () => {
      const source = 'chart:\n  curve:\n    stroke: var(--interactive-accent)\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.curve?.stroke).toBe('var(--interactive-accent)');
      expect(result.errors).toHaveLength(0);
    });

    it('chart.baseline.opacity: 0.5 → no error', () => {
      const source = 'chart:\n  baseline:\n    opacity: 0.5\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.baseline?.opacity).toBe(0.5);
      expect(result.errors).toHaveLength(0);
    });

    it('chart.baseline.visible: true → no error', () => {
      const source = 'chart:\n  baseline:\n    visible: true\ndots: []';
      const result = parseYamlHillChart(source);
      expect(result.chart?.baseline?.visible).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('parseBaselineStyle — unknown key warning', () => {
  it('unknown key bogusKey → warning "baseline: unknown key \\"bogusKey\\"", valid stroke kept', () => {
    const source = [
      'chart:',
      '  baseline:',
      '    stroke: red',
      '    bogusKey: x',
      'dots: []',
    ].join('\n');
    const result = parseYamlHillChart(source);
    expect(result.errors.some(e => e.message.includes('baseline: unknown key "bogusKey"'))).toBe(true);
    expect(result.chart?.baseline?.stroke).toBe('red');
  });
});

describe('parseDividerStyle — unknown key warning', () => {
  it('unknown key bogusKey → warning "divider: unknown key \\"bogusKey\\"", valid visible kept', () => {
    const source = [
      'chart:',
      '  divider:',
      '    visible: true',
      '    bogusKey: x',
      'dots: []',
    ].join('\n');
    const result = parseYamlHillChart(source);
    expect(result.errors.some(e => e.message.includes('divider: unknown key "bogusKey"'))).toBe(true);
    expect(result.chart?.divider?.visible).toBe(true);
  });
});

describe('parseCurveStyle — unknown key warning', () => {
  it('unknown key bogusKey → warning "curve: unknown key \\"bogusKey\\"", valid stroke kept', () => {
    const source = [
      'chart:',
      '  curve:',
      '    stroke: red',
      '    bogusKey: x',
      'dots: []',
    ].join('\n');
    const result = parseYamlHillChart(source);
    expect(result.errors.some(e => e.message.includes('curve: unknown key "bogusKey"'))).toBe(true);
    expect(result.chart?.curve?.stroke).toBe('red');
  });
});

describe('parseUphillStyle — unknown key warning', () => {
  it('unknown key bogusKey → warning "uphill: unknown key \\"bogusKey\\"", valid label kept', () => {
    const source = [
      'chart:',
      '  uphill:',
      '    label: "Going up"',
      '    bogusKey: x',
      'dots: []',
    ].join('\n');
    const result = parseYamlHillChart(source);
    expect(result.errors.some(e => e.message.includes('uphill: unknown key "bogusKey"'))).toBe(true);
    expect(result.chart?.uphill?.label).toBe('Going up');
  });
});

describe('parseDownhillStyle — unknown key warning', () => {
  it('unknown key bogusKey → warning "downhill: unknown key \\"bogusKey\\"", valid label kept', () => {
    const source = [
      'chart:',
      '  downhill:',
      '    label: "Going down"',
      '    bogusKey: x',
      'dots: []',
    ].join('\n');
    const result = parseYamlHillChart(source);
    expect(result.errors.some(e => e.message.includes('downhill: unknown key "bogusKey"'))).toBe(true);
    expect(result.chart?.downhill?.label).toBe('Going down');
  });
});

describe('warnUnknownTopLevel — message content and multiple keys', () => {
  it('single unknown top-level key → warning message names the key', () => {
    const source = 'weirdKey: value\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.errors.some(e =>
      e.severity === 'warning' && e.message.includes('"weirdKey"')
    )).toBe(true);
  });

  it('two unknown top-level keys → two separate warnings, one per key', () => {
    const source = 'alpha: 1\nbeta: 2\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.errors.some(e => e.severity === 'warning' && e.message.includes('"alpha"'))).toBe(true);
    expect(result.errors.some(e => e.severity === 'warning' && e.message.includes('"beta"'))).toBe(true);
  });

  it('known keys chart and dots → no unknown-key warnings', () => {
    const source = 'chart:\n  curve:\n    stroke: red\ndots: []';
    const result = parseYamlHillChart(source);
    expect(result.errors.every(e => !e.message.startsWith('Unknown top-level'))).toBe(true);
  });
});

describe('detectUnquotedWikiLinkInEntry — unquoted wiki-link in mapping form', () => {
  it('label: [[Note]] (unquoted) → item dropped, warning emitted', () => {
    // YAML parses [[Note]] as a nested array on the label key
    const source = 'dots:\n  - position: 50\n    label: [[My Note]]';
    const result = parseYamlHillChart(source);
    expect(result.dots).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.severity === 'warning')).toBe(true);
  });

  it('second unquoted wiki-link → error message includes index [1]', () => {
    const source = [
      'dots:',
      '  - position: 25',
      '    label: "First"',
      '  - position: 75',
      '    label: [[Second Note]]',
    ].join('\n');
    const result = parseYamlHillChart(source);
    expect(result.dots).toHaveLength(1);
    expect(result.errors.some(e => e.message.includes('dots[1]'))).toBe(true);
  });
});

describe('parseShorthandFormDot — out-of-range position in shorthand form', () => {
  it('shorthand 150: Label (over 100) → item dropped, no-position error emitted', () => {
    const source = 'dots:\n  - 150: Over';
    const result = parseYamlHillChart(source);
    expect(result.dots).toHaveLength(0);
    expect(result.errors.some(e => e.severity === 'warning')).toBe(true);
  });

  it('shorthand -10: Label (below 0) → item dropped, no-position error emitted', () => {
    const source = 'dots:\n  - -10: Under';
    const result = parseYamlHillChart(source);
    expect(result.dots).toHaveLength(0);
    expect(result.errors.some(e => e.severity === 'warning')).toBe(true);
  });
});

describe('parseDots — dots value is not an array', () => {
  it('dots: "not-an-array" → { dots: [], errors: [] }', () => {
    const source = 'dots: "not-an-array"';
    const result = parseYamlHillChart(source);
    expect(result.dots).toEqual([]);
    expect(result.errors).toHaveLength(0);
  });

  it('dots: 42 → { dots: [], errors: [] }', () => {
    const source = 'dots: 42';
    const result = parseYamlHillChart(source);
    expect(result.dots).toEqual([]);
    expect(result.errors).toHaveLength(0);
  });
});

describe('normalizeIndentation — mixed tab and space indentation', () => {
  it('parses dots block mixing tab-indented and space-indented entries without error', () => {
    // Reproduces the real-world vault case: some entries indented with tabs,
    // one entry indented with 4 spaces (the user typed them manually).
    const source =
      'dots:\n' +
      '\t- label: "[[P01]]"\n' +
      '\t  position: 100\n' +
      '\t- label: "[[P02]]"\n' +
      '\t  position: 99\n' +
      '\t  style:\n' +
      '\t\t  color: "#00CCd0"\n' +
      '\t- label: "[[P03]]"\n' +
      '\t  position: 0\n' +
      '    - label: "[[P04]]"\n' +
      '      position: 0\n';

    const result = parseYamlHillChart(source);

    expect(result.errors).toHaveLength(0);
    expect(result.dots).toHaveLength(4);
    // Wikilink labels like [[P01]] are stripped to their inner text by parseWikiLink.
    expect(result.dots[0].label).toBe('P01');
    expect(result.dots[0].position.toPercent()).toBe(100);
    expect(result.dots[1].label).toBe('P02');
    expect(result.dots[1].position.toPercent()).toBe(99);
    expect(result.dots[2].label).toBe('P03');
    expect(result.dots[2].position.toPercent()).toBe(0);
    expect(result.dots[3].label).toBe('P04');
    expect(result.dots[3].position.toPercent()).toBe(0);
  });
});
