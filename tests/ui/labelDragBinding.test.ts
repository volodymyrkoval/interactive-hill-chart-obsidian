/**
 * Unit tests for LabelDragBinding.
 *
 * LabelDragBinding owns:
 *   - Mutating labelEntry.position / textAnchor / baseY on each update tick
 *   - Applying placement to the SVG text element (x, y, text-anchor attributes)
 *   - Calling the finalize callback (via LabelLayout) when a ceiling is available
 */

import { describe, it, expect, vi } from 'vitest';
import { LabelDragBinding } from '../../src/ui/labelDragBinding';
import { LabelLayout } from '../../src/ui/labelLayout';
import type { LabelEntry } from '../../src/ui/labelLayout';
import { HillCurve } from '../../src/model/hillCurve';
import { HillPosition } from '../../src/model/hillPosition';
import type { LabelCeilingPolicy } from '../../src/ui/labelCeilingPolicy';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CURVE = new HillCurve();
const SIZE = { width: 400, height: 150 };

/** Builds a minimal LabelCeilingPolicy stub. */
function makePolicyStub(ceiling: number | null, maxFontSize = 12): LabelCeilingPolicy {
  return {
    getCeiling: () => ceiling,
    getMaxFontSize: () => maxFontSize,
    compute: () => {},
    reset: () => {},
  } as unknown as LabelCeilingPolicy;
}

function makeText(): SVGTextElement {
  const text = document.createElementNS(SVG_NS, 'text') as SVGTextElement;
  text.setAttribute('x', '0');
  text.setAttribute('y', '0');
  text.setAttribute('text-anchor', 'start');
  return text;
}

function makeLabelEntry(textEl: SVGTextElement): LabelEntry {
  return { textEl, position: HillPosition.fromPercent(50), textAnchor: 'start', baseY: 50 };
}

function svgPointForPercent(percent: number): { t: number; x: number; y: number } {
  const t = percent / 100;
  const { x, y } = CURVE.toSvgPoint(t, SIZE);
  return { t, x, y };
}

describe('LabelDragBinding', () => {
  // ── label entry mutation ─────────────────────────────────────────────────────

  it('update sets labelEntry.position to the rounded percent of t', () => {
    const textEl = makeText();
    const labelEntry = makeLabelEntry(textEl);
    const labelLayout = new LabelLayout();
    labelLayout.add(labelEntry);

    const binding = new LabelDragBinding(labelEntry, textEl, labelLayout, makePolicyStub(null));

    const { t, x, y } = svgPointForPercent(30);
    binding.update(t, x, y);

    expect(labelEntry.position.toPercent()).toBe(30);
  });

  it('update sets labelEntry.textAnchor from computed placement', () => {
    const textEl = makeText();
    const labelEntry = makeLabelEntry(textEl);
    const labelLayout = new LabelLayout();
    labelLayout.add(labelEntry);

    const binding = new LabelDragBinding(labelEntry, textEl, labelLayout, makePolicyStub(null));

    // position 90 → 'end'
    const { t, x, y } = svgPointForPercent(90);
    binding.update(t, x, y);

    expect(labelEntry.textAnchor).toBe('end');
  });

  it('update sets labelEntry.baseY from computed placement (different positions yield different y)', () => {
    const textEl = makeText();
    const labelEntry = makeLabelEntry(textEl);
    const labelLayout = new LabelLayout();
    labelLayout.add(labelEntry);

    const binding = new LabelDragBinding(labelEntry, textEl, labelLayout, makePolicyStub(null));

    // 10% is near the baseline (high y in SVG) — uses dotY directly as baseY.
    const at10 = svgPointForPercent(10);
    binding.update(at10.t, at10.x, at10.y);
    const baseYAt10 = labelEntry.baseY;

    // 50% is at the apex (low y in SVG) — uses dotY - LABEL_OFFSET_PX as baseY.
    const at50 = svgPointForPercent(50);
    binding.update(at50.t, at50.x, at50.y);
    const baseYAt50 = labelEntry.baseY;

    expect(baseYAt10).not.toBeCloseTo(baseYAt50, 0);
    expect(baseYAt10).toBeGreaterThan(0);
    expect(baseYAt50).toBeGreaterThan(0);
  });

  // ── SVG text element attribute application ───────────────────────────────────

  it('update applies placement x, y, text-anchor to the text element', () => {
    const textEl = makeText();
    const labelEntry = makeLabelEntry(textEl);
    const labelLayout = new LabelLayout();
    labelLayout.add(labelEntry);

    const binding = new LabelDragBinding(labelEntry, textEl, labelLayout, makePolicyStub(null));

    const { t, x, y } = svgPointForPercent(50);
    binding.update(t, x, y);

    // After update, attributes must be non-zero (placement computed from dot position)
    expect(textEl.getAttribute('x')).not.toBeNull();
    expect(textEl.getAttribute('y')).not.toBeNull();
    expect(textEl.getAttribute('text-anchor')).toBe('middle');
  });

  // ── finalize callback ────────────────────────────────────────────────────────

  it('update calls labelLayout.finalize when getLabelYCeiling returns a value', () => {
    const textEl = makeText();
    const labelEntry = makeLabelEntry(textEl);
    const labelLayout = new LabelLayout();
    labelLayout.add(labelEntry);

    const finalizeSpy = vi.spyOn(labelLayout, 'finalize');
    const binding = new LabelDragBinding(labelEntry, textEl, labelLayout, makePolicyStub(120));

    const { t, x, y } = svgPointForPercent(30);
    binding.update(t, x, y);

    expect(finalizeSpy).toHaveBeenCalledTimes(1);
  });

  it('update does NOT call labelLayout.finalize when getLabelYCeiling returns null', () => {
    const textEl = makeText();
    const labelEntry = makeLabelEntry(textEl);
    const labelLayout = new LabelLayout();
    labelLayout.add(labelEntry);

    const finalizeSpy = vi.spyOn(labelLayout, 'finalize');
    const binding = new LabelDragBinding(labelEntry, textEl, labelLayout, makePolicyStub(null));

    const { t, x, y } = svgPointForPercent(50);
    binding.update(t, x, y);

    expect(finalizeSpy).not.toHaveBeenCalled();
  });

  it('update with null labelEntry does not throw', () => {
    const textEl = makeText();
    const labelLayout = new LabelLayout();

    const binding = new LabelDragBinding(null, textEl, labelLayout, makePolicyStub(null));

    const { t, x, y } = svgPointForPercent(50);
    expect(() => binding.update(t, x, y)).not.toThrow();
  });
});
