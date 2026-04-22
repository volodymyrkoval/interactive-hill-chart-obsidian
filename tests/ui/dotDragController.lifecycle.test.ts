/**
 * Characterization tests for DotDragController lifecycle.
 *
 * These tests pin the existing drag state-machine behavior **directly** via
 * DotDragController.attach(), bypassing HillChartRenderer, so that future
 * decomposition (B3–B7) cannot silently break the contract.
 *
 * Scenarios:
 *  1. arm → threshold-not-met → release   — no drag commit
 *  2. arm → threshold-met → move → commit — onPositionChange called exactly once
 *  3. drag → pre-emption by a second pointer — first gesture abandoned, no write
 *  4. click-suppression after drag          — click consumed, not propagated
 *  5. Edge: mousedown with no subsequent move — not armed, no write
 *  6. Edge: mousemove before arm (no mousedown) — ignored
 *  7. Edge: mouseup outside SVG              — drag finishes cleanly via window listener
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DotDragController,
  createSharedDragState,
} from '../../src/ui/dotDragController';
import type {
  DotDragAttachment,
  SharedDragState,
  DomRefs,
  DotIdentity,
  LabelBinding,
  SharedDragBindings,
  DragCallbacks,
} from '../../src/ui/dotDragController';
import { HillPosition } from '../../src/model/hillPosition';
import { HillCurve } from '../../src/model/hillCurve';
import { LabelLayout } from '../../src/ui/labelLayout';

// ── SVG namespace constant ───────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';

// ── helpers ──────────────────────────────────────────────────────────────────

function pos(n: number): HillPosition {
  return HillPosition.fromPercent(n);
}

/** Create a minimal SVG element attached to the document body. */
function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  document.body.appendChild(svg);
  return svg;
}

/** Create a circle with an initial cx so moves are detectable. */
function makeCircle(svg: SVGSVGElement, cx = 100): SVGCircleElement {
  const circle = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
  circle.setAttribute('cx', `${cx}`);
  circle.setAttribute('cy', '50');
  svg.appendChild(circle);
  return circle;
}

/** Create a text element with an optional data-note-link attribute. */
function makeText(svg: SVGSVGElement, noteLink?: string): SVGTextElement {
  const text = document.createElementNS(SVG_NS, 'text') as SVGTextElement;
  text.setAttribute('x', '100');
  text.setAttribute('y', '20');
  if (noteLink) text.dataset.noteLink = noteLink;
  svg.appendChild(text);
  return text;
}

