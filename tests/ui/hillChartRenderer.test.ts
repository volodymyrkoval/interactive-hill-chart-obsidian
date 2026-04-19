import { HillPosition } from "../../src/model/hillPosition";
function pos(n: number): HillPosition { return HillPosition.fromPercent(n); }
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HillChartRenderer } from '../../src/ui/hillChartRenderer';
import { computeLabelPlacement } from '../../src/ui/labelPlacement';
import { LEFT_ANCHOR_THRESHOLD, MIDDLE_ANCHOR_HI, MIDDLE_ANCHOR_LO } from '../../src/ui/labelPlacement';
import { resolveDotStyle } from '../../src/ui/dotStyle';
import { HillCurve } from '../../src/model/hillCurve';
import { parseYamlHillChart } from '../../src/obsidian/parseYamlHillChart';
import type { Curve } from '../../src/model/curve';
import type { HillChartConfig, HillChartItem } from '../../src/model/hillChartConfig';
import type { Point, Size } from '../../src/types';

/** Helper to build a minimal config from a dot array */
function cfg(dots: HillChartItem[] = [], chart?: HillChartConfig['chart']): HillChartConfig {
  return chart ? { dots, chart, errors: [] } : { dots, errors: [] };
}

/** Creates a div element and appends to document.body */
function createContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

/** Removes an element from the DOM if it has a parent */
function cleanupContainer(el: HTMLElement): void {
  if (el.parentElement) {
    el.parentElement.removeChild(el);
  }
}

describe('HillChartRenderer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('render with empty config appends SVG with zero <circle> elements', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg() });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(0);
  });

  it('render with [{ position: pos(50) }] appends one <circle> at the correct position', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50) }]) });

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(1);

    const circle = circles[0];
    const size: Size = { width: 400, height: 150 };
    const expectedPoint = curve.toSvgPoint(0.5, size);

    const cx = parseFloat(circle.getAttribute('cx') ?? '0');
    const cy = parseFloat(circle.getAttribute('cy') ?? '0');
    expect(cx).toBeCloseTo(expectedPoint.x);
    expect(cy).toBeCloseTo(expectedPoint.y);
  });

  it('render with no config (default) appends SVG with zero <circle> elements', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(0);
  });

  it('re-render after destroy leaves exactly one SVG in the container', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();

    renderer.render(container, curve, { config: cfg([{ position: pos(50) }]) });
    expect(container.querySelectorAll('svg').length).toBe(1);

    renderer.render(container, curve, { config: cfg([{ position: pos(25) }]) });
    expect(container.querySelectorAll('svg').length).toBe(1);
  });

  it('render passes t = position / 100 to toSvgPoint', () => {
    const calls: Array<{ t: number; size: Size }> = [];
    const stubCurve: Curve = {
      pointAt: (t: number): Point => ({ x: t, y: 0.5 }),
      toSvgPath: (size: Size): string => `M 0 0 L ${size.width} 0`,
      toSvgPoint: (t: number, size: Size): Point => {
        calls.push({ t, size });
        return { x: t * size.width, y: 100 };
      },
      projectToCurve: (_point: Point): number => 0.5,
      projectFromSvgPoint: (_svgPoint: Point, _size: Size): number => 0.5,
      tFromSvgX: (_svgX: number, _size: Size): number => 0.5,
    };

    const renderer = new HillChartRenderer();
    renderer.render(container, stubCurve, { config: cfg([{ position: pos(75) }]) });

    expect(calls.length).toBe(1);
    expect(calls[0].t).toBe(0.75);
  });

  it('rendered circle has r=6, fill=currentColor, stroke=var(--background-primary), stroke-width=2', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50) }]) });

    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    if (circle) {
      expect(circle.getAttribute('r')).toBe('6');
      expect(circle.getAttribute('fill')).toBe('currentColor');
      expect(circle.getAttribute('stroke')).toBe('var(--background-primary)');
      expect(circle.getAttribute('stroke-width')).toBe('2');
    }
  });

  it('two specs render two <circle> elements', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(25) }, { position: pos(75) }]) });

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });

  it('three specs render three <circle> elements at correct positions', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: cfg([
      { position: pos(10) },
      { position: pos(50) },
      { position: pos(90) },
    ]),
      },
    );

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(3);

    const size: Size = { width: 400, height: 150 };
    const positions = [10, 50, 90];
    circles.forEach((circle, i) => {
      const expected = curve.toSvgPoint(positions[i] / 100, size);
      expect(parseFloat(circle.getAttribute('cx') ?? '0')).toBeCloseTo(expected.x);
      expect(parseFloat(circle.getAttribute('cy') ?? '0')).toBeCloseTo(expected.y);
    });
  });

  it('dot at position 0 has cy equal to the chrome baseline (size.height * 0.92)', () => {
    // Guards the invariant that dots and chrome reference the same baselineY.
    // Position 0 maps to the left anchor of the curve — which sits exactly on baselineY.
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(0) }]) });

    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();

    const size: Size = { width: 400, height: 150 };
    const BASELINE_Y_RATIO = 0.92;
    const expectedBaselineY = size.height * BASELINE_Y_RATIO;

    const cy = parseFloat(circle!.getAttribute('cy') ?? '0');
    expect(cy).toBeCloseTo(expectedBaselineY);
  });
});

describe('HillChartRenderer - label rendering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('no label → 0 <text> elements', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50) }]) });

    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(0);
  });

  it('with label → 1 <text> element with correct textContent', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'My Task' }]) });

    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(1);
    expect(texts[0].textContent).toBe('My Task');
  });

  it('position 25 → text-anchor="start" (label right of dot, left zone)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(25), label: 'Early' }]) });

    const circle = container.querySelector('circle');
    const text = container.querySelector('text');
    expect(text).not.toBeNull();
    if (text && circle) {
      expect(text.getAttribute('text-anchor')).toBe('start');
      const textX = parseFloat(text.getAttribute('x') ?? '0');
      const circleX = parseFloat(circle.getAttribute('cx') ?? '0');
      expect(textX).toBeGreaterThan(circleX);
    }
  });

  it('position 75 → text-anchor="start" (label right of dot, downhill zone)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(75), label: 'Downhill' }]) });

    const circle = container.querySelector('circle');
    const text = container.querySelector('text');
    expect(text).not.toBeNull();
    if (text && circle) {
      expect(text.getAttribute('text-anchor')).toBe('start');
      const textX = parseFloat(text.getAttribute('x') ?? '0');
      const circleX = parseFloat(circle.getAttribute('cx') ?? '0');
      expect(textX).toBeGreaterThan(circleX);
    }
  });

  it('position 50 → text-anchor="middle", label above dot (peak zone)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'Center' }]) });

    const circle = container.querySelector('circle');
    const text = container.querySelector('text');
    expect(text).not.toBeNull();
    expect(circle).not.toBeNull();

    if (text && circle) {
      expect(text.getAttribute('text-anchor')).toBe('middle');
      const textY = parseFloat(text.getAttribute('y') ?? '0');
      const circleY = parseFloat(circle.getAttribute('cy') ?? '0');
      expect(textY).toBeLessThan(circleY);
    }
  });

  it('position 39 → text-anchor="start" (right of dot)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(39), label: 'Boundary Left' }]) });

    const text = container.querySelector('text');
    expect(text).not.toBeNull();
    expect(text?.getAttribute('text-anchor')).toBe('start');
  });

  it('position 40 → text-anchor="middle", label above dot', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(40), label: 'Boundary Above Low' }]) });

    const circle = container.querySelector('circle');
    const text = container.querySelector('text');
    expect(text).not.toBeNull();
    expect(circle).not.toBeNull();

    if (text && circle) {
      expect(text.getAttribute('text-anchor')).toBe('middle');
      const textY = parseFloat(text.getAttribute('y') ?? '0');
      const circleY = parseFloat(circle.getAttribute('cy') ?? '0');
      expect(textY).toBeLessThan(circleY);
    }
  });

  it('position 60 → text-anchor="middle", label above dot', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(60), label: 'Boundary Above High' }]) });

    const circle = container.querySelector('circle');
    const text = container.querySelector('text');
    expect(text).not.toBeNull();
    expect(circle).not.toBeNull();

    if (text && circle) {
      expect(text.getAttribute('text-anchor')).toBe('middle');
      const textY = parseFloat(text.getAttribute('y') ?? '0');
      const circleY = parseFloat(circle.getAttribute('cy') ?? '0');
      expect(textY).toBeLessThan(circleY);
    }
  });

  it('position 61 → text-anchor="start" (right of dot, 60-80 zone)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(61), label: 'Boundary Right' }]) });

    const text = container.querySelector('text');
    expect(text).not.toBeNull();
    expect(text?.getAttribute('text-anchor')).toBe('start');
  });

  it('position 80 → text-anchor="end" (label left of dot)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(80), label: 'Late' }]) });

    const circle = container.querySelector('circle');
    const text = container.querySelector('text');
    expect(text).not.toBeNull();
    if (text && circle) {
      expect(text.getAttribute('text-anchor')).toBe('end');
      const textX = parseFloat(text.getAttribute('x') ?? '0');
      const circleX = parseFloat(circle.getAttribute('cx') ?? '0');
      expect(textX).toBeLessThan(circleX);
    }
  });

  it('position 90 → text-anchor="end" (label left of dot)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(90), label: 'End' }]) });

    const text = container.querySelector('text');
    expect(text).not.toBeNull();
    expect(text?.getAttribute('text-anchor')).toBe('end');
  });

  it('empty dots → 0 <text> elements', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([]) });

    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(0);
  });

  it('re-render with label → still 1 <text> (no leaks)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();

    renderer.render(container, curve, { config: cfg([{ position: pos(25), label: 'First' }]) });
    expect(container.querySelectorAll('text').length).toBe(1);

    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'Second' }]) });
    expect(container.querySelectorAll('text').length).toBe(1);
    expect(container.querySelector('text')?.textContent).toBe('Second');
  });

  it('<text> has correct attributes: font-size=12, fill=currentColor, dominant-baseline=middle', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'Test' }]) });

    const text = container.querySelector('text');
    expect(text).not.toBeNull();
    if (text) {
      expect(text.getAttribute('font-size')).toBe('12');
      expect(text.getAttribute('fill')).toBe('currentColor');
      expect(text.getAttribute('dominant-baseline')).toBe('middle');
    }
  });

  it('two specs with labels → two <text> elements with correct content', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: cfg([
      { position: pos(25), label: 'Alpha' },
      { position: pos(75), label: 'Beta' },
    ]),
      },
    );

    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(2);
    expect(texts[0].textContent).toBe('Alpha');
    expect(texts[1].textContent).toBe('Beta');
  });

  it('two specs: one with label, one without → one <text> element', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: cfg([
      { position: pos(25), label: 'Only this one' },
      { position: pos(75) },
    ]),
      },
    );

    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(1);
    expect(texts[0].textContent).toBe('Only this one');
  });
});

