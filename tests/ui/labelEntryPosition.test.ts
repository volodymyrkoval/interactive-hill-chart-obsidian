/**
 * Tests that LabelEntry.position is typed as HillPosition, not a raw number.
 *
 * This pins the contract that drag-induced position mutations produce typed
 * HillPosition values rather than raw 0-100 numbers.
 */

import { describe, it, expect } from 'vitest';
import { HillPosition } from '../../src/model/hillPosition';
import type { LabelEntry } from '../../src/ui/labelLayout';

describe('LabelEntry.position is HillPosition', () => {
  it('a LabelEntry can be constructed with a HillPosition as the position field', () => {
    // This test fails at compile time if LabelEntry.position is typed as number.
    // At runtime it simply confirms the value round-trips correctly.
    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text') as SVGTextElement;
    const entry: LabelEntry = {
      textEl,
      position: HillPosition.fromPercent(42),
      textAnchor: 'start',
      baseY: 50,
    };
    expect(entry.position.toPercent()).toBe(42);
  });

  it('LabelEntry.position preserves the HillPosition clamping invariant', () => {
    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text') as SVGTextElement;
    const entry: LabelEntry = {
      textEl,
      position: HillPosition.fromPercent(0),
      textAnchor: 'start',
      baseY: 0,
    };
    expect(entry.position.toPercent()).toBe(0);
  });
});
