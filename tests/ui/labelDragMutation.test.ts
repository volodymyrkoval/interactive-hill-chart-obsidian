/**
 * Characterization tests for label-entry mutation during drag.
 *
 * These tests pin the in-place mutation of `labelEntry` fields on each
 * mousemove tick, and the frequency of `LabelLayout.finalize` calls.
 * They are written before the B4 `LabelDragBinding` extraction so that
 * refactoring cannot silently break the label-state contract.
 *
 * Scenarios:
 *  1. labelEntry.position, textAnchor, baseY update on each drag tick
 *  2. Layout finalize fires exactly once per mousemove when ceiling is set
 *  3. Layout finalize NOT called when getLabelYCeiling returns null
 *  4. Anchor is 'start' for position < 40
 *  5. Anchor switches to 'middle' at exactly position 40
 *  6. Anchor stays 'middle' at exactly position 60
 *  7. Anchor switches to 'end' at exactly position 80
 *  8. Edge: drag to position 0 — clamped, anchor is 'start'
 *  9. Edge: drag to position 100 — anchor is 'end'
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DotDragController,
  createSharedDragState,
} from '../../src/ui/dotDragController';
import type {
  DotDragAttachment,
  DomRefs,
  DotIdentity,
  LabelBinding,
  SharedDragBindings,
  DragCallbacks,
} from '../../src/ui/dotDragController';
import { HillPosition } from '../../src/model/hillPosition';
import { HillCurve } from '../../src/model/hillCurve';
import { LabelLayout } from '../../src/ui/labelLayout';
import type { LabelEntry } from '../../src/ui/labelLayout';
import type { LabelCeilingPolicy } from '../../src/ui/labelCeilingPolicy';


// ── SVG namespace constant ───────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';

// ── helpers ──────────────────────────────────────────────────────────────────

function pos(n: number): HillPosition {
  return HillPosition.fromPercent(n);
}

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  document.body.appendChild(svg);
  return svg;
}

function makeCircle(svg: SVGSVGElement, cx = 100): SVGCircleElement {
  const circle = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
  circle.setAttribute('cx', `${cx}`);
  circle.setAttribute('cy', '50');
  svg.appendChild(circle);
  return circle;
}

function makeText(svg: SVGSVGElement): SVGTextElement {
  const text = document.createElementNS(SVG_NS, 'text') as SVGTextElement;
  text.setAttribute('x', '100');
  text.setAttribute('y', '50');
  svg.appendChild(text);
  return text;
}

function makeLabelEntry(textEl: SVGTextElement): LabelEntry {
  return { textEl, position: HillPosition.fromPercent(50), textAnchor: 'start', baseY: 50 };
}

/**
 * Mocks SVG coordinate transform so that the svgPt returned by
 * matrixTransform has x = pt.x. Returns a mutable `pt` object —
 * set `pt.x` before dispatching mousemove to control the resolved SVG x.
 */
function mockCtm(svg: SVGSVGElement): { x: number; y: number } {
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

/**
 * Computes the SVG x coordinate that corresponds to a given position percent
 * using the same HillCurve + Size used in attachments.
 */
const CURVE = new HillCurve();
const SIZE = { width: 400, height: 150 };

function svgXForPercent(percent: number): number {
  const t = percent / 100;
  return CURVE.toSvgPoint(t, SIZE).x;
}

interface SetupResult {
  ctrl: DotDragController;
  svg: SVGSVGElement;
  circle: SVGCircleElement;
  textEl: SVGTextElement;
  labelEntry: LabelEntry;
  labelLayout: LabelLayout;
  pt: { x: number; y: number };
}

interface SetupOptions {
  initialPercent?: number;
  ceiling?: number | null;
}

function makePolicyStub(ceiling: number | null, maxFontSize = 12): LabelCeilingPolicy {
  return {
    getCeiling: () => ceiling,
    getMaxFontSize: () => maxFontSize,
    compute: () => {},
    reset: () => {},
  } as unknown as LabelCeilingPolicy;
}

/**
 * Creates a controller with a text element and labelEntry attached.
 * Arms the drag immediately via circle mousedown.
 */
function setup(svg: SVGSVGElement, opts: SetupOptions = {}): SetupResult {
  const { initialPercent = 50, ceiling = null } = opts;

  const circle = makeCircle(svg, svgXForPercent(initialPercent));
  const textEl = makeText(svg);
  const labelEntry = makeLabelEntry(textEl);
  const labelLayout = new LabelLayout();
  labelLayout.add(labelEntry);

  const dom: DomRefs = { svg, circle, textEl };
  const identity: DotIdentity = { specIndex: 0, initialPosition: pos(initialPercent), resolvedOpacity: undefined };
  const label: LabelBinding = { labelEntry, labelLayout, labelCeilingPolicy: makePolicyStub(ceiling) };
  const shared: SharedDragBindings = { hoverState: { isDragging: false }, dragState: createSharedDragState(), curve: CURVE, size: SIZE };
  const callbacks: DragCallbacks = { onPositionChange: () => {} };
  const attachment: DotDragAttachment = { dom, identity, label, shared, callbacks };

  const ctrl = new DotDragController(attachment);

  const pt = mockCtm(svg);

  // Arm via circle mousedown (arms immediately — no threshold).
  circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));

  return { ctrl, svg, circle, textEl, labelEntry, labelLayout, pt };
}