describe('HillChartRenderer - note links', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('spec with noteLink + onNoteClick → text element has class hill-chart-note-link', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'My Note', noteLink: 'My Note' }]), onNoteClick: () => {} });
    const text = container.querySelector('text');
    expect(text?.classList.contains('hill-chart-note-link')).toBe(true);
  });

  it('spec with noteLink + onNoteClick → clicking text fires onNoteClick with note name', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const clicked: string[] = [];
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'My Note', noteLink: 'My Note' }]), onNoteClick: (name, newLeaf) => clicked.push(`${name}:${newLeaf}`) });
    const text = container.querySelector('text');
    text?.dispatchEvent(new MouseEvent('click'));
    expect(clicked).toEqual(['My Note:false']);
  });

  it('spec with noteLink + onNoteClick → clicking text with metaKey fires onNoteClick with newLeaf=true', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const clicked: string[] = [];
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'My Note', noteLink: 'My Note' }]), onNoteClick: (name, newLeaf) => clicked.push(`${name}:${newLeaf}`) });
    const text = container.querySelector('text');
    text?.dispatchEvent(new MouseEvent('click', { metaKey: true }));
    expect(clicked).toEqual(['My Note:true']);
  });

  it('spec with noteLink + onNoteClick → clicking text with ctrlKey fires onNoteClick with newLeaf=true', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const clicked: string[] = [];
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'My Note', noteLink: 'My Note' }]), onNoteClick: (name, newLeaf) => clicked.push(`${name}:${newLeaf}`) });
    const text = container.querySelector('text');
    text?.dispatchEvent(new MouseEvent('click', { ctrlKey: true }));
    expect(clicked).toEqual(['My Note:true']);
  });

  it('spec without noteLink → text has no hill-chart-note-link class', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'Plain Label' }]), onNoteClick: () => {} });
    const text = container.querySelector('text');
    expect(text?.classList.contains('hill-chart-note-link')).toBe(false);
  });

  it('spec with noteLink but no onNoteClick callback → no class added, no error', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    expect(() => {
      renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'My Note', noteLink: 'My Note' }]) });
    }).not.toThrow();
    const text = container.querySelector('text');
    expect(text?.classList.contains('hill-chart-note-link')).toBe(false);
  });
});

describe('HillChartRenderer - drag behaviour', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    cleanupContainer(container);
    vi.restoreAllMocks();
  });

  it('circle gets cursor:grab and class hill-chart-dot after render', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'Task' }]) });

    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    expect((circle as SVGElement).style.cursor).toBe('grab');
    expect(circle?.classList.contains('hill-chart-dot')).toBe(true);
  });

  it('text label does NOT get cursor:grab', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'Task' }]) });

    const text = container.querySelector('text');
    expect(text).not.toBeNull();
    expect((text as SVGElement).style.cursor).not.toBe('grab');
  });

  it('synthetic drag moves circle cx/cy when getScreenCTM is mocked', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(25) }]), onPositionChange: () => {} });

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;

    const targetSvgCoords = { x: 200, y: 58 };
    const mockSvgPoint = {
      x: 0,
      y: 0,
      matrixTransform: vi.fn().mockImplementation(() => ({ x: targetSvgCoords.x, y: targetSvgCoords.y })),
    };
    svg.createSVGPoint = vi.fn().mockReturnValue(mockSvgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    const initialCx = parseFloat(circle.getAttribute('cx') ?? '0');

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: initialCx, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 200, clientY: 58 }));

    const newCx = parseFloat(circle.getAttribute('cx') ?? '0');
    expect(newCx).not.toBe(initialCx);
    expect(newCx).toBeGreaterThan(initialCx);
  });

  it('onPositionChange fires on mouseup with correct rounded value when position changed', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const changes: Array<{ specIndex: number; newPosition: HillPosition }> = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25) }]),
        onPositionChange: (specIndex, newPosition) => changes.push({ specIndex, newPosition }),
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    svgPoint.x = 200;
    svgPoint.y = 58;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 58 }));

    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(changes.length).toBe(1);
    expect(changes[0].specIndex).toBe(0);
    expect(changes[0].newPosition.toPercent()).toBeGreaterThanOrEqual(45);
    expect(changes[0].newPosition.toPercent()).toBeLessThanOrEqual(55);
  });

  it('onPositionChange does NOT fire on mouseup when position did not change', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const changes: HillPosition[] = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(50) }]),
        onPositionChange: (_, newPos) => changes.push(newPos),
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;

    svg.getScreenCTM = vi.fn().mockReturnValue(null);
    svg.createSVGPoint = vi.fn().mockReturnValue({ x: 0, y: 0, matrixTransform: vi.fn() });

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 58 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(changes.length).toBe(0);
  });

  it('post-destroy window mousemove is harmless (no throw, no state change)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50) }]) });

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn().mockReturnValue({ x: 200, y: 58 }) };
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    renderer.destroy();

    expect(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }));
    }).not.toThrow();
  });

  it('drag far left (svgX near 0) → onPositionChange called with 0 on mouseup', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const changes: Array<{ specIndex: number; newPosition: HillPosition }> = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(50) }]),
        onPositionChange: (specIndex, newPosition) => changes.push({ specIndex, newPosition }),
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    svgPoint.x = -50;
    svgPoint.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: -50, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(changes.length).toBe(1);
    expect(changes[0].newPosition.toPercent()).toBe(0);
  });

  it('drag far right (svgX > size.width) → onPositionChange called with 100 on mouseup', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const changes: Array<{ specIndex: number; newPosition: HillPosition }> = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(50) }]),
        onPositionChange: (specIndex, newPosition) => changes.push({ specIndex, newPosition }),
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    svgPoint.x = 500;
    svgPoint.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(changes.length).toBe(1);
    expect(changes[0].newPosition.toPercent()).toBe(100);
  });

  it('drag uses x-coordinate only: same svgX but different svgY gives same position', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const changes: Array<HillPosition> = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25) }]),
        onPositionChange: (_, newPosition) => changes.push(newPosition),
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    svgPoint.x = 200;
    svgPoint.y = 10;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 10 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25) }]),
        onPositionChange: (_, newPosition) => changes.push(newPosition),
      },
    );
    const circle2 = container.querySelector('circle') as SVGCircleElement;
    const svg2 = container.querySelector('svg') as SVGSVGElement;
    const svgPoint2 = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint2.matrixTransform.mockImplementation(() => ({ x: svgPoint2.x, y: svgPoint2.y }));
    svg2.createSVGPoint = vi.fn().mockReturnValue(svgPoint2);
    svg2.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    circle2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    svgPoint2.x = 200;
    svgPoint2.y = 180;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 180 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(changes.length).toBe(2);
    expect(changes[0].toPercent()).toBe(changes[1].toPercent());
  });
});

describe('HillChartRenderer - dot style (chart.dot)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    cleanupContainer(container);
  });

  it('no chart.dot → r="6", fill="currentColor", no fill-opacity on circle', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50) }]) });
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('r')).toBe('6');
    expect(circle?.getAttribute('fill')).toBe('currentColor');
    expect(circle?.getAttribute('fill-opacity')).toBeNull();
  });

  it('chart.dot.radius: 10 → r="10"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50) }], { dot: { radius: 10 } }) });
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('r')).toBe('10');
  });

  it('chart.dot.color: "#ff0000" → fill="#ff0000"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50) }], { dot: { color: '#ff0000' } }) });
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill')).toBe('#ff0000');
  });

  it('chart.dot.opacity: 0.5 → fill-opacity="0.5"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50) }], { dot: { opacity: 0.5 } }) });
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill-opacity')).toBe('0.5');
  });

  it('no chart.dot → label font-size="12", fill="currentColor"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'Test' }]) });
    const text = container.querySelector('text');
    expect(text?.getAttribute('font-size')).toBe('12');
    expect(text?.getAttribute('fill')).toBe('currentColor');
  });

  it('chart.dot.fontSize: 18 → label font-size="18"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'Test' }], { dot: { fontSize: 18 } }) });
    const text = container.querySelector('text');
    expect(text?.getAttribute('font-size')).toBe('18');
  });

  it('chart.dot.fontColor: "#333" → label fill="#333"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'Test' }], { dot: { fontColor: '#333' } }) });
    const text = container.querySelector('text');
    expect(text?.getAttribute('fill')).toBe('#333');
  });

  it('all 5 dot style fields → all applied correctly', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(50), label: 'Task' }], {
      dot: { color: '#ff6b6b', opacity: 0.8, radius: 8, fontSize: 14, fontColor: '#444' },
    }),
      },
    );
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('r')).toBe('8');
    expect(circle?.getAttribute('fill')).toBe('#ff6b6b');
    expect(circle?.getAttribute('fill-opacity')).toBe('0.8');
    const text = container.querySelector('text');
    expect(text?.getAttribute('font-size')).toBe('14');
    expect(text?.getAttribute('fill')).toBe('#444');
  });

  it('partial chart.dot (only color) → other attributes at defaults', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'Task' }], { dot: { color: 'blue' } }) });
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('r')).toBe('6');
    expect(circle?.getAttribute('fill')).toBe('blue');
    expect(circle?.getAttribute('fill-opacity')).toBeNull();
    const text = container.querySelector('text');
    expect(text?.getAttribute('font-size')).toBe('12');
    expect(text?.getAttribute('fill')).toBe('currentColor');
  });
});

