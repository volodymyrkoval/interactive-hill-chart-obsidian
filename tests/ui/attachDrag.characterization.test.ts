/**
 * Characterization tests for HillChartRenderer.attachDrag
 *
 * These tests pin the existing drag state-machine behavior so future
 * extractions cannot silently break it.
 *
 * Behaviors covered:
 *  1. arm-on-threshold: drag does not arm (no cursor/opacity change) until
 *     the pointer has moved ≥ DRAG_THRESHOLD_PX (4 px) from the label mousedown.
 *  2. mouse-move updates dot circle position + label position once armed.
 *  3. mouse-up writes (calls onPositionChange) after an armed drag.
 *  4. click-without-drag on a label fires onNoteClick (note link).
 *  5. interleaved-drag preemption: a second mousedown cancels the first drag.
 *  6. opacity restore on success path (normal drag → mouseup).
 *  7. opacity restore on cancel path (drag preempted by second mousedown).
 */

import { HillPosition } from "../../src/model/hillPosition";
function pos(n: number): HillPosition { return HillPosition.fromPercent(n); }
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HillChartRenderer } from '../../src/ui/hillChartRenderer';
import { HillCurve } from '../../src/model/hillCurve';
import type { HillChartConfig, HillChartItem } from '../../src/model/hillChartConfig';

// ── helpers ──────────────────────────────────────────────────────────────────

function cfg(dots: HillChartItem[] = []): HillChartConfig {
  return { dots, errors: [] };
}

function createContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function cleanupContainer(el: HTMLElement): void {
  if (el.parentElement) el.parentElement.removeChild(el);
}

/** Returns a mock SVG CTM setup so coord transforms work predictably. */
function mockCtm(svg: SVGSVGElement, svgCoords: { x: number; y: number }): void {
  const svgPoint = {
    x: svgCoords.x,
    y: svgCoords.y,
    matrixTransform: vi.fn().mockImplementation(() => ({ x: svgCoords.x, y: svgCoords.y })),
  };
  svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
  svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });
}