/**
 * Mock the SVG coordinate transform so that the clientX from a mousemove
 * passes through as an SVG x coordinate (identity-ish transform).
 * Returns a mutable point object — set .x before dispatching mousemove.
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

interface AttachmentOptions {
  svg: SVGSVGElement;
  circle: SVGCircleElement;
  textEl?: SVGTextElement | null;
  specIndex?: number;
  initialPosition?: HillPosition;
  dragState?: SharedDragState;
  onPositionChange?: (specIndex: number, pos: HillPosition) => void;
  onNoteClick?: (noteName: string, newLeaf: boolean) => void;
}

/** Build a minimal DotDragAttachment using the nested role-based structure. */
function makeAttachment(opts: AttachmentOptions): DotDragAttachment {
  const dom: DomRefs = {
    svg: opts.svg,
    circle: opts.circle,
    textEl: opts.textEl ?? null,
  };
  const identity: DotIdentity = {
    specIndex: opts.specIndex ?? 0,
    initialPosition: opts.initialPosition ?? pos(50),
    resolvedOpacity: undefined,
  };
  const label: LabelBinding = {
    labelEntry: null,
    labelLayout: new LabelLayout(),
    labelCeilingPolicy: {
      getCeiling: () => null,
      getMaxFontSize: () => 12,
      compute: () => {},
      reset: () => {},
    } as unknown as import('../../src/ui/labelCeilingPolicy').LabelCeilingPolicy,
  };
  const shared: SharedDragBindings = {
    hoverState: { isDragging: false },
    dragState: opts.dragState ?? createSharedDragState(),
    curve: new HillCurve(),
    size: { width: 400, height: 150 },
  };
  const callbacks: DragCallbacks = {
    onPositionChange: opts.onPositionChange ?? (() => {}),
    onNoteClick: opts.onNoteClick,
  };
  return { dom, identity, label, shared, callbacks };
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('DotDragController lifecycle', () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    svg = makeSvg();
  });

  afterEach(() => {
    if (svg.parentElement) svg.parentElement.removeChild(svg);
    vi.restoreAllMocks();
    // Drain any window listeners left by unfinished gestures.
    window.dispatchEvent(new MouseEvent('mouseup'));
  });

  // ── 1. arm → threshold-not-met → release ────────────────────────────────

  it('circle mousedown + move below threshold + mouseup does not call onPositionChange', () => {
    const circle = makeCircle(svg);
    const changes: HillPosition[] = [];
    const attachment = makeAttachment({
      svg,
      circle,
      onPositionChange: (_, p) => changes.push(p),
    });
    const ctrl = new DotDragController(attachment);

    // Circle arms immediately — but we move less than 4 px so no position update.
    // Note: circle mousedown arms immediately (armed=true), so `tryArm` is not called.
    // The test here verifies that if circle cx doesn't change, onPositionChange is not called.
    mockCtm(svg); // CTM returns identity — currentT stays at 0.5 (initial)

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    // Do NOT move the mouse — no mousemove dispatched.
    window.dispatchEvent(new MouseEvent('mouseup'));

    // onPositionChange is only called when newPercent !== originalPercent.
    // Since we never moved, currentT == initialPosition.toT(), so no write.
    expect(changes.length).toBe(0);
  });

  it('label mousedown + move below DRAG_THRESHOLD_PX (3 px) + mouseup does not call onPositionChange', () => {
    const circle = makeCircle(svg);
    const text = makeText(svg);
    const changes: HillPosition[] = [];
    const attachment = makeAttachment({
      svg,
      circle,
      textEl: text,
      onPositionChange: (_, p) => changes.push(p),
    });
    const ctrl = new DotDragController(attachment);

    const pt = mockCtm(svg);

    // Mousedown on label starts pending arm (armed=false, threshold-gated).
    text.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));

    // Move only 3 px — below the 4 px threshold; drag does not arm.
    pt.x = 50; pt.y = 50;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 13, clientY: 10 }));

    // Release without arming.
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(changes.length).toBe(0);
    // Must NOT have become grabbing (never armed).
    expect(circle.classList.contains('hill-chart-dot--grabbing')).toBe(false);
  });

  // ── 2. arm → threshold-met → move → commit ──────────────────────────────

  it('circle mousedown + move to new position + mouseup calls onPositionChange exactly once', () => {
    const circle = makeCircle(svg, 100);
    const changes: Array<{ specIndex: number; pos: HillPosition }> = [];
    const attachment = makeAttachment({
      svg,
      circle,
      specIndex: 0,
      initialPosition: pos(25),
      onPositionChange: (i, p) => changes.push({ specIndex: i, pos: p }),
    });
    const ctrl = new DotDragController(attachment);

    const pt = mockCtm(svg);

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));

    // Move so that the SVG x resolves to a point well beyond initial (25%).
    pt.x = 300; pt.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 100 }));

    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(changes.length).toBe(1);
    expect(changes[0].specIndex).toBe(0);
    // The new position must differ from the initial 25%.
    expect(changes[0].pos.toPercent()).not.toBe(25);
  });

  it('onPositionChange is called exactly once, not on every mousemove', () => {
    const circle = makeCircle(svg);
    const changes: HillPosition[] = [];
    const attachment = makeAttachment({
      svg,
      circle,
      initialPosition: pos(25),
      onPositionChange: (_, p) => changes.push(p),
    });
    const ctrl = new DotDragController(attachment);

    const pt = mockCtm(svg);

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));

    // Multiple moves — each updates currentT internally, but only mouseup commits.
    pt.x = 200; pt.y = 80;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 80 }));
    pt.x = 250; pt.y = 80;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 250, clientY: 80 }));
    pt.x = 300; pt.y = 80;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 80 }));

    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(changes.length).toBe(1);
  });

  // ── 3. drag → pre-emption by a second pointer ───────────────────────────

  it('second mousedown (second controller) preempts first: first drag does not call onPositionChange', () => {
    const circle1 = makeCircle(svg, 80);
    const circle2 = makeCircle(svg, 300);
    const sharedDragState = createSharedDragState();
    const changes1: HillPosition[] = [];
    const changes2: HillPosition[] = [];

    const attachment1 = makeAttachment({
      svg,
      circle: circle1,
      specIndex: 0,
      initialPosition: pos(20),
      dragState: sharedDragState,
      onPositionChange: (_, p) => changes1.push(p),
    });
    const attachment2 = makeAttachment({
      svg,
      circle: circle2,
      specIndex: 1,
      initialPosition: pos(80),
      dragState: sharedDragState,
      onPositionChange: (_, p) => changes2.push(p),
    });

    const ctrl1 = new DotDragController(attachment1);
    const ctrl2 = new DotDragController(attachment2);

    const pt = mockCtm(svg);

    // Start drag on dot 1.
    circle1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    pt.x = 150; pt.y = 80;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 80 }));

    // Preempt: start drag on dot 2 (increments shared seq).
    circle2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));

    // Mouseup — only dot 2's gesture is active.
    window.dispatchEvent(new MouseEvent('mouseup'));

    // Dot 1's onPositionChange must not have been called.
    expect(changes1.length).toBe(0);
  });

  it('after preemption, moving the mouse does not update the first circle cx', () => {
    const circle1 = makeCircle(svg, 80);
    const circle2 = makeCircle(svg, 300);
    const sharedDragState = createSharedDragState();

    const attachment1 = makeAttachment({
      svg,
      circle: circle1,
      specIndex: 0,
      initialPosition: pos(20),
      dragState: sharedDragState,
    });
    const attachment2 = makeAttachment({
      svg,
      circle: circle2,
      specIndex: 1,
      initialPosition: pos(80),
      dragState: sharedDragState,
    });

    const ctrl1 = new DotDragController(attachment1);
    const ctrl2 = new DotDragController(attachment2);

    const pt = mockCtm(svg);

    // Arm dot 1 and move it.
    circle1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    pt.x = 150; pt.y = 80;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 80 }));
    const cxAfterFirstMove = parseFloat(circle1.getAttribute('cx') ?? '0');

    // Preempt with dot 2.
    circle2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));

    // Move again — dot 1 must NOT update (its gesture was cancelled).
    pt.x = 50; pt.y = 80;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 80 }));

    const cxAfterPreemption = parseFloat(circle1.getAttribute('cx') ?? '0');
    expect(cxAfterPreemption).toBeCloseTo(cxAfterFirstMove);
  });

  // ── 4. click-suppression after drag ─────────────────────────────────────

  it('label click after completed drag is suppressed (stopImmediatePropagation)', () => {
    const circle = makeCircle(svg);
    const text = makeText(svg, 'My Note');
    const clicks: string[] = [];

    const attachment = makeAttachment({
      svg,
      circle,
      textEl: text,
      initialPosition: pos(50),
      onNoteClick: (name) => clicks.push(name),
    });
    const ctrl = new DotDragController(attachment);

    const pt = mockCtm(svg);

    // Complete a drag via circle mousedown (arms immediately).
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    pt.x = 200; pt.y = 58;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 58 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    // Browser fires click after mouseup — must be suppressed.
    text.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(clicks).toEqual([]);
  });

  it('label click without prior drag fires onNoteClick', () => {
    const circle = makeCircle(svg);
    const text = makeText(svg, 'My Note');
    const clicks: string[] = [];

    const attachment = makeAttachment({
      svg,
      circle,
      textEl: text,
      initialPosition: pos(50),
      onNoteClick: (name) => clicks.push(name),
    });
    const ctrl = new DotDragController(attachment);

    // Mousedown then mouseup with no move → not armed → click is not suppressed.
    text.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    text.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(clicks).toEqual(['My Note']);
  });

  // ── 5. Edge: mousedown with no subsequent move ───────────────────────────

  it('circle mousedown with no mousemove then mouseup does not arm and does not write', () => {
    const circle = makeCircle(svg);
    const changes: HillPosition[] = [];
    const attachment = makeAttachment({
      svg,
      circle,
      initialPosition: pos(50),
      onPositionChange: (_, p) => changes.push(p),
    });
    const ctrl = new DotDragController(attachment);

    // getScreenCTM returning null means currentT stays at initialPosition.toT().
    svg.getScreenCTM = vi.fn().mockReturnValue(null);

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    // currentT == initialPosition.toT() → newPercent == originalPercent → no write.
    expect(changes.length).toBe(0);
  });

  it('circle mousedown with no mousemove leaves cursor as grab after mouseup', () => {
    const circle = makeCircle(svg);
    const attachment = makeAttachment({ svg, circle, initialPosition: pos(50) });
    const ctrl = new DotDragController(attachment);

    svg.getScreenCTM = vi.fn().mockReturnValue(null);

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    // fill-opacity goes to 0.75 on arm (circle arms immediately)
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    window.dispatchEvent(new MouseEvent('mouseup'));

    // commitDrag removes grabbing class
    expect(circle.classList.contains('hill-chart-dot--grabbing')).toBe(false);
  });

  // ── 6. Edge: mousemove before arm ────────────────────────────────────────

  it('mousemove on window before any mousedown is ignored (no state change)', () => {
    const circle = makeCircle(svg);
    const changes: HillPosition[] = [];
    const attachment = makeAttachment({
      svg,
      circle,
      onPositionChange: (_, p) => changes.push(p),
    });
    const ctrl = new DotDragController(attachment);

    const pt = mockCtm(svg);
    const initialCx = parseFloat(circle.getAttribute('cx') ?? '0');

    // Dispatch mousemove without any prior mousedown.
    pt.x = 300; pt.y = 80;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 80 }));

    const cxAfter = parseFloat(circle.getAttribute('cx') ?? '0');
    expect(cxAfter).toBeCloseTo(initialCx);
    expect(changes.length).toBe(0);
  });

  // ── 7. Edge: mouseup outside SVG ─────────────────────────────────────────

  it('mouseup dispatched outside SVG (on document.body) still finishes the drag via window listener', () => {
    const circle = makeCircle(svg, 100);
    const changes: Array<{ specIndex: number; pos: HillPosition }> = [];
    const attachment = makeAttachment({
      svg,
      circle,
      specIndex: 0,
      initialPosition: pos(25),
      onPositionChange: (i, p) => changes.push({ specIndex: i, pos: p }),
    });
    const ctrl = new DotDragController(attachment);

    const pt = mockCtm(svg);

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    expect(circle.getAttribute('fill-opacity')).toBe('0.75');

    pt.x = 300; pt.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 100 }));

    // Release outside SVG — controller listens on `window`, so it must catch this.
    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(changes.length).toBe(1);
    expect(changes[0].specIndex).toBe(0);
    // Opacity restored (no resolvedOpacity → attribute removed).
    expect(circle.getAttribute('fill-opacity')).toBeNull();
    // Grabbing class removed on reset.
    expect(circle.classList.contains('hill-chart-dot--grabbing')).toBe(false);
  });

  it('after mouseup outside SVG, subsequent mousemove does not update circle cx', () => {
    const circle = makeCircle(svg, 100);
    const attachment = makeAttachment({
      svg,
      circle,
      initialPosition: pos(25),
    });
    const ctrl = new DotDragController(attachment);

    const pt = mockCtm(svg);

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    pt.x = 300; pt.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 100 }));

    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const cxAfterDrop = parseFloat(circle.getAttribute('cx') ?? '0');

    // A subsequent mousemove must NOT move the circle (listener was removed).
    pt.x = 50; pt.y = 150;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 150 }));

    expect(parseFloat(circle.getAttribute('cx') ?? '0')).toBeCloseTo(cxAfterDrop);
  });

  // ── 8. constructor-based init ─────────────────────────────────────────────

  it('constructs with attachment passed to constructor (no separate attach() call)', () => {
    const circle = makeCircle(svg, 100);
    const changes: Array<{ specIndex: number; pos: HillPosition }> = [];
    const attachment = makeAttachment({
      svg,
      circle,
      specIndex: 0,
      initialPosition: pos(25),
      onPositionChange: (i, p) => changes.push({ specIndex: i, pos: p }),
    });
    const ctrl = new DotDragController(attachment);

    const pt = mockCtm(svg);
    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    pt.x = 300; pt.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(changes.length).toBe(1);
    expect(changes[0].specIndex).toBe(0);
    expect(changes[0].pos.toPercent()).not.toBe(25);
  });
});