describe('HillChartRenderer - chart config (curve, baseline, width, section labels)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    cleanupContainer(container);
  });

  it('default viewBox is 0 0 400 180', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg() });
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 400 180');
  });

  it('default curve stroke is currentColor', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg() });
    const path = container.querySelector('path');
    expect(path?.getAttribute('stroke')).toBe('currentColor');
  });

  it('chart.curve.stroke overrides path stroke', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { curve: { stroke: 'var(--interactive-accent)' } }) });
    const path = container.querySelector('path');
    expect(path?.getAttribute('stroke')).toBe('var(--interactive-accent)');
  });

  it('chart.curve.strokeWidth overrides path stroke-width', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { curve: { strokeWidth: 4 } }) });
    const path = container.querySelector('path');
    expect(path?.getAttribute('stroke-width')).toBe('4');
  });

  it('chart.curve.fill overrides path fill', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { curve: { fill: 'rgba(0,0,0,0.1)' } }) });
    const path = container.querySelector('path');
    expect(path?.getAttribute('fill')).toBe('rgba(0,0,0,0.1)');
  });

  it('baseline is rendered by default', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg() });
    const line = container.querySelector('line');
    expect(line).not.toBeNull();
  });

  it('chart.baseline.visible=false hides the baseline line', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { baseline: { visible: false } }) });
    const line = container.querySelector('line');
    expect(line).toBeNull();
  });

  it('chart.baseline.opacity overrides stroke-opacity', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { baseline: { opacity: 0.8 } }) });
    const line = container.querySelector('line');
    expect(line?.getAttribute('stroke-opacity')).toBe('0.8');
  });

  it('chart.uphill.label renders a <text> at roughly x=25% of chart width', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { uphill: { label: 'Figuring things out' } }) });
    // Should render a text with this content
    const texts = Array.from(container.querySelectorAll('text'));
    const uphillText = texts.find(t => t.textContent === 'Figuring things out');
    expect(uphillText).not.toBeUndefined();
    const x = parseFloat(uphillText!.getAttribute('x') ?? '0');
    // 25% of 400 = 100
    expect(x).toBeCloseTo(100, 0);
  });

  it('chart.downhill.label renders a <text> at roughly x=75% of chart width', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { downhill: { label: 'Making it happen' } }) });
    const texts = Array.from(container.querySelectorAll('text'));
    const downhillText = texts.find(t => t.textContent === 'Making it happen');
    expect(downhillText).not.toBeUndefined();
    const x = parseFloat(downhillText!.getAttribute('x') ?? '0');
    // 75% of 400 = 300
    expect(x).toBeCloseTo(300, 0);
  });

  it('chart.uphill.fontSize is applied to the uphill label text', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { uphill: { label: 'Up', fontSize: 11 } }) });
    const texts = Array.from(container.querySelectorAll('text'));
    const uphillText = texts.find(t => t.textContent === 'Up');
    expect(uphillText?.getAttribute('font-size')).toBe('11');
  });

  it('chart.uphill.color is applied as fill', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { uphill: { label: 'Up', color: 'var(--text-muted)' } }) });
    const texts = Array.from(container.querySelectorAll('text'));
    const uphillText = texts.find(t => t.textContent === 'Up');
    expect(uphillText?.getAttribute('fill')).toBe('var(--text-muted)');
  });

  it('config.errors renders an error div above SVG', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const configWithError: HillChartConfig = {
      dots: [],
      errors: [{ message: 'Something went wrong', severity: 'error' }],
    };
    renderer.render(container, curve, { config: configWithError });
    const errorDiv = container.querySelector('.hill-chart-error');
    expect(errorDiv).not.toBeNull();
    expect(errorDiv?.textContent).toContain('Something went wrong');
  });

  it('no errors → no error div rendered', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg() });
    const errorDiv = container.querySelector('.hill-chart-error');
    expect(errorDiv).toBeNull();
  });
});

describe('renderDot — per-dot style overrides global', () => {
  let containerLocal: HTMLElement;
  beforeEach(() => { containerLocal = document.createElement('div'); });

  it('partial per-dot color only → fill from perDot, radius from global', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      containerLocal,
      curve,
      {
        config: cfg(
        [{ position: pos(50), style: { color: '#f00' } }],
        { dot: { color: '#000000', radius: 8 } },
      ),
      },
    );
    const circle = containerLocal.querySelector('circle') as SVGCircleElement;
    expect(circle.getAttribute('fill')).toBe('#f00');
    expect(circle.getAttribute('r')).toBe('8');
  });

  it('no global chart.dot, per-dot fontSize → label font-size=18, circle r=default(6)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      containerLocal,
      curve,
      {
        config: cfg(
        [{ position: pos(50), label: 'Test', style: { fontSize: 18 } }],
      ),
      },
    );
    const circle = containerLocal.querySelector('circle') as SVGCircleElement;
    const text = containerLocal.querySelector('text') as SVGTextElement;
    expect(circle.getAttribute('r')).toBe('6');
    expect(text.getAttribute('font-size')).toBe('18');
  });

  it('per-dot opacity=1 overrides global opacity=0.5; dot without override inherits 0.5', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      containerLocal,
      curve,
      {
        config: cfg(
        [
          { position: pos(25), style: { opacity: 1 } },
          { position: pos(75) },
        ],
        { dot: { opacity: 0.5 } },
      ),
      },
    );
    const circles = containerLocal.querySelectorAll('circle');
    expect(circles[0].getAttribute('fill-opacity')).toBe('1');
    expect(circles[1].getAttribute('fill-opacity')).toBe('0.5');
  });

  it('dot with no per-dot style inherits all global chart.dot values (regression)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      containerLocal,
      curve,
      {
        config: cfg(
        [{ position: pos(50), label: 'No Override' }],
        { dot: { color: '#123456', radius: 9, fontSize: 16, fontColor: '#abcdef' } },
      ),
      },
    );
    const circle = containerLocal.querySelector('circle') as SVGCircleElement;
    const text = containerLocal.querySelector('text') as SVGTextElement;
    expect(circle.getAttribute('fill')).toBe('#123456');
    expect(circle.getAttribute('r')).toBe('9');
    expect(text.getAttribute('font-size')).toBe('16');
    expect(text.getAttribute('fill')).toBe('#abcdef');
  });

  it('end-to-end: YAML parsed config with per-dot color override → correct SVG fill', () => {
    // Simulate the full flow: parse YAML → HillChartConfig → render → check SVG
    const source = [
      'chart:',
      '  dot:',
      '    color: "#000000"',
      '    radius: 6',
      'dots:',
      '  - position: 50',
      '    label: "Override"',
      '    style:',
      '      color: "#ff0000"',
    ].join('\n');
    const config = parseYamlHillChart(source);
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(containerLocal, curve, { config: config });
    const circle = containerLocal.querySelector('circle') as SVGCircleElement;
    expect(circle.getAttribute('fill')).toBe('#ff0000');
    expect(circle.getAttribute('r')).toBe('6');
    expect(config.errors).toHaveLength(0);
  });

  it('per-dot color overrides global chart.dot.color on circle fill', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      containerLocal,
      curve,
      {
        config: cfg(
        [{ position: pos(50), style: { color: '#ff0000' } }],
        { dot: { color: '#000000' } },
      ),
      },
    );
    const circle = containerLocal.querySelector('circle') as SVGCircleElement;
    expect(circle.getAttribute('fill')).toBe('#ff0000');
  });
});

