import { describe, it, expect } from 'vitest';
import { separateLabels } from '../../src/ui/labelSeparation';
import type { LabelSpec } from '../../src/ui/labelSeparation';
import { DEFAULT_DOT_LABEL_FONT_SIZE } from '../../src/ui/visualConstants';

describe('separateLabels', () => {
  it('empty array returns empty array', () => {
    const result = separateLabels([]);

    expect(result).toEqual([]);
  });

  it('single label returns array with unchanged baseY', () => {
    const label: LabelSpec = {
      position: 50,
      textAnchor: 'middle',
      baseY: 100,
    };

    const result = separateLabels([label]);

    expect(result).toHaveLength(1);
    expect(result[0].baseY).toBe(100);
    expect(result[0].position).toBe(50);
    expect(result[0].textAnchor).toBe('middle');
  });

  it('two labels with different textAnchor at same position are not separated', () => {
    const labels: LabelSpec[] = [
      { position: 50, textAnchor: 'start', baseY: 100 },
      { position: 50, textAnchor: 'end',   baseY: 100 },
    ];

    const result = separateLabels(labels);

    expect(result[0].baseY).toBe(100);
    expect(result[1].baseY).toBe(100);
  });

  it('two labels with same textAnchor whose baseY values are beyond the step threshold are not separated', () => {
    // baseY delta = 150 - 50 = 100px >> step (14.4px) → each is a singleton cluster
    const labels: LabelSpec[] = [
      { position: 10, textAnchor: 'start', baseY: 50 },
      { position: 35, textAnchor: 'start', baseY: 150 },
    ];

    const result = separateLabels(labels);

    expect(result[0].baseY).toBe(50);
    expect(result[1].baseY).toBe(150);
  });

  it('two labels same anchor same position fan symmetrically around centerY', () => {
    // positions 50 and 50, delta=0 → cluster, both baseY=40
    // centerY = 40, step = 12 * 1.2 = 14.4
    // offsets: -0.5 and +0.5 → adjustedY: 32.8 and 47.2
    const labels: LabelSpec[] = [
      { position: 50, textAnchor: 'start', baseY: 40 },
      { position: 50, textAnchor: 'start', baseY: 40 },
    ];

    const result = separateLabels(labels);

    expect(result).toHaveLength(2);
    expect(result[0].baseY).toBeCloseTo(32.8, 5);
    expect(result[1].baseY).toBeCloseTo(47.2, 5);
    // symmetry: sum of adjusted Y values equals 2 * centerY
    expect(result[0].baseY + result[1].baseY).toBeCloseTo(80, 5);
  });

  it('two labels same anchor close positions fan around their average centerY', () => {
    // positions 10 and 18, delta=8 ≤ 20 → cluster, baseY: 40 and 42
    // centerY = 41, step = 14.4
    // offsets: -0.5 and +0.5 → adjustedY: 33.8 and 48.2
    const labels: LabelSpec[] = [
      { position: 10, textAnchor: 'start', baseY: 40 },
      { position: 18, textAnchor: 'start', baseY: 42 },
    ];

    const result = separateLabels(labels);

    expect(result).toHaveLength(2);
    expect(result[0].baseY).toBeCloseTo(33.8, 5);
    expect(result[1].baseY).toBeCloseTo(48.2, 5);
  });

  it('three labels same anchor transitively close positions form one cluster', () => {
    // positions 10, 25, 40 — 10↔25 delta=15 ≤ 20, 25↔40 delta=15 ≤ 20 → one cluster of 3
    // all baseY: 50 → centerY = 50, step = 14.4
    // fanOffsets(3) = [-1, 0, 1]
    // adjustedY: [35.6, 50.0, 64.4]
    const labels: LabelSpec[] = [
      { position: 10, textAnchor: 'start', baseY: 50 },
      { position: 25, textAnchor: 'start', baseY: 50 },
      { position: 40, textAnchor: 'start', baseY: 50 },
    ];

    const result = separateLabels(labels);

    expect(result).toHaveLength(3);
    // result is ordered by position (sorted in findClusters)
    const sorted = [...result].sort((a, b) => a.position - b.position);
    expect(sorted[0].baseY).toBeCloseTo(35.6, 5);
    expect(sorted[1].baseY).toBeCloseTo(50.0, 5);
    expect(sorted[2].baseY).toBeCloseTo(64.4, 5);
  });

  it('three labels same anchor with baseY values far apart are each singleton clusters', () => {
    // baseY deltas: 100 - 50 = 50px and 150 - 100 = 50px, both >> step (14.4px) → three singletons
    // result: all baseY unchanged
    const labels: LabelSpec[] = [
      { position: 10, textAnchor: 'start', baseY: 50 },
      { position: 35, textAnchor: 'start', baseY: 100 },
      { position: 60, textAnchor: 'start', baseY: 150 },
    ];

    const result = separateLabels(labels);

    expect(result).toHaveLength(3);
    expect(result[0].baseY).toBe(50);
    expect(result[1].baseY).toBe(100);
    expect(result[2].baseY).toBe(150);
  });

  it('five labels same anchor same position clamp outermost to maxDisplacement when baseStep is large', () => {
    // baseStep=20, fontSize=12 → maxDisplacement = 12*3 = 36
    // outerOffset = (5-1)/2 = 2
    // unclamped displacement = 2*20 = 40 > 36 → clamp → effectiveStep = 36/2 = 18
    // centerY = 50
    // output[0].baseY = 50 - 2*18 = 14  (exactly -maxDisplacement)
    // output[4].baseY = 50 + 2*18 = 86  (exactly +maxDisplacement)
    const labels: LabelSpec[] = [
      { position: 50, textAnchor: 'start', baseY: 50 },
      { position: 50, textAnchor: 'start', baseY: 50 },
      { position: 50, textAnchor: 'start', baseY: 50 },
      { position: 50, textAnchor: 'start', baseY: 50 },
      { position: 50, textAnchor: 'start', baseY: 50 },
    ];

    const result = separateLabels(labels, { baseStep: 20, fontSize: 12 });

    expect(result).toHaveLength(5);
    // Sort by baseY to get deterministic ordering
    const sorted = [...result].sort((a, b) => a.baseY - b.baseY);
    expect(sorted[0].baseY).toBe(14);  // centerY - maxDisplacement
    expect(sorted[4].baseY).toBe(86);  // centerY + maxDisplacement
  });

  it('three labels same anchor same position fan with middle label staying at centerY', () => {
    // positions all 50, all baseY: 40
    // centerY = 40, step = 12 * 1.2 = 14.4
    // fanOffsets(3) = [-1, 0, 1]
    // adjustedY: [40 - 14.4, 40, 40 + 14.4] = [25.6, 40, 54.4]
    const labels: LabelSpec[] = [
      { position: 50, textAnchor: 'middle', baseY: 40 },
      { position: 50, textAnchor: 'middle', baseY: 40 },
      { position: 50, textAnchor: 'middle', baseY: 40 },
    ];

    const result = separateLabels(labels);

    expect(result).toHaveLength(3);
    expect(result[0].baseY).toBeCloseTo(25.6, 5);
    expect(result[1].baseY).toBeCloseTo(40.0, 5);
    expect(result[2].baseY).toBeCloseTo(54.4, 5);
  });

  it('input array is not mutated after call', () => {
    // Verify: original array reference unchanged, original objects unchanged
    const labels: LabelSpec[] = [
      { position: 50, textAnchor: 'start', baseY: 100 },
      { position: 50, textAnchor: 'start', baseY: 100 },
    ];

    const originalArrayRef = labels;
    const originalObjectRefs = [labels[0], labels[1]];
    const originalBaseYValues = [labels[0].baseY, labels[1].baseY];

    const result = separateLabels(labels);

    // Output is a different array reference
    expect(result).not.toBe(originalArrayRef);

    // Input array itself is unchanged (same reference)
    expect(labels).toBe(originalArrayRef);

    // Input objects are unchanged
    expect(labels[0]).toBe(originalObjectRefs[0]);
    expect(labels[1]).toBe(originalObjectRefs[1]);

    // Input baseY values are unchanged
    expect(labels[0].baseY).toBe(originalBaseYValues[0]);
    expect(labels[1].baseY).toBe(originalBaseYValues[1]);

    // Output objects are different references from input
    expect(result[0]).not.toBe(originalObjectRefs[0]);
    expect(result[1]).not.toBe(originalObjectRefs[1]);
  });

  it('output order preserves input index order even after cluster sort and spread', () => {
    // Input order: [position 40, position 10, position 25], all same anchor, all baseY 50
    // All within threshold, so one cluster.
    // Sorted cluster by position: [10, 25, 40]
    // Fan offsets: [-1, 0, 1] → adjustedY: [35.6, 50.0, 64.4]
    // After spread: sorted result [pos 10 → 35.6, pos 25 → 50.0, pos 40 → 64.4]
    // But output must preserve input order: [pos 40 → 64.4, pos 10 → 35.6, pos 25 → 50.0]
    const labels: LabelSpec[] = [
      { position: 40, textAnchor: 'start', baseY: 50 },
      { position: 10, textAnchor: 'start', baseY: 50 },
      { position: 25, textAnchor: 'start', baseY: 50 },
    ];

    const result = separateLabels(labels);

    expect(result).toHaveLength(3);

    // output[0] corresponds to input[0] (position 40)
    expect(result[0].position).toBe(40);
    expect(result[0].baseY).toBeCloseTo(64.4, 5);

    // output[1] corresponds to input[1] (position 10)
    expect(result[1].position).toBe(10);
    expect(result[1].baseY).toBeCloseTo(35.6, 5);

    // output[2] corresponds to input[2] (position 25)
    expect(result[2].position).toBe(25);
    expect(result[2].baseY).toBeCloseTo(50.0, 5);
  });

  it('custom fontSize changes step: two labels same anchor same position with fontSize: 20', () => {
    // positions 50 and 50, delta=0 → cluster, both baseY=50
    // fontSize: 20 → step = 20 * 1.2 = 24
    // fanOffsets(2) = [-0.5, 0.5]
    // adjustedY: [50 - 0.5*24, 50 + 0.5*24] = [38, 62]
    const labels: LabelSpec[] = [
      { position: 50, textAnchor: 'start', baseY: 50 },
      { position: 50, textAnchor: 'start', baseY: 50 },
    ];

    const result = separateLabels(labels, { fontSize: 20 });

    expect(result).toHaveLength(2);
    expect(result[0].baseY).toBeCloseTo(38, 5);
    expect(result[1].baseY).toBeCloseTo(62, 5);
  });

  it('custom baseStep overrides fontSize-derived step: two labels same anchor same position with baseStep: 5', () => {
    // positions 50 and 50, delta=0 → cluster, both baseY=50
    // baseStep: 5 (overrides fontSize-derived step)
    // fanOffsets(2) = [-0.5, 0.5]
    // adjustedY: [50 - 0.5*5, 50 + 0.5*5] = [47.5, 52.5]
    const labels: LabelSpec[] = [
      { position: 50, textAnchor: 'start', baseY: 50 },
      { position: 50, textAnchor: 'start', baseY: 50 },
    ];

    const result = separateLabels(labels, { baseStep: 5 });

    expect(result).toHaveLength(2);
    expect(result[0].baseY).toBeCloseTo(47.5, 5);
    expect(result[1].baseY).toBeCloseTo(52.5, 5);
  });

  it('two uphill labels at close positions but already Y-separated are not disturbed', () => {
    // positions 10 and 18 are within the old position threshold of 20
    // but their baseY values are 70px apart — far more than step (14.4px)
    // the bug: old algorithm collapsed them to centerY ± 7px
    // the fix: Y-based clustering leaves them alone
    const labels: LabelSpec[] = [
      { position: 10, textAnchor: 'start', baseY: 450 },
      { position: 18, textAnchor: 'start', baseY: 380 },
    ];

    const result = separateLabels(labels);

    expect(result[0].baseY).toBe(450);
    expect(result[1].baseY).toBe(380);
  });

  it('default fontSize when no options provided matches DEFAULT_DOT_LABEL_FONT_SIZE', () => {
    // When no options are passed, separateLabels should use
    // DEFAULT_DOT_LABEL_FONT_SIZE as the fallback fontSize.
    // Verify the behavior is correct by checking the spacing calculation.
    // With two identical labels, no explicit fontSize:
    // step = DEFAULT_DOT_LABEL_FONT_SIZE * 1.2
    const labels: LabelSpec[] = [
      { position: 50, textAnchor: 'start', baseY: 50 },
      { position: 50, textAnchor: 'start', baseY: 50 },
    ];

    const result = separateLabels(labels);

    // Expected step with default fontSize:
    const expectedStep = DEFAULT_DOT_LABEL_FONT_SIZE * 1.2;
    // fanOffsets(2) = [-0.5, 0.5]
    // adjustedY: [50 - 0.5*expectedStep, 50 + 0.5*expectedStep]
    const expectedY0 = 50 - 0.5 * expectedStep;
    const expectedY1 = 50 + 0.5 * expectedStep;

    expect(result).toHaveLength(2);
    expect(result[0].baseY).toBeCloseTo(expectedY0, 5);
    expect(result[1].baseY).toBeCloseTo(expectedY1, 5);
  });
});
