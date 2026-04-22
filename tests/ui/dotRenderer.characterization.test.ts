/**
 * Characterization tests for DotRenderer.render SVG output.
 *
 * These tests pin the concrete SVG structure produced by render() so that
 * future decomposition (B9, B10, B11) cannot silently break the contract.
 *
 * Scenarios:
 *  1. Plain dot          — circle attributes, no text appended
 *  2. Dot with label     — circle + text, correct content and text-anchor
 *  3. Dot with noteLink  — dataset.noteLink and hill-chart-note-link class
 *  4. Editable mode      — cursor set, registerCleanup called
 *  5. Custom style       — fill and r match item.style
 *  6. Missing label      — no text element in SVG
 *  7. Missing noteLink   — label present but no dataset.noteLink
 *  8. Zero radius        — circle r attribute is '0'
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DotRenderer } from '../../src/ui/dotRenderer';
import type { DotRenderOptions } from '../../src/ui/dotRenderer';
import type { RenderContext } from '../../src/ui/chartChromeRenderer';
import { HillPosition } from '../../src/model/hillPosition';
import { HillCurve } from '../../src/model/hillCurve';
import { LabelLayout } from '../../src/ui/labelLayout';
import { createSharedDragState } from '../../src/ui/dotDragController';
import type { HillChartItem } from '../../src/model/hillChartConfig';
import type { LabelCeilingPolicy } from '../../src/ui/labelCeilingPolicy';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ── helpers ───────────────────────────────────────────────────────────────────

function pos(n: number): HillPosition {
  return HillPosition.fromPercent(n);
}

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  document.body.appendChild(svg);
  return svg;
}

function makeRenderContext(svg: SVGSVGElement): RenderContext {
  return {
    svg,
    size: { width: 400, height: 150 },
    baselineY: 100,
  };
}

const DEFAULT_CEILING_POLICY: LabelCeilingPolicy = {
  getCeiling: () => null,
  getMaxFontSize: () => 12,
  compute: () => {},
  reset: () => {},
} as unknown as LabelCeilingPolicy;

function makeOptions(
  svg: SVGSVGElement,
  overrides: Partial<DotRenderOptions> = {}
): DotRenderOptions {
  return {
    curve: new HillCurve(),
    size: { width: 400, height: 150 },
    labelLayout: new LabelLayout(),
    sharedDragState: createSharedDragState(),
    labelCeilingPolicy: DEFAULT_CEILING_POLICY,
    registerCleanup: vi.fn(),
    ...overrides,
  };
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('DotRenderer.render SVG output', () => {
  let svg: SVGSVGElement;
  let renderer: DotRenderer;

  beforeEach(() => {
    svg = makeSvg();
    renderer = new DotRenderer(makeRenderContext(svg));
  });

  afterEach(() => {
    if (svg.parentElement) svg.parentElement.removeChild(svg);
    vi.restoreAllMocks();
  });

  // ── 1. Plain dot ─────────────────────────────────────────────────────────

  it('plain dot renders a circle with correct cx, cy, r and fill — no text appended', () => {
    const item: HillChartItem = { position: pos(50) };
    const options = makeOptions(svg);
    const curve = options.curve;
    const size = options.size;

    const circle = renderer.render(item, 0, options);

    // Circle is in the SVG.
    expect(svg.querySelectorAll('circle').length).toBe(1);
    expect(svg.querySelectorAll('text').length).toBe(0);

    // Position matches what the curve produces for t=0.5.
    const expected = curve.toSvgPoint(0.5, size);
    expect(parseFloat(circle.getAttribute('cx') ?? '')).toBeCloseTo(expected.x);
    expect(parseFloat(circle.getAttribute('cy') ?? '')).toBeCloseTo(expected.y);

    // Default radius when no style provided.
    expect(circle.getAttribute('r')).toBe('6');

    // Default fill.
    expect(circle.getAttribute('fill')).toBe('currentColor');
  });

  it('plain dot circle carries the hill-chart-dot CSS class', () => {
    const item: HillChartItem = { position: pos(50) };
    const circle = renderer.render(item, 0, makeOptions(svg));
    expect(circle.classList.contains('hill-chart-dot')).toBe(true);
  });

  it('plain dot circle has stroke and stroke-width attributes', () => {
    const item: HillChartItem = { position: pos(50) };
    const circle = renderer.render(item, 0, makeOptions(svg));
    expect(circle.getAttribute('stroke')).toBe('var(--background-primary)');
    expect(circle.getAttribute('stroke-width')).toBe('2');
  });

  // ── 2. Dot with label ────────────────────────────────────────────────────

  it('dot with label appends a text element whose textContent matches the label', () => {
    const item: HillChartItem = { position: pos(50), label: 'My Feature' };
    renderer.render(item, 0, makeOptions(svg));

    const texts = svg.querySelectorAll('text');
    expect(texts.length).toBe(1);
    expect(texts[0].textContent).toBe('My Feature');
  });

  it('dot with label: text element has a text-anchor attribute set', () => {
    const item: HillChartItem = { position: pos(50), label: 'My Feature' };
    renderer.render(item, 0, makeOptions(svg));

    const text = svg.querySelector('text');
    expect(text).not.toBeNull();
    const anchor = text!.getAttribute('text-anchor');
    expect(['start', 'middle', 'end']).toContain(anchor);
  });

  it('dot with label: text element has dominant-baseline attribute', () => {
    const item: HillChartItem = { position: pos(50), label: 'My Feature' };
    renderer.render(item, 0, makeOptions(svg));

    const text = svg.querySelector('text');
    expect(text!.getAttribute('dominant-baseline')).toBe('middle');
  });

  // ── 3. Dot with noteLink ─────────────────────────────────────────────────

  it('dot with noteLink and onNoteClick sets dataset.noteLink on text element', () => {
    const item: HillChartItem = {
      position: pos(50),
      label: 'Linked Note',
      noteLink: 'SomeNote',
    };
    const options = makeOptions(svg, { onNoteClick: vi.fn() });
    renderer.render(item, 0, options);

    const text = svg.querySelector('text') as SVGTextElement;
    expect(text).not.toBeNull();
    expect(text.dataset.noteLink).toBe('SomeNote');
  });

  it('dot with noteLink and onNoteClick adds hill-chart-note-link CSS class to text', () => {
    const item: HillChartItem = {
      position: pos(50),
      label: 'Linked Note',
      noteLink: 'SomeNote',
    };
    const options = makeOptions(svg, { onNoteClick: vi.fn() });
    renderer.render(item, 0, options);

    const text = svg.querySelector('text');
    expect(text!.classList.contains('hill-chart-note-link')).toBe(true);
  });

  it('dot with noteLink but no onNoteClick does NOT add dataset.noteLink', () => {
    // wireNoteLinkClick short-circuits when onNoteClick is absent.
    const item: HillChartItem = {
      position: pos(50),
      label: 'Linked Note',
      noteLink: 'SomeNote',
    };
    renderer.render(item, 0, makeOptions(svg));

    const text = svg.querySelector('text') as SVGTextElement;
    expect(text.dataset.noteLink).toBeUndefined();
  });

  // ── 4. Editable mode (onPositionChange provided) ─────────────────────────

  it('editable mode: circle has hill-chart-dot class (grab cursor via CSS)', () => {
    const item: HillChartItem = { position: pos(50) };
    const options = makeOptions(svg, {
      onPositionChange: vi.fn(),
    });
    const circle = renderer.render(item, 0, options);
    // createDotCircle applies hill-chart-dot class; CSS sets cursor: grab.
    expect(circle.classList.contains('hill-chart-dot')).toBe(true);
  });

  it('editable mode: registerCleanup is called (DotDragController registered a teardown)', () => {
    const item: HillChartItem = { position: pos(50) };
    const registerCleanup = vi.fn();
    const options = makeOptions(svg, {
      onPositionChange: vi.fn(),
      registerCleanup,
    });
    renderer.render(item, 0, options);
    // At minimum one call comes from DotDragController.dispose registration.
    expect(registerCleanup).toHaveBeenCalled();
  });

  it('non-editable mode: registerCleanup is still called for hover listeners', () => {
    // Hover listeners on the circle always register cleanup, even without drag.
    const item: HillChartItem = { position: pos(50) };
    const registerCleanup = vi.fn();
    const options = makeOptions(svg, { registerCleanup });
    renderer.render(item, 0, options);
    expect(registerCleanup).toHaveBeenCalled();
  });

  // ── 5. Custom style ───────────────────────────────────────────────────────

  it('custom color in item.style sets circle fill attribute', () => {
    const item: HillChartItem = {
      position: pos(50),
      style: { color: '#ff0000' },
    };
    const circle = renderer.render(item, 0, makeOptions(svg));
    expect(circle.getAttribute('fill')).toBe('#ff0000');
  });

  it('custom radius in item.style sets circle r attribute', () => {
    const item: HillChartItem = {
      position: pos(50),
      style: { radius: 10 },
    };
    const circle = renderer.render(item, 0, makeOptions(svg));
    expect(circle.getAttribute('r')).toBe('10');
  });

  it('custom opacity in item.style sets circle fill-opacity attribute', () => {
    const item: HillChartItem = {
      position: pos(50),
      style: { opacity: 0.5 },
    };
    const circle = renderer.render(item, 0, makeOptions(svg));
    expect(circle.getAttribute('fill-opacity')).toBe('0.5');
  });

  // ── 6. Missing label edge case ────────────────────────────────────────────

  it('item with no label renders circle but no text element', () => {
    const item: HillChartItem = { position: pos(50) };
    renderer.render(item, 0, makeOptions(svg));
    expect(svg.querySelectorAll('text').length).toBe(0);
  });

  it('item with label explicitly undefined renders no text element', () => {
    const item: HillChartItem = { position: pos(50), label: undefined };
    renderer.render(item, 0, makeOptions(svg));
    expect(svg.querySelectorAll('text').length).toBe(0);
  });

  // ── 7. Missing noteLink edge case ─────────────────────────────────────────

  it('label without noteLink: text element has no dataset.noteLink', () => {
    const item: HillChartItem = { position: pos(50), label: 'No Link' };
    renderer.render(item, 0, makeOptions(svg));
    const text = svg.querySelector('text') as SVGTextElement;
    expect(text.dataset.noteLink).toBeUndefined();
  });

  it('label without noteLink: text element does not have hill-chart-note-link class', () => {
    const item: HillChartItem = { position: pos(50), label: 'No Link' };
    renderer.render(item, 0, makeOptions(svg));
    const text = svg.querySelector('text');
    expect(text!.classList.contains('hill-chart-note-link')).toBe(false);
  });

  // ── 8. Zero radius edge case ──────────────────────────────────────────────

  it('zero radius in item.style sets circle r attribute to "0"', () => {
    const item: HillChartItem = {
      position: pos(50),
      style: { radius: 0 },
    };
    const circle = renderer.render(item, 0, makeOptions(svg));
    expect(circle.getAttribute('r')).toBe('0');
  });

  // ── 9. Read-only click listener cleanup ───────────────────────────────────

  it('read-only note-link click listener is removed after cleanup', () => {
    const cleanupFns: Array<() => void> = [];
    const registerCleanup = (fn: () => void): void => { cleanupFns.push(fn); };

    const onNoteClick = vi.fn();
    const item: HillChartItem = {
      position: pos(50),
      label: 'Linked Note',
      noteLink: 'SomeNote',
    };
    // No onPositionChange → read-only mode
    const options = makeOptions(svg, { onNoteClick, registerCleanup });
    renderer.render(item, 0, options);

    const textEl = svg.querySelector('text') as SVGTextElement;
    expect(textEl).not.toBeNull();

    // Listener fires before cleanup.
    textEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onNoteClick).toHaveBeenCalledTimes(1);

    // Run all cleanups.
    cleanupFns.forEach((fn) => fn());

    // Listener must NOT fire after cleanup.
    onNoteClick.mockClear();
    textEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onNoteClick).not.toHaveBeenCalled();
  });
});