describe('HillChartRenderer - center divider', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    cleanupContainer(container);
  });

  function getDividerLine(container: HTMLElement): Element | undefined {
    return Array.from(container.querySelectorAll('line')).find(
      l => l.getAttribute('x1') === '200',
    );
  }

  it('no divider config → no <line> with x1="200" in SVG', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg() });
    expect(getDividerLine(container)).toBeUndefined();
  });

  it('divider: { visible: false } → no divider line rendered', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { divider: { visible: false } }) });
    expect(getDividerLine(container)).toBeUndefined();
  });

  it('divider: { visible: true } → renders a <line> with x1="200", x2="200", y1=peakY, y2=baselineY', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { divider: { visible: true } }) });
    const line = getDividerLine(container);
    expect(line).toBeDefined();
    expect(line?.getAttribute('x1')).toBe('200');
    expect(line?.getAttribute('x2')).toBe('200');
    const size = { width: 400, height: 150 };
    const peakY = curve.toSvgPoint(0.5, size).y;
    expect(parseFloat(line?.getAttribute('y1') ?? '0')).toBeCloseTo(peakY);
    expect(line?.getAttribute('y2')).toBe('138');
  });

  it('style: "dashed" → line has stroke-dasharray="8 4"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { divider: { visible: true, style: 'dashed' } }) });
    const line = getDividerLine(container);
    expect(line?.getAttribute('stroke-dasharray')).toBe('8 4');
  });

  it('style: "dots" → line has stroke-dasharray="1 8" and stroke-linecap="round"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { divider: { visible: true, style: 'dots' } }) });
    const line = getDividerLine(container);
    expect(line?.getAttribute('stroke-dasharray')).toBe('1 8');
    expect(line?.getAttribute('stroke-linecap')).toBe('round');
  });

  it('style: "line" → no stroke-dasharray attribute', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { divider: { visible: true, style: 'line' } }) });
    const line = getDividerLine(container);
    expect(line?.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('custom stroke: "#ff0000" → line has stroke="#ff0000"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { divider: { visible: true, stroke: '#ff0000' } }) });
    const line = getDividerLine(container);
    expect(line?.getAttribute('stroke')).toBe('#ff0000');
  });

  it('custom strokeWidth: 3 → line has stroke-width="3"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { divider: { visible: true, strokeWidth: 3 } }) });
    const line = getDividerLine(container);
    expect(line?.getAttribute('stroke-width')).toBe('3');
  });

  it('default stroke → stroke="currentColor", default strokeWidth → stroke-width="1"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { divider: { visible: true } }) });
    const line = getDividerLine(container);
    expect(line?.getAttribute('stroke')).toBe('currentColor');
    expect(line?.getAttribute('stroke-width')).toBe('1');
  });
});

describe('HillChartRenderer - SECTION_LABEL_FONT_SIZE picks the larger of uphill/downhill fontSize', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    cleanupContainer(container);
  });

  it('downhill.fontSize=24 with uphill.fontSize=8 → viewBox height uses the larger fontSize (24, not 8)', () => {
    // SECTION_LABEL_FONT_SIZE is used in viewBoxHeight = height + SECTION_LABEL_OFFSET + SECTION_LABEL_FONT_SIZE
    // With uphill.fontSize=8 and downhill.fontSize=24:
    //   - Buggy (?? chain): picks 8 → viewBoxHeight = 150 + 18 + 8 = 176
    //   - Fixed (Math.max):  picks 24 → viewBoxHeight = 150 + 18 + 24 = 192
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: cfg([], { uphill: { label: 'Up', fontSize: 8 }, downhill: { label: 'Down', fontSize: 24 } }),
      },
    );
    const svg = container.querySelector('svg');
    const viewBox = svg?.getAttribute('viewBox') ?? '';
    const viewBoxHeight = parseFloat(viewBox.split(' ')[3]);
    // Should use Math.max(8, 24)=24, so height = 150 + 18 + 24 = 192
    expect(viewBoxHeight).toBe(192);
  });
});

describe('HillChartRenderer - label zone placement', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    cleanupContainer(container);
  });

  it('position=50 (peak zone 40-60) → label above dot, text-anchor="middle"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'Mid' }]) });

    const circle = container.querySelector('circle');
    const text = container.querySelector('text');
    expect(text?.getAttribute('text-anchor')).toBe('middle');
    const textY = parseFloat(text?.getAttribute('y') ?? '0');
    const circleY = parseFloat(circle?.getAttribute('cy') ?? '0');
    expect(textY).toBeLessThan(circleY);
  });

  it('position=20 (uphill zone <40) → label right of dot, text-anchor="start"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(20), label: 'Start' }]) });

    const circle = container.querySelector('circle');
    const text = container.querySelector('text');
    expect(text?.getAttribute('text-anchor')).toBe('start');
    const textX = parseFloat(text?.getAttribute('x') ?? '0');
    const circleX = parseFloat(circle?.getAttribute('cx') ?? '0');
    expect(textX).toBeGreaterThan(circleX);
  });

  it('position=70 (downhill zone 60-80) → label right of dot, text-anchor="start"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(70), label: 'Downhill' }]) });

    const circle = container.querySelector('circle');
    const text = container.querySelector('text');
    expect(text?.getAttribute('text-anchor')).toBe('start');
    const textX = parseFloat(text?.getAttribute('x') ?? '0');
    const circleX = parseFloat(circle?.getAttribute('cx') ?? '0');
    expect(textX).toBeGreaterThan(circleX);
  });

  it('position=90 (late zone ≥80) → label left of dot, text-anchor="end"', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(90), label: 'Late' }]) });

    const circle = container.querySelector('circle');
    const text = container.querySelector('text');
    expect(text?.getAttribute('text-anchor')).toBe('end');
    const textX = parseFloat(text?.getAttribute('x') ?? '0');
    const circleX = parseFloat(circle?.getAttribute('cx') ?? '0');
    expect(textX).toBeLessThan(circleX);
  });

  it('no transform attribute on label at any position', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();

    for (const pct of [0, 25, 50, 75, 100]) {
      renderer.render(container, curve, { config: cfg([{ position: pos(pct), label: 'Label' }]) });
      const text = container.querySelector('text');
      expect(text?.getAttribute('transform')).toBeNull();
    }
  });
});

describe('HillChartRenderer - label separation (two dots at same position)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    cleanupContainer(container);
  });

  it('two dots at the same position have different label y attributes', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: cfg([
      { position: pos(50), label: 'A' },
      { position: pos(50), label: 'B' },
    ]),
      },
    );
    const texts = container.querySelectorAll('text');
    const yValues = Array.from(texts).map(t => parseFloat(t.getAttribute('y') ?? '0'));
    expect(yValues[0]).not.toBeCloseTo(yValues[1], 1);
  });

  it('three dots at the same position have three distinct label y values', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: cfg([
      { position: pos(50), label: 'A' },
      { position: pos(50), label: 'B' },
      { position: pos(50), label: 'C' },
    ]),
      },
    );
    const texts = Array.from(container.querySelectorAll('text'));
    const ys = texts.map(t => parseFloat(t.getAttribute('y') ?? '0'));
    expect(ys[0]).not.toBeCloseTo(ys[1], 1);
    expect(ys[1]).not.toBeCloseTo(ys[2], 1);
    expect(ys[0]).not.toBeCloseTo(ys[2], 1);
  });

  it('two dots within threshold (delta=5) have different label y values', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: cfg([
      { position: pos(10), label: 'A' },
      { position: pos(15), label: 'B' },
    ]),
      },
    );
    const texts = Array.from(container.querySelectorAll('text'));
    const ys = texts.map(t => parseFloat(t.getAttribute('y') ?? '0'));
    expect(ys[0]).not.toBeCloseTo(ys[1], 1);
  });

  it('two dots outside threshold (delta=25) are not additionally separated', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();

    // Render without labels to find natural curve y values at positions 10 and 35
    // (start zone: labelY = dotY, no vertical offset)
    renderer.render(
      container,
      curve,
      {
        config: cfg([
      { position: pos(10), label: 'A' },
      { position: pos(35), label: 'B' },
    ]),
      },
    );
    const texts = Array.from(container.querySelectorAll('text'));
    const circles = Array.from(container.querySelectorAll('circle'));
    const labelYs = texts.map(t => parseFloat(t.getAttribute('y') ?? '0'));
    const dotYs = circles.map(c => parseFloat(c.getAttribute('cy') ?? '0'));

    // In the start zone (<40), labelY = dotY (horizontal offset only, no vertical shift)
    // separateLabels should NOT add any fan spread to singleton clusters
    // So: labelY[0] ≈ dotY[0] and labelY[1] ≈ dotY[1]
    expect(labelYs[0]).toBeCloseTo(dotYs[0], 1);
    expect(labelYs[1]).toBeCloseTo(dotYs[1], 1);
  });

  it('two dots with different text anchors are not separated', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: cfg([
      { position: pos(10), label: 'A' },
      { position: pos(90), label: 'B' },
    ]),
      },
    );
    const texts = Array.from(container.querySelectorAll('text'));
    expect(texts.length).toBe(2);
    const y0 = parseFloat(texts[0].getAttribute('y') ?? '0');
    const y1 = parseFloat(texts[1].getAttribute('y') ?? '0');
    expect(isFinite(y0)).toBe(true);
    expect(isFinite(y1)).toBe(true);
    // Both are singletons in their own anchor group — verify no fan spread occurred
    // by checking y matches the natural dot y (start zone: y = dotY; end zone: y = dotY)
    const circles = Array.from(container.querySelectorAll('circle'));
    const dotY0 = parseFloat(circles[0].getAttribute('cy') ?? '0');
    const dotY1 = parseFloat(circles[1].getAttribute('cy') ?? '0');
    expect(y0).toBeCloseTo(dotY0, 1);
    expect(y1).toBeCloseTo(dotY1, 1);
  });
});

describe('HillChartRenderer - cluster labels never overlap uphill/downhill section labels', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    cleanupContainer(container);
  });

  it('cluster of four labels near curve start (positions 0,2,4,6) stays above the uphill label', () => {
    // baselineY = 150 * 0.92 = 138. Section labels render at y = 138 + 18 = 156.
    // Without a clamp, fan spread around centerY ≈ 138 with fontSize=12 pushes the
    // bottom label to y ≈ 138 + 1.5 * 14.4 = 159.6, overlapping the uphill label.
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: cfg(
        [
          { position: pos(0), label: 'A' },
          { position: pos(2), label: 'B' },
          { position: pos(4), label: 'C' },
          { position: pos(6), label: 'D' },
        ],
        { uphill: { label: 'Uphill' }, downhill: { label: 'Downhill' } },
      ),
      },
    );

    const texts = Array.from(container.querySelectorAll('text'));
    const uphillText = texts.find(t => t.textContent === 'Uphill')!;
    const uphillY = parseFloat(uphillText.getAttribute('y') ?? '0');
    const uphillFontSize = parseFloat(uphillText.getAttribute('font-size') ?? '12');

    const dotLabelTexts = texts.filter(t => ['A', 'B', 'C', 'D'].includes(t.textContent ?? ''));
    expect(dotLabelTexts.length).toBe(4);

    // Each cluster label's bottom edge must sit above the uphill label's top edge.
    // dominant-baseline="middle" on both, so labelBottom = labelY + labelFontSize/2
    // and uphillTop = uphillY - uphillFontSize/2.
    const uphillTop = uphillY - uphillFontSize / 2;
    for (const t of dotLabelTexts) {
      const y = parseFloat(t.getAttribute('y') ?? '0');
      const fs = parseFloat(t.getAttribute('font-size') ?? '12');
      const labelBottom = y + fs / 2;
      expect(labelBottom).toBeLessThanOrEqual(uphillTop);
    }
  });
});