/** Mutable SVG point — update .x/.y before each mousemove dispatch. */
function makeMutableSvgPoint(svg: SVGSVGElement): { x: number; y: number } {
  const pt = { x: 0, y: 0 };
  const svgPoint = {
    x: 0,
    y: 0,
    matrixTransform: vi.fn().mockImplementation(() => ({ x: pt.x, y: pt.y })),
  };
  svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
  svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });
  return pt;
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('attachDrag characterization', () => {
  let container: HTMLElement;
  let curve: HillCurve;

  beforeEach(() => {
    container = createContainer();
    curve = new HillCurve();
  });

  afterEach(() => {
    cleanupContainer(container);
    vi.restoreAllMocks();
    // clean up any window listeners left by unfinished drags
    window.dispatchEvent(new MouseEvent('mouseup'));
  });

  // ── 1. arm-on-threshold ─────────────────────────────────────────────────

  it('label mousedown below DRAG_THRESHOLD_PX does not arm (cursor stays grab, cx unchanged)', () => {
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
    const text = container.querySelector('text') as SVGTextElement;

    const pt = makeMutableSvgPoint(svg);
    const initialCx = parseFloat(circle.getAttribute('cx') ?? '0');

    // mousedown at (10, 10)
    text.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));

    // move only 3 px — below threshold of 4 px
    pt.x = 50; pt.y = 50;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 13, clientY: 10 }));

    // grabbing class must not be applied (unarmed)
    expect(circle.classList.contains('hill-chart-dot--grabbing')).toBe(false);

    // circle should not have moved
    const cx = parseFloat(circle.getAttribute('cx') ?? '0');
    expect(cx).toBeCloseTo(initialCx);
  });

  it('label mousedown ≥ DRAG_THRESHOLD_PX arms drag (cursor becomes grabbing)', () => {
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25), label: 'Task' }]),
        onPositionChange: () => {},
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;
    const text = container.querySelector('text') as SVGTextElement;

    makeMutableSvgPoint(svg);

    text.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));

    // move 5 px — at/above threshold
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 15, clientY: 10 }));

    expect(circle.classList.contains('hill-chart-dot--grabbing')).toBe(true);
  });

  // ── 2. mouse-move updates position + label ───────────────────────────────

  it('mouse-move after circle mousedown updates circle cx and label x', () => {
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(25), label: 'Task' }]),
        onPositionChange: () => {},
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;
    const text = container.querySelector('text') as SVGTextElement;

    const pt = makeMutableSvgPoint(svg);

    const initialCx = parseFloat(circle.getAttribute('cx') ?? '0');
    const initialLabelX = parseFloat(text.getAttribute('x') ?? '0');

    // circle mousedown arms immediately (no threshold)
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));

    // move right into the center area
    pt.x = 200; pt.y = 58;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 58 }));

    const newCx = parseFloat(circle.getAttribute('cx') ?? '0');
    const newLabelX = parseFloat(text.getAttribute('x') ?? '0');

    expect(newCx).not.toBeCloseTo(initialCx);
    expect(newLabelX).not.toBeCloseTo(initialLabelX);
  });

  // ── 3. mouse-up writes (calls onPositionChange) ──────────────────────────

  it('mouse-up after armed drag calls onPositionChange with specIndex and new position', () => {
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

    const pt = makeMutableSvgPoint(svg);

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));

    pt.x = 300; pt.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(changes.length).toBe(1);
    expect(changes[0].specIndex).toBe(0);
    expect(changes[0].newPosition.toPercent()).toBeGreaterThan(0);
  });

  it('mouse-up without any move does not call onPositionChange (position unchanged)', () => {
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

    // getScreenCTM returns null → t stays at initialPosition
    svg.getScreenCTM = vi.fn().mockReturnValue(null);
    svg.createSVGPoint = vi.fn().mockReturnValue({ x: 0, y: 0, matrixTransform: vi.fn() });

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 0 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(changes.length).toBe(0);
  });

  // ── 4. click-without-drag triggers note link ─────────────────────────────

  it('label click without prior drag fires onNoteClick', () => {
    const renderer = new HillChartRenderer();
    const clicks: string[] = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(50), label: 'My Note', noteLink: 'My Note' }]),
        onNoteClick: (name) => clicks.push(name),
        onPositionChange: () => {},
      },
    );

    const text = container.querySelector('text') as SVGTextElement;

    // mousedown then immediate mouseup with no move → no arm → click fires
    text.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    text.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(clicks).toEqual(['My Note']);
  });

  it('label click after a completed drag is suppressed (suppressNextClick)', () => {
    const renderer = new HillChartRenderer();
    const clicks: string[] = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(50), label: 'My Note', noteLink: 'My Note' }]),
        onNoteClick: (name) => clicks.push(name),
        onPositionChange: () => {},
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;
    const text = container.querySelector('text') as SVGTextElement;

    const pt = makeMutableSvgPoint(svg);

    // arm via circle mousedown (no threshold)
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    pt.x = 200; pt.y = 58;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 58 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    // browser fires click after mouseup; it should be suppressed
    text.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(clicks).toEqual([]);
  });

  // ── 5. interleaved-drag preemption ───────────────────────────────────────

  it('second mousedown on second dot cancels first drag: first dot circle does not move after preemption', () => {
    const renderer = new HillChartRenderer();
    const changes: Array<{ specIndex: number; newPosition: HillPosition }> = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([
        { position: pos(20) },
        { position: pos(80) },
      ]),
        onPositionChange: (specIndex, newPosition) => changes.push({ specIndex, newPosition }),
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circles = container.querySelectorAll('circle');
    const circle1 = circles[0] as SVGCircleElement;
    const circle2 = circles[1] as SVGCircleElement;

    const pt = makeMutableSvgPoint(svg);

    // Start drag on dot 1
    circle1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    pt.x = 150; pt.y = 80;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 80 }));

    const cx1AfterFirstMove = parseFloat(circle1.getAttribute('cx') ?? '0');

    // Start drag on dot 2 — this increments activeDragSeq, preempting dot 1
    circle2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));

    // Move again — dot 1 should NOT move further (its drag was cancelled)
    pt.x = 50; pt.y = 80;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 80 }));

    const cx1AfterPreemption = parseFloat(circle1.getAttribute('cx') ?? '0');

    // dot 1's circle position should not have changed after the preemption
    expect(cx1AfterPreemption).toBeCloseTo(cx1AfterFirstMove);
  });

  it('second mousedown cancels first drag: onPositionChange is not called for the preempted drag', () => {
    const renderer = new HillChartRenderer();
    const changes: Array<{ specIndex: number }> = [];

    renderer.render(
      container,
      curve,
      {
        config: cfg([
        { position: pos(20) },
        { position: pos(80) },
      ]),
        onPositionChange: (specIndex) => changes.push({ specIndex }),
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circles = container.querySelectorAll('circle');
    const circle1 = circles[0] as SVGCircleElement;
    const circle2 = circles[1] as SVGCircleElement;

    const pt = makeMutableSvgPoint(svg);

    // Start and arm dot 1 drag
    circle1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    pt.x = 200; pt.y = 80;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 80 }));

    // Preempt with dot 2 mousedown
    circle2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));

    // mouseup — only dot 2's handler is active; dot 1 should not call onPositionChange
    window.dispatchEvent(new MouseEvent('mouseup'));

    // Only specIndex 1 (dot 2) should have triggered, not specIndex 0
    const dot1Changes = changes.filter(c => c.specIndex === 0);
    expect(dot1Changes.length).toBe(0);
  });

  // ── 6 & 7. opacity restore on success and cancel paths ───────────────────

  it('opacity restores to original after drag completes (resolvedOpacity undefined → no fill-opacity)', () => {
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: cfg([{ position: pos(50) }]),
        onPositionChange: () => {},
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;

    const pt = makeMutableSvgPoint(svg);

    // Drag starts — opacity goes to 0.75
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    pt.x = 200; pt.y = 80;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 80 }));

    // Drop — opacity should be removed (restoreOpacity removes attribute when no resolvedOpacity)
    window.dispatchEvent(new MouseEvent('mouseup'));
    expect(circle.getAttribute('fill-opacity')).toBeNull();
  });

  it('opacity restores to resolvedOpacity after drag completes when chart.dot.opacity is set', () => {
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: { dots: [{ position: pos(50) }], chart: { dot: { opacity: 0.5 } }, errors: [] },
        onPositionChange: () => {},
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;

    const pt = makeMutableSvgPoint(svg);

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    pt.x = 200; pt.y = 80;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 80 }));

    window.dispatchEvent(new MouseEvent('mouseup'));
    // restoreOpacity should reset to resolvedOpacity = 0.5
    expect(circle.getAttribute('fill-opacity')).toBe('0.5');
  });

  // ── 8. mouseup outside SVG ───────────────────────────────────────────────

  it('mouseup dispatched outside the SVG (on document.body) still finishes the drag cleanly', () => {
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

    const pt = makeMutableSvgPoint(svg);

    // Arm via circle mousedown and move — pointer is now effectively far from SVG.
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    pt.x = 300; pt.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 100 }));

    // Release the mouse OUTSIDE the SVG by dispatching on document.body.
    // Because the controller listens on `window`, this must still be observed
    // and clean up the drag (onPositionChange fires, opacity restored, cursor reset).
    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(changes.length).toBe(1);
    expect(changes[0].specIndex).toBe(0);
    expect(circle.getAttribute('fill-opacity')).toBeNull();
    expect(circle.classList.contains('hill-chart-dot--grabbing')).toBe(false);

    // A subsequent mousemove must NOT keep updating the circle (listener removed).
    const cxAfterDrop = parseFloat(circle.getAttribute('cx') ?? '0');
    pt.x = 50; pt.y = 150;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 150 }));
    expect(parseFloat(circle.getAttribute('cx') ?? '0')).toBeCloseTo(cxAfterDrop);
  });

  it('opacity restores on cancel path (preempted drag restores fill-opacity)', () => {
    const renderer = new HillChartRenderer();
    renderer.render(
      container,
      curve,
      {
        config: cfg([
        { position: pos(20) },
        { position: pos(80) },
      ]),
        onPositionChange: () => {},
      },
    );

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circles = container.querySelectorAll('circle');
    const circle1 = circles[0] as SVGCircleElement;
    const circle2 = circles[1] as SVGCircleElement;

    const pt = makeMutableSvgPoint(svg);

    // Start drag on dot 1 — it gets fill-opacity=0.75
    circle1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    expect(circle1.getAttribute('fill-opacity')).toBe('0.75');

    pt.x = 200; pt.y = 80;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 80 }));

    // Preempt: start dot 2 drag
    circle2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));

    // Move again: dot 1's onMouseMove runs, detects preemption and calls restoreOpacity
    pt.x = 50; pt.y = 80;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 80 }));

    // dot 1 opacity should have been restored (no resolvedOpacity → null)
    expect(circle1.getAttribute('fill-opacity')).toBeNull();
  });
});