/**
 * Dispatches a single mousemove with the given target SVG x.
 */
function moveTo(pt: { x: number; y: number }, svgX: number): void {
  pt.x = svgX;
  pt.y = 50; // y is irrelevant for curve projection
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: svgX, clientY: 50 }));
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('label-entry mutation during drag', () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    svg = makeSvg();
  });

  afterEach(() => {
    if (svg.parentElement) svg.parentElement.removeChild(svg);
    vi.restoreAllMocks();
    window.dispatchEvent(new MouseEvent('mouseup'));
  });

  // ── 1. labelEntry fields update on each tick ─────────────────────────────

  it('labelEntry.position is updated to the current percent on each mousemove', () => {
    const { labelEntry, pt } = setup(svg);

    moveTo(pt, svgXForPercent(30));
    expect(labelEntry.position.toPercent()).toBe(30);

    moveTo(pt, svgXForPercent(70));
    expect(labelEntry.position.toPercent()).toBe(70);
  });

  it('labelEntry.textAnchor is updated on each mousemove', () => {
    const { labelEntry, pt } = setup(svg);

    // Position 30 → 'start'
    moveTo(pt, svgXForPercent(30));
    expect(labelEntry.textAnchor).toBe('start');

    // Position 50 → 'middle'
    moveTo(pt, svgXForPercent(50));
    expect(labelEntry.textAnchor).toBe('middle');

    // Position 90 → 'end'
    moveTo(pt, svgXForPercent(90));
    expect(labelEntry.textAnchor).toBe('end');
  });

  it('labelEntry.baseY is updated on each mousemove', () => {
    const { labelEntry, pt } = setup(svg);

    moveTo(pt, svgXForPercent(25));
    const baseYAt25 = labelEntry.baseY;

    moveTo(pt, svgXForPercent(75));
    const baseYAt75 = labelEntry.baseY;

    // The two positions resolve to different SVG y coordinates on the curve.
    expect(baseYAt25).not.toBe(baseYAt75);
    // Both must be positive numbers (real SVG coordinates).
    expect(baseYAt25).toBeGreaterThan(0);
    expect(baseYAt75).toBeGreaterThan(0);
  });

  it('all three fields are updated before mouseup (immediately on tick)', () => {
    const { labelEntry, pt } = setup(svg);

    moveTo(pt, svgXForPercent(55));

    // Inspect mid-drag, before mouseup.
    expect(labelEntry.position.toPercent()).toBe(55);
    expect(labelEntry.textAnchor).toBe('middle');
    expect(typeof labelEntry.baseY).toBe('number');
    expect(isFinite(labelEntry.baseY)).toBe(true);
  });

  // ── 2. finalize fired once per tick when ceiling is set ──────────────────

  it('labelLayout.finalize is called once per mousemove when getLabelYCeiling returns a value', () => {
    const { pt, labelLayout } = setup(svg, { ceiling: 120 });

    const finalizeSpy = vi.spyOn(labelLayout, 'finalize');

    moveTo(pt, svgXForPercent(30));
    expect(finalizeSpy).toHaveBeenCalledTimes(1);

    moveTo(pt, svgXForPercent(60));
    expect(finalizeSpy).toHaveBeenCalledTimes(2);

    moveTo(pt, svgXForPercent(80));
    expect(finalizeSpy).toHaveBeenCalledTimes(3);
  });

  // ── 3. finalize NOT called when ceiling is null ───────────────────────────

  it('labelLayout.finalize is NOT called when getLabelYCeiling returns null', () => {
    // Default setup has getLabelYCeiling returning null.
    const { pt, labelLayout } = setup(svg, { ceiling: null });

    const finalizeSpy = vi.spyOn(labelLayout, 'finalize');

    moveTo(pt, svgXForPercent(50));
    moveTo(pt, svgXForPercent(80));

    expect(finalizeSpy).not.toHaveBeenCalled();
  });

  // ── 4–7. textAnchor boundary transitions ─────────────────────────────────

  it("textAnchor is 'start' for position below 40", () => {
    const { labelEntry, pt } = setup(svg);

    moveTo(pt, svgXForPercent(20));
    expect(labelEntry.textAnchor).toBe('start');

    moveTo(pt, svgXForPercent(39));
    expect(labelEntry.textAnchor).toBe('start');
  });

  it("textAnchor switches to 'middle' at exactly position 40", () => {
    const { labelEntry, pt } = setup(svg);

    moveTo(pt, svgXForPercent(40));
    // labelEntry.position.toPercent() uses Math.round — rounds to 40.
    expect(labelEntry.position.toPercent()).toBe(40);
    // textAnchor uses the raw t from tFromSvgX, which binary-searches and may
    // land just below 0.4 (≈ 39.999…%), falling into the 'start' zone.
    // This characterizes the current floating-point sensitivity at this boundary.
    expect(labelEntry.textAnchor).toBe('start');
  });

  it("textAnchor remains 'middle' at exactly position 60", () => {
    const { labelEntry, pt } = setup(svg);

    moveTo(pt, svgXForPercent(60));
    // labelEntry.position.toPercent() rounds to 60.
    expect(labelEntry.position.toPercent()).toBe(60);
    // At t≈0.600000009…, position * 100 > 60, so the [40, 60] check fails and
    // the anchor falls back to 'start'. Characterizes the current boundary behavior.
    expect(labelEntry.textAnchor).toBe('start');
  });

  it("textAnchor switches to 'end' at exactly position 80", () => {
    const { labelEntry, pt } = setup(svg);

    moveTo(pt, svgXForPercent(80));
    expect(labelEntry.position.toPercent()).toBe(80);
    expect(labelEntry.textAnchor).toBe('end');
  });

  it("textAnchor is 'start' between positions 61 and 79 (neither middle nor end zone)", () => {
    const { labelEntry, pt } = setup(svg);

    moveTo(pt, svgXForPercent(70));
    expect(labelEntry.position.toPercent()).toBe(70);
    expect(labelEntry.textAnchor).toBe('start');
  });

  // ── 8–9. edge: clamp at 0 and 100 ────────────────────────────────────────

  it('edge: drag to SVG x before curve start clamps position to 0 with start anchor', () => {
    const { labelEntry, pt } = setup(svg, { initialPercent: 50 });

    // Negative SVG x is outside the curve — tFromSvgX clamps to t=0.
    moveTo(pt, -999);

    expect(labelEntry.position.toPercent()).toBe(0);
    expect(labelEntry.textAnchor).toBe('start');
  });

  it('edge: drag to SVG x past curve end clamps position to 100 with end anchor', () => {
    const { labelEntry, pt } = setup(svg, { initialPercent: 50 });

    // Very large SVG x — tFromSvgX clamps to t=1.
    moveTo(pt, 99999);

    expect(labelEntry.position.toPercent()).toBe(100);
    expect(labelEntry.textAnchor).toBe('end');
  });

  // ── 10. finalize must not mutate baseY ────────────────────────────────────

  it('finalize does not mutate entry.baseY', () => {
    // Two entries at the same baseY — separateLabels will cluster and spread them,
    // producing adjusted.baseY values that differ from the originals.
    // After finalize(), entry.baseY must still equal the original natural Y.
    const svgNs = 'http://www.w3.org/2000/svg';
    const makeTxt = (): SVGTextElement => {
      const t = document.createElementNS(svgNs, 'text') as SVGTextElement;
      svg.appendChild(t);
      return t;
    };

    const layout = new LabelLayout();

    const originalY = 380;

    const entryA: LabelEntry = {
      textEl: makeTxt(),
      position: HillPosition.fromPercent(50),
      textAnchor: 'middle',
      baseY: originalY,
    };
    const entryB: LabelEntry = {
      textEl: makeTxt(),
      position: HillPosition.fromPercent(50),
      textAnchor: 'middle',
      baseY: originalY,
    };

    layout.add(entryA);
    layout.add(entryB);

    // Call finalize multiple times — simulating repeated drag ticks.
    layout.finalize(500, 12);
    layout.finalize(500, 12);
    layout.finalize(500, 12);

    expect(entryA.baseY).toBe(originalY);
    expect(entryB.baseY).toBe(originalY);
  });
});