describe('Label placement constants', () => {
  it('LEFT_ANCHOR_THRESHOLD is defined', () => {
    expect(LEFT_ANCHOR_THRESHOLD).toBe(80);
  });

  it('MIDDLE_ANCHOR_HI is defined', () => {
    expect(MIDDLE_ANCHOR_HI).toBe(60);
  });

  it('MIDDLE_ANCHOR_LO is defined', () => {
    expect(MIDDLE_ANCHOR_LO).toBe(40);
  });
});

describe('computeLabelPlacement', () => {
  it('t=0.1 (position 10, <40 zone) → labelX=dotX+10, labelY=dotY, textAnchor="start"', () => {
    const result = computeLabelPlacement(0.1, 50, 80);
    expect(result).toEqual({ labelX: 60, labelY: 80, textAnchor: 'start' });
  });

  it('t=0.5 (position 50, 40-60 zone) → labelX=dotX, labelY=dotY-10, textAnchor="middle"', () => {
    const result = computeLabelPlacement(0.5, 200, 30);
    expect(result).toEqual({ labelX: 200, labelY: 20, textAnchor: 'middle' });
  });

  it('t=0.9 (position 90, ≥80 zone) → labelX=dotX-10, labelY=dotY, textAnchor="end"', () => {
    const result = computeLabelPlacement(0.9, 350, 90);
    expect(result).toEqual({ labelX: 340, labelY: 90, textAnchor: 'end' });
  });
});

describe('HillChartRenderer - no-regression: single-dot and non-colliding', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    cleanupContainer(container);
  });

  it('single dot label y is unchanged by separation (no side effect)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const size = { width: 400, height: 150 };
    const positionNum = 30;
    const t = positionNum / 100;
    const { x, y } = curve.toSvgPoint(t, size);
    const expected = computeLabelPlacement(t, x, y);

    renderer.render(container, curve, { config: cfg([{ position: pos(positionNum), label: 'A' }]) });
    const text = container.querySelector('text');
    expect(text).not.toBeNull();
    const actualY = parseFloat(text!.getAttribute('y') ?? '0');
    expect(actualY).toBeCloseTo(expected.labelY, 1);
  });

  it('two dots at 10 and 90 (different anchors) have y matching zone logic exactly', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const size = { width: 400, height: 150 };

    const t10 = 0.1, t90 = 0.9;
    const p10 = curve.toSvgPoint(t10, size);
    const p90 = curve.toSvgPoint(t90, size);
    const expected10 = computeLabelPlacement(t10, p10.x, p10.y);
    const expected90 = computeLabelPlacement(t90, p90.x, p90.y);

    renderer.render(
      container,
      curve,
      {
        config: cfg([
      { position: pos(10), label: 'A' },
      { position: pos(90), label: 'B' },
    ]),
      },
    );
    const texts = Array.from(container.querySelectorAll('text'));
    expect(parseFloat(texts[0].getAttribute('y') ?? '0')).toBeCloseTo(expected10.labelY, 1);
    expect(parseFloat(texts[1].getAttribute('y') ?? '0')).toBeCloseTo(expected90.labelY, 1);
  });
});

describe('HillChartRenderer - re-render hygiene', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    cleanupContainer(container);
  });

  it('calling render() twice does not accumulate stale label entries', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();

    // First render: 3 dots at same position with labels
    renderer.render(
      container,
      curve,
      {
        config: cfg([
      { position: pos(50), label: 'A' },
      { position: pos(50), label: 'B' },
      { position: pos(50), label: 'C' },
    ]),
      },
    );
    const firstCircles = container.querySelectorAll('circle').length;
    expect(firstCircles).toBe(3);

    // Count dot labels (not section labels) — should be 3
    let texts = Array.from(container.querySelectorAll('text'));
    let dotLabels = texts.filter(t => t.textContent === 'A' || t.textContent === 'B' || t.textContent === 'C');
    expect(dotLabels.length).toBe(3);

    // Second render: 1 dot with label
    renderer.render(
      container,
      curve,
      {
        config: cfg([
      { position: pos(30), label: 'X' },
    ]),
      },
    );
    const secondCircles = container.querySelectorAll('circle').length;
    expect(secondCircles).toBe(1);

    // After second render, should only have 1 dot label (no stale A, B, C)
    texts = Array.from(container.querySelectorAll('text'));
    dotLabels = texts.filter(t => t.textContent === 'A' || t.textContent === 'B' || t.textContent === 'C' || t.textContent === 'X');
    expect(dotLabels.length).toBe(1);
    expect(dotLabels[0].textContent).toBe('X');

    // Verify the single label has correct y from zone logic (no stale separation)
    const size = { width: 400, height: 150 };
    const t = 0.3;
    const { x, y: dotY } = curve.toSvgPoint(t, size);
    const expected = computeLabelPlacement(t, x, dotY);
    const actualY = parseFloat(dotLabels[0].getAttribute('y') ?? '0');
    expect(actualY).toBeCloseTo(expected.labelY, 1);
  });
});

describe('HillChartRenderer - label separation during drag', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    cleanupContainer(container);
    vi.restoreAllMocks();
  });

  it('dragging one of two colliding dots keeps both labels separated during drag', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const positionChanges: Array<[number, HillPosition]> = [];

    // Start dot A at 30 and dot B at 50 — different positions, no initial collision
    renderer.render(
      container,
      curve,
      {
        config: cfg([
      { position: pos(30), label: 'A' },
      { position: pos(50), label: 'B' },
    ]),
        onPositionChange: (idx, pos) => positionChanges.push([idx, pos]),
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circles = Array.from(container.querySelectorAll('circle'));
    const texts = Array.from(container.querySelectorAll('text'));

    // Mock getScreenCTM so onMouseMove processes the drag
    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    // Mousedown on first dot (A at position 30)
    circles[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 120, clientY: 80 }));

    // Drag dot A to svgX=200 (position 50 — same as dot B) — now they collide
    // In the 400-wide chart, position 50 maps to svgX=200
    svgPoint.x = 200;
    svgPoint.y = 50;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 50 }));

    // After drag makes A collide with B, both labels must still have different y values
    const movedY0 = parseFloat(texts[0].getAttribute('y') ?? '0');
    const movedY1 = parseFloat(texts[1].getAttribute('y') ?? '0');
    expect(movedY0).not.toBeCloseTo(movedY1, 1);

    // Cleanup
    window.dispatchEvent(new MouseEvent('mouseup'));
  });

  // ---------------------------------------------------------------------------
  // Todo 11 — Dot opacity feedback on hover and drag
  // ---------------------------------------------------------------------------
  it('dot on mouseenter reduces opacity to 0.75', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50) }]) });

    const circle = container.querySelector('circle') as SVGCircleElement;
    expect(circle).not.toBeNull();

    // Initial state: no fill-opacity or 1.0
    const initialOpacity = circle.getAttribute('fill-opacity');
    expect(initialOpacity === null || initialOpacity === '1' || initialOpacity === '1.0').toBe(true);

    // Mouseenter event
    circle.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    // After hover, opacity should be 0.75
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');
  });

  it('dot on mouseleave removes fill-opacity when no opacity configured', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50) }]) });

    const circle = container.querySelector('circle') as SVGCircleElement;

    // Hover
    circle.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Leave: attribute must be removed, not set to '1'
    circle.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(circle.hasAttribute('fill-opacity')).toBe(false);
  });

  it('dot with preset opacity=0.5 restores to 0.5 on mouseleave', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50) }], { dot: { opacity: 0.5 } }) });

    const circle = container.querySelector('circle') as SVGCircleElement;

    // Initial state
    expect(circle.getAttribute('fill-opacity')).toBe('0.5');

    // Hover
    circle.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Leave
    circle.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.5');
  });

  it('dot with no configured opacity has null fill-opacity after mouseleave (attribute removed, not set to "1")', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    // No opacity configured — effective.opacity is undefined
    renderer.render(container, curve, { config: cfg([{ position: pos(50) }]) });

    const circle = container.querySelector('circle') as SVGCircleElement;

    // Initial state: no fill-opacity attribute
    expect(circle.getAttribute('fill-opacity')).toBeNull();

    // Hover: attribute set to 0.75
    circle.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Leave: attribute must be removed, not set to '1'
    circle.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(circle.hasAttribute('fill-opacity')).toBe(false);
  });

  it('dot opacity shows hover style (0.75) when drag begins', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(25) }]), onPositionChange: () => {} });

    const circle = container.querySelector('circle') as SVGCircleElement;
    const svg = container.querySelector('svg') as SVGSVGElement;

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    // Mousedown on circle (immediately armed)
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));

    // Move well past threshold to trigger armed state
    svgPoint.x = 200;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));

    // During drag (armed state), opacity should be 0.75 (hover style)
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Cleanup
    window.dispatchEvent(new MouseEvent('mouseup'));
  });

  it('after destroy(), circle hover listeners are removed — mouseenter does not change fill-opacity', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50) }]) });

    const circle = container.querySelector('circle') as SVGCircleElement;
    expect(circle).not.toBeNull();

    // Set initial opacity to a known value
    circle.setAttribute('fill-opacity', '1');

    // Verify hover works before destroy
    circle.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Reset for the real test
    circle.setAttribute('fill-opacity', '1');

    // Destroy — this should remove all hover listeners
    renderer.destroy();

    // After destroy, mouseenter should NOT change fill-opacity
    circle.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(circle.getAttribute('fill-opacity')).toBe('1');
  });

  it('dot opacity restores after drag ends', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(25) }]), onPositionChange: () => {} });

    const circle = container.querySelector('circle') as SVGCircleElement;
    const svg = container.querySelector('svg') as SVGSVGElement;

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    // Drag sequence
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    svgPoint.x = 200;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // End drag
    window.dispatchEvent(new MouseEvent('mouseup'));

    // After mouseup, opacity should be absent (no fill-opacity configured)
    expect(circle.getAttribute('fill-opacity')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // T4 / T5 — resolvedOpacity threading: dot with no configured opacity
  //   After a full drag cycle, fill-opacity should NOT be permanently set to '1'.
  //   A dot that was rendered without any fill-opacity attribute should still
  //   have no fill-opacity attribute after drag ends.
  //   RED in T4 (parameter added but not yet used); GREEN after T5.
  // ---------------------------------------------------------------------------

  // T7 — edge case 1: armed-but-not-moved
  //   Circle mousedown immediately sets armed=true and fill-opacity='0.6'.
  //   If mouseup fires before any mousemove (no move past threshold), the drag
  //   still ends with armed=true. restoreOpacity() must remove fill-opacity, not
  //   leave it as '0.6' or set it to '1'.
  it('dot with no configured opacity has null fill-opacity after mousedown then immediate mouseup (armed-but-not-moved)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    // No opacity configured — resolvedOpacity is undefined
    renderer.render(container, curve, { config: cfg([{ position: pos(25) }]), onPositionChange: () => {} });

    const circle = container.querySelector('circle') as SVGCircleElement;

    // Confirm no fill-opacity before interaction
    expect(circle.getAttribute('fill-opacity')).toBeNull();

    // Mousedown arms immediately — sets fill-opacity to hover style (0.75)
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Mouseup without any mousemove — restoreOpacity must remove the attribute
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(circle.getAttribute('fill-opacity')).toBeNull();
  });

  it('dot with no configured opacity has null fill-opacity after drag ends (not the string "1")', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    // No opacity configured — effective.opacity is undefined
    renderer.render(container, curve, { config: cfg([{ position: pos(25) }]), onPositionChange: () => {} });

    const circle = container.querySelector('circle') as SVGCircleElement;
    const svg = container.querySelector('svg') as SVGSVGElement;

    // Confirm no fill-opacity attribute set before drag
    expect(circle.getAttribute('fill-opacity')).toBeNull();

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    // Full drag cycle: mousedown → move past threshold → mouseup
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    svgPoint.x = 200;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    // After drag, the attribute must still be null — not '1' from the string fallback bug
    expect(circle.getAttribute('fill-opacity')).toBeNull();
  });

  // T7 — edge case 2: cancelled-drag via stale activeDragSeq
  //   First drag is armed (fill-opacity='0.6'). Before it gets a mousemove, a second
  //   drag starts on the same dot (or another element bumping activeDragSeq). The
  //   first drag's onMouseMove fires and sees myDragSeq !== activeDragSeq — it must
  //   call restoreOpacity(), which removes fill-opacity for a no-opacity dot.
  it('dot with no configured opacity has null fill-opacity when first drag is cancelled by a second drag starting', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    // No opacity configured — resolvedOpacity is undefined
    renderer.render(container, curve, { config: cfg([{ position: pos(25) }]), onPositionChange: () => {} });

    const circle = container.querySelector('circle') as SVGCircleElement;
    const svg = container.querySelector('svg') as SVGSVGElement;

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    // Confirm no fill-opacity before interaction
    expect(circle.getAttribute('fill-opacity')).toBeNull();

    // First drag: mousedown arms the circle — fill-opacity set to hover style (0.75)
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Second drag starts on the same circle — bumps activeDragSeq, making first drag stale
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 110, clientY: 100 }));

    // First drag's mousemove fires (still in window listener from the first gesture).
    // It sees myDragSeq !== activeDragSeq, must call restoreOpacity() since it was armed.
    svgPoint.x = 200;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));

    // restoreOpacity() must have removed fill-opacity (not left it at '0.6' or set to '1')
    // NOTE: the second drag is still ongoing at this point (armed, fill-opacity='0.6').
    // We end it cleanly so the check is unambiguous.
    window.dispatchEvent(new MouseEvent('mouseup'));

    // After everything settles, fill-opacity must be null
    expect(circle.getAttribute('fill-opacity')).toBeNull();
  });

  it('dot hover opacity persists during drag — mouseleave during drag should not restore opacity', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(25) }]), onPositionChange: () => {} });

    const circle = container.querySelector('circle') as SVGCircleElement;
    const svg = container.querySelector('svg') as SVGSVGElement;

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    // Hover over the dot (opacity becomes 0.75)
    circle.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Start dragging from the hover state
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    // After mousedown on circle, hover style (0.75) is preserved — no separate drag opacity
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Move to trigger drag
    svgPoint.x = 200;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));

    // During drag, opacity should remain 0.75 (hover style persists)
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Simulate mouseleave firing during drag (cursor technically left the circle element
    // because it moved during the drag)
    circle.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    // isDragging flag prevents mouseleave from restoring base opacity during drag.
    // Hover opacity (0.75) persists throughout the drag gesture.
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // End drag
    window.dispatchEvent(new MouseEvent('mouseup'));

    // After drag ends with no configured opacity, fill-opacity should be removed
    expect(circle.getAttribute('fill-opacity')).toBeNull();
  });

  it('circle mousedown immediately shows hover opacity (0.75), not drag opacity (0.6)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(25) }]), onPositionChange: () => {} });

    const circle = container.querySelector('circle') as SVGCircleElement;

    // Mousedown on circle — should keep hover style, not set 0.6
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));

    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Cleanup
    window.dispatchEvent(new MouseEvent('mouseup'));
  });

  it('drag threshold crossed (mousemove > 4px) → circle still has hover opacity (0.75), not 0.6', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(25) }]), onPositionChange: () => {} });

    const circle = container.querySelector('circle') as SVGCircleElement;
    const svg = container.querySelector('svg') as SVGSVGElement;

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));

    // Move well past the 4px threshold
    svgPoint.x = 200;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));

    // Should still show hover opacity, not the old drag opacity of 0.6
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Cleanup
    window.dispatchEvent(new MouseEvent('mouseup'));
  });
});

describe('HillChartRenderer - label hover opacity (dot feedback on label mouseenter)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('label on mouseenter reduces associated dot opacity to 0.75', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'My Task' }]) });

    const circle = container.querySelector('circle') as SVGCircleElement;
    const textEl = container.querySelector('text') as SVGTextElement;
    expect(circle).not.toBeNull();
    expect(textEl).not.toBeNull();

    // Initial state: no fill-opacity or 1.0
    const initialOpacity = circle.getAttribute('fill-opacity');
    expect(initialOpacity === null || initialOpacity === '1' || initialOpacity === '1.0').toBe(true);

    // Mouseenter on label
    textEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    // After label hover, dot opacity should be 0.75
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');
  });

  it('label on mouseleave removes fill-opacity on dot when no opacity configured', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'My Task' }]) });

    const circle = container.querySelector('circle') as SVGCircleElement;
    const textEl = container.querySelector('text') as SVGTextElement;

    // Hover label
    textEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Leave label: attribute must be removed, not set to '1'
    textEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(circle.hasAttribute('fill-opacity')).toBe(false);
  });

  it('label with preset dot opacity=0.5 restores to 0.5 on mouseleave', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'Task' }], { dot: { opacity: 0.5 } }) });

    const circle = container.querySelector('circle') as SVGCircleElement;
    const textEl = container.querySelector('text') as SVGTextElement;

    // Initial state
    expect(circle.getAttribute('fill-opacity')).toBe('0.5');

    // Hover
    textEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Leave
    textEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.5');
  });

  it('label with no configured opacity has null fill-opacity on dot after mouseleave (attribute removed, not set to "1")', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    // No opacity configured — effective.opacity is undefined
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'My Task' }]) });

    const circle = container.querySelector('circle') as SVGCircleElement;
    const textEl = container.querySelector('text') as SVGTextElement;

    // Initial state: no fill-opacity attribute on dot
    expect(circle.getAttribute('fill-opacity')).toBeNull();

    // Hover label: dot gets 0.75
    textEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Leave label: attribute must be removed, not set to '1'
    textEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(circle.hasAttribute('fill-opacity')).toBe(false);
  });
});

describe('HillChartRenderer - label drag (P03)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    cleanupContainer(container);
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Todo 1 — label click opens note via capture-phase handler
  // ---------------------------------------------------------------------------
  it('todo1: mousedown + mouseup on label (no movement) → onNoteClick called once', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const clicked: string[] = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25), label: 'My Task', noteLink: 'My Task' }]),
        onNoteClick: (name, newLeaf) => clicked.push(`${name}:${newLeaf}`),
        onPositionChange: () => {},
      },
    );

    const textEl = container.querySelector('text') as SVGTextElement;
    textEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    textEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 100, clientY: 100 }));
    // fire the click that the browser would normally synthesize
    textEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(clicked).toEqual(['My Task:false']);
  });

  // ---------------------------------------------------------------------------
  // Todo 11 — Two labels, interleaved gestures are independent
  // ---------------------------------------------------------------------------
  it('todo11: mousedown on label A then label B; drag B → only dot B moves; label A click still works', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const clickedA: string[] = [];
    const clickedB: string[] = [];
    const positionsA: HillPosition[] = [];
    const positionsB: HillPosition[] = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([
        { position: pos(25), label: 'A', noteLink: 'A' },
        { position: pos(75), label: 'B', noteLink: 'B' },
      ]),
        onNoteClick: (name, newLeaf) => {
        if (name === 'A') clickedA.push(`${name}:${newLeaf}`);
        else clickedB.push(`${name}:${newLeaf}`);
      },
        onPositionChange: (specIndex, pos) => {
        if (specIndex === 0) positionsA.push(pos);
        else positionsB.push(pos);
      },
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circles = Array.from(container.querySelectorAll('circle')) as SVGCircleElement[];
    const texts = Array.from(container.querySelectorAll('text')) as SVGTextElement[];
    const textA = texts[0];
    const textB = texts[1];

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    const initialCxA = circles[0].getAttribute('cx');
    const initialCxB = circles[1].getAttribute('cx');

    // Mousedown on label A (starts A's drag gesture without arming)
    textA.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));

    // Immediately mousedown on label B (starts B's gesture; A's active flag should be overridden)
    textB.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 100 }));

    // Move well past threshold (60px from B's start)
    svgPoint.x = 360; svgPoint.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 360, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    // Dot B should have moved
    expect(circles[1].getAttribute('cx')).not.toBe(initialCxB);
    expect(positionsB.length).toBeGreaterThan(0);

    // Dot A should NOT have moved
    expect(circles[0].getAttribute('cx')).toBe(initialCxA);
    expect(positionsA).toHaveLength(0);

    // Clicking label A should still work (suppressNextClick on A is not set)
    textA.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clickedA).toEqual(['A:false']);
  });

  // ---------------------------------------------------------------------------
  // Todo 10 — Cursor state during armed drag
  // ---------------------------------------------------------------------------
  it('todo10: label mousedown (no movement) → cursor grab; after threshold → grabbing; after mouseup → grab', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25), label: 'Task', noteLink: 'Task' }]),
        onNoteClick: () => {},
        onPositionChange: () => {},
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;
    const textEl = container.querySelector('text') as SVGTextElement;

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    // Initial state: cursor grab
    expect(circle.style.cursor).toBe('grab');

    // Mousedown on label (no movement yet)
    textEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    // Cursor should remain grab (not armed yet)
    expect(circle.style.cursor).toBe('grab');

    // Move past threshold
    svgPoint.x = 200; svgPoint.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));
    // Now armed → cursor grabbing
    expect(circle.style.cursor).toBe('grabbing');

    // Mouseup → cursor back to grab
    window.dispatchEvent(new MouseEvent('mouseup'));
    expect(circle.style.cursor).toBe('grab');
  });

  // ---------------------------------------------------------------------------
  // Todo 2 — Hoist label hover handlers and cleanup
  // ---------------------------------------------------------------------------
  it('after destroy(), label hover listeners are removed — mouseenter does not change circle fill-opacity', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50), label: 'Task' }]) });

    const circle = container.querySelector('circle') as SVGCircleElement;
    const textEl = container.querySelector('text') as SVGTextElement;
    expect(circle).not.toBeNull();
    expect(textEl).not.toBeNull();

    // Set initial opacity to a known value
    circle.setAttribute('fill-opacity', '1');

    // Verify label hover works before destroy
    textEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    // Reset for the real test
    circle.setAttribute('fill-opacity', '1');

    // Destroy — this should remove all label hover listeners
    renderer.destroy();

    // After destroy, label mouseenter should NOT change fill-opacity
    textEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(circle.getAttribute('fill-opacity')).toBe('1');
  });

  // ---------------------------------------------------------------------------
  // Todo 9 — Cleanup after destroy()
  // ---------------------------------------------------------------------------
  it('todo9: after destroy(), mousedown and click on textEl fire no callbacks and throw no errors', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const clicked: string[] = [];
    const positionChanges: HillPosition[] = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25), label: 'Task', noteLink: 'Task' }]),
        onNoteClick: (name, newLeaf) => clicked.push(`${name}:${newLeaf}`),
        onPositionChange: (_, pos) => positionChanges.push(pos),
      },
    );

    // Keep reference to textEl before destroy removes the SVG
    const textEl = container.querySelector('text') as SVGTextElement;

    renderer.destroy();

    expect(() => {
      textEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
      textEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }).not.toThrow();

    expect(clicked).toHaveLength(0);
    expect(positionChanges).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Todo 8 — Label without noteLink is drag-only
  // ---------------------------------------------------------------------------
  it('todo8: dot with label but no noteLink → drag works; no error on mouseup; no click handler', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const positionChanges: HillPosition[] = [];

    expect(() => {
      renderer.render(
        container,
        curve,
        {
          config: cfg([{ position: pos(25), label: 'No Link' }]),
          onPositionChange: (_, pos) => positionChanges.push(pos),
        },
      );
    }).not.toThrow();

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;
    const textEl = container.querySelector('text') as SVGTextElement;

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    const initialCx = parseFloat(circle.getAttribute('cx') ?? '0');

    // Drag via label — should work without error
    expect(() => {
      textEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
      svgPoint.x = 200; svgPoint.y = 100;
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    }).not.toThrow();

    // Circle should have moved
    const newCx = parseFloat(circle.getAttribute('cx') ?? '0');
    expect(newCx).not.toBe(initialCx);
    expect(positionChanges.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Todo 7 — Circle drag unchanged (regression guard)
  // ---------------------------------------------------------------------------
  it('todo7: circle mousedown + move + mouseup → position changes and onPositionChange fires (no click handler involved)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const clicked: string[] = [];
    const positionChanges: Array<{ specIndex: number; newPosition: HillPosition }> = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25), label: 'Task', noteLink: 'Task' }]),
        onNoteClick: (name, newLeaf) => clicked.push(`${name}:${newLeaf}`),
        onPositionChange: (specIndex, newPosition) => positionChanges.push({ specIndex, newPosition }),
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    const initialCx = parseFloat(circle.getAttribute('cx') ?? '0');

    // Mousedown on circle (immediately armed, no threshold)
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));

    // Move to svgX=200 (well beyond threshold)
    svgPoint.x = 200; svgPoint.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    // Circle should have moved
    const newCx = parseFloat(circle.getAttribute('cx') ?? '0');
    expect(newCx).not.toBe(initialCx);

    // onPositionChange should have been called
    expect(positionChanges.length).toBe(1);
    expect(positionChanges[0].specIndex).toBe(0);

    // onNoteClick should NOT be called (circle has no click handler)
    expect(clicked).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Todo 6 — Synthetic click after drag is suppressed; flag resets for next click
  // ---------------------------------------------------------------------------
  it('todo6a: after full drag, synthetic click on textEl → onNoteClick NOT called', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const clicked: string[] = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25), label: 'Task', noteLink: 'Task' }]),
        onNoteClick: (name, newLeaf) => clicked.push(`${name}:${newLeaf}`),
        onPositionChange: () => {},
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const textEl = container.querySelector('text') as SVGTextElement;
    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    // Full drag
    textEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    svgPoint.x = 200; svgPoint.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    // Synthetic click that browser emits after mousedown+mouseup
    textEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicked).toHaveLength(0);
  });

  it('todo6b: after drag suppression, a fresh below-threshold gesture → onNoteClick IS called', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const clicked: string[] = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25), label: 'Task', noteLink: 'Task' }]),
        onNoteClick: (name, newLeaf) => clicked.push(`${name}:${newLeaf}`),
        onPositionChange: () => {},
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const textEl = container.querySelector('text') as SVGTextElement;
    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    // Full drag (sets suppressNextClick = true)
    textEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    svgPoint.x = 200; svgPoint.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    // First click is suppressed (and resets the flag)
    textEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicked).toHaveLength(0);

    // Second click: flag is now false → onNoteClick should fire
    textEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    textEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicked).toEqual(['Task:false']);
  });

  // ---------------------------------------------------------------------------
  // Todo 5 — Edge case: drag then return to origin
  // ---------------------------------------------------------------------------
  it('todo5: mousedown → move 60px away → move back to origin → mouseup: armed; onNoteClick NOT called; onPositionChange NOT called (same position)', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const clicked: string[] = [];
    const positionChanges: HillPosition[] = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(50), label: 'Task', noteLink: 'Task' }]),
        onNoteClick: (name, newLeaf) => clicked.push(`${name}:${newLeaf}`),
        onPositionChange: (_, pos) => positionChanges.push(pos),
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const textEl = container.querySelector('text') as SVGTextElement;

    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    // mousedown at (200, 100) — position 50 maps to svgX ≈ 200 on 400-wide chart
    textEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 200, clientY: 100 }));

    // Move far right (arm the gesture)
    svgPoint.x = 260; svgPoint.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 260, clientY: 100 }));

    // Move back to origin svgX (position 50)
    svgPoint.x = 200; svgPoint.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));

    window.dispatchEvent(new MouseEvent('mouseup'));

    // Gesture was armed → click suppressed
    textEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicked).toHaveLength(0);

    // Position returned to original (50) → onPositionChange NOT called
    expect(positionChanges).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Todo 4 — Edge case: exactly at threshold
  // ---------------------------------------------------------------------------
  it('todo4a: label mousemove Δ=4px → armed (drag), onPositionChange called', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const positionChanges: HillPosition[] = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25), label: 'Task', noteLink: 'Task' }]),
        onNoteClick: () => {},
        onPositionChange: (_, pos) => positionChanges.push(pos),
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const textEl = container.querySelector('text') as SVGTextElement;
    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    textEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    svgPoint.x = 200; svgPoint.y = 100;
    // Δ = |104 - 100| = 4 (exactly at threshold → armed)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 104, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    // If armed, position changed from 25 to something near 50 (svgX=200 on 400-wide chart)
    expect(positionChanges.length).toBeGreaterThan(0);
  });

  it('todo4b: label mousemove Δ=3px → NOT armed (click), onPositionChange NOT called', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const positionChanges: HillPosition[] = [];
    const clicked: string[] = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25), label: 'Task', noteLink: 'Task' }]),
        onNoteClick: (name, newLeaf) => clicked.push(`${name}:${newLeaf}`),
        onPositionChange: (_, pos) => positionChanges.push(pos),
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const textEl = container.querySelector('text') as SVGTextElement;
    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn().mockReturnValue({ x: 103, y: 100 }) };
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    textEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    // Δ = |103 - 100| = 3 (below threshold → NOT armed)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 103, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(positionChanges).toHaveLength(0);
    // Subsequent click should fire onNoteClick (not suppressed)
    textEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicked).toEqual(['Task:false']);
  });

  // ---------------------------------------------------------------------------
  // Todo 3 — label mousedown exceeding threshold drags the dot
  // ---------------------------------------------------------------------------
  it('todo3: label mousedown at (100,100) → mousemove to (160,100) → mouseup → circle cx updated; onPositionChange called; onNoteClick NOT called', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const clicked: string[] = [];
    const positionChanges: Array<{ specIndex: number; newPosition: HillPosition }> = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25), label: 'My Task', noteLink: 'My Task' }]),
        onNoteClick: (name, newLeaf) => clicked.push(`${name}:${newLeaf}`),
        onPositionChange: (specIndex, newPosition) => positionChanges.push({ specIndex, newPosition }),
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;
    const textEl = container.querySelector('text') as SVGTextElement;

    // Mock SVG coordinate transform: clientX maps directly to svgX
    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    const initialCx = parseFloat(circle.getAttribute('cx') ?? '0');

    // mousedown on label, move 60px (above 4px threshold), mouseup
    textEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    svgPoint.x = 160;
    svgPoint.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 160, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    // circle cx must have changed
    const newCx = parseFloat(circle.getAttribute('cx') ?? '0');
    expect(newCx).not.toBe(initialCx);

    // onPositionChange must have been called
    expect(positionChanges.length).toBeGreaterThan(0);

    // onNoteClick must NOT be called (drag suppresses click)
    textEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicked).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Todo 2 — label mousedown below threshold is a click, not a drag
  // ---------------------------------------------------------------------------
  it('todo2: label mousedown + mousemove 2px + mouseup → onPositionChange NOT called; onNoteClick called; circle unchanged', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const clicked: string[] = [];
    const positionChanges: Array<{ specIndex: number; newPosition: HillPosition }> = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25), label: 'My Task', noteLink: 'My Task' }]),
        onNoteClick: (name, newLeaf) => clicked.push(`${name}:${newLeaf}`),
        onPositionChange: (specIndex, newPosition) => positionChanges.push({ specIndex, newPosition }),
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;
    const textEl = container.querySelector('text') as SVGTextElement;

    // Mock SVG point (shouldn't be used for sub-threshold move, but set up anyway)
    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn().mockReturnValue({ x: 102, y: 100 }) };
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    const initialCx = circle.getAttribute('cx');
    const initialCy = circle.getAttribute('cy');

    // mousedown on label, move 2px (below 4px threshold), mouseup
    textEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 102, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    // Simulate the click the browser synthesizes after mousedown+mouseup
    textEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(positionChanges).toHaveLength(0);
    expect(clicked).toEqual(['My Task:false']);
    expect(circle.getAttribute('cx')).toBe(initialCx);
    expect(circle.getAttribute('cy')).toBe(initialCy);
  });
});

describe('resolveDotStyle — field-by-field merge', () => {
  it('per-dot wins on all 5 fields when both global and perDot are set', () => {
    const global = { color: '#000', opacity: 0.5, radius: 6, fontSize: 12, fontColor: '#111' };
    const perDot = { color: '#f00', opacity: 1, radius: 10, fontSize: 18, fontColor: '#fff' };
    const result = resolveDotStyle(global, perDot);
    expect(result.color).toBe('#f00');
    expect(result.opacity).toBe(1);
    expect(result.radius).toBe(10);
    expect(result.fontSize).toBe(18);
    expect(result.fontColor).toBe('#fff');
  });

  it('global fills gaps when perDot fields are absent', () => {
    const global = { color: '#000', radius: 6 };
    const perDot = { color: '#f00' };
    const result = resolveDotStyle(global, perDot);
    expect(result.color).toBe('#f00');
    expect(result.radius).toBe(6);
  });

  it('undefined in both global and perDot → field is undefined', () => {
    const result = resolveDotStyle({}, {});
    expect(result.color).toBeUndefined();
    expect(result.opacity).toBeUndefined();
    expect(result.radius).toBeUndefined();
    expect(result.fontSize).toBeUndefined();
    expect(result.fontColor).toBeUndefined();
  });

  it('no perDot → returns global values', () => {
    const global = { color: 'blue', fontSize: 14 };
    const result = resolveDotStyle(global, undefined);
    expect(result.color).toBe('blue');
    expect(result.fontSize).toBe(14);
  });

  it('no global → returns perDot values', () => {
    const perDot = { radius: 8, fontColor: 'red' };
    const result = resolveDotStyle(undefined, perDot);
    expect(result.radius).toBe(8);
    expect(result.fontColor).toBe('red');
  });
});

// ── Canary: renderer must use schema-driven resolver ──────────────────────────
//
// Mutating `styleSchema` at runtime must be reflected in the rendered SVG.
// This test will FAIL today because HillChartRenderer imports `resolveChartStyle`
// from `../model/chartStyle` (hardcoded defaults) instead of the schema-driven
// resolver in `../obsidian/resolvedStylesApplier`.
//
// Fix: wire HillChartRenderer to use the schema-driven resolver so that a single
// mutation to styleSchema propagates all the way to the rendered output.

import { styleSchema } from '../../src/obsidian/styleSchema';

describe('HillChartRenderer — schema-driven resolver canary', () => {
  const CANARY_COLOR = '#abcdef';
  let originalCurveStroke: string;

  beforeEach(() => {
    // Record the original default so afterEach can restore it.
    const curveStrokeDescriptor = styleSchema.find(
      (d) => d.group === 'curve' && d.key === 'stroke',
    );
    originalCurveStroke = (curveStrokeDescriptor?.kind as { kind: 'color'; default: string }).default;
    // Mutate the schema default — the ONLY change made here.
    if (curveStrokeDescriptor) {
      (curveStrokeDescriptor.kind as { kind: string; default: unknown }).default = CANARY_COLOR;
    }
  });

  afterEach(() => {
    // Restore the original default so this test doesn't pollute the suite.
    const curveStrokeDescriptor = styleSchema.find(
      (d) => d.group === 'curve' && d.key === 'stroke',
    );
    if (curveStrokeDescriptor) {
      (curveStrokeDescriptor.kind as { kind: string; default: unknown }).default = originalCurveStroke;
    }
  });

  it('mutated curve.stroke default in styleSchema is reflected in the rendered SVG path', () => {
    const container = document.createElement('div');
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();

    // Render with no chart style overrides — should pick up the schema default.
    renderer.render(container, curve, { config: { dots: [], errors: [] } });

    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    // This assertion FAILS today: the renderer uses the hardcoded resolver which
    // returns 'currentColor' regardless of styleSchema mutations.
    expect(path!.getAttribute('stroke')).toBe(CANARY_COLOR);
  });
});

// ---------------------------------------------------------------------------
// W1 edge cases — undefined config.chart and explicitly empty style groups
// ---------------------------------------------------------------------------
describe('HillChartRenderer - edge cases: undefined config.chart and empty style groups', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    cleanupContainer(container);
  });

  it('config.chart undefined → render does not throw', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const config: HillChartConfig = { dots: [{ position: pos(50) }], errors: [] };
    expect(() => renderer.render(container, curve, { config })).not.toThrow();
  });

  it('config.chart undefined → SVG is rendered with one circle', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    const config: HillChartConfig = { dots: [{ position: pos(50) }], errors: [] };
    renderer.render(container, curve, { config });
    expect(container.querySelectorAll('circle').length).toBe(1);
  });

  // Opt-in fields: divider.visible, dot.opacity, uphill.label, downhill.label
  // When the group is explicitly {} (empty object), these must remain undefined —
  // not fall back to their schema defaults.

  it('chart.divider={} → divider.visible is undefined → no divider line rendered', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { divider: {} }) });
    const dividerLine = Array.from(container.querySelectorAll('line')).find(
      l => l.getAttribute('x1') === '200',
    );
    expect(dividerLine).toBeUndefined();
  });

  it('chart.dot={} → dot.opacity is undefined → no fill-opacity attribute on circle', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([{ position: pos(50) }], { dot: {} }) });
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill-opacity')).toBeNull();
  });

  it('chart.uphill={} → uphill.label is undefined → no uphill section label rendered', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { uphill: {} }) });
    // No section label text should appear (no dots → no dot labels either)
    expect(container.querySelectorAll('text').length).toBe(0);
  });

  it('chart.downhill={} → downhill.label is undefined → no downhill section label rendered', () => {
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();
    renderer.render(container, curve, { config: cfg([], { downhill: {} }) });
    expect(container.querySelectorAll('text').length).toBe(0);
  });
});
