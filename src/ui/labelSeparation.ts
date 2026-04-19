import { DEFAULT_DOT_LABEL_FONT_SIZE } from './visualConstants';

export type LabelAnchor = 'start' | 'middle' | 'end';

export interface LabelSpec {
  position: number;     // 0–100, the dot's position on the curve
  textAnchor: LabelAnchor;
  baseY: number;        // y coordinate (before separation)
}

export interface SeparationOptions {
  baseStep?: number;  // overrides the fontSize-derived step
  fontSize?: number;  // default: DEFAULT_DOT_LABEL_FONT_SIZE (12)
}

/**
 * Returns the symmetric offset multipliers for a fan of `n` items:
 * e.g. n=2 → [-0.5, 0.5], n=3 → [-1, 0, 1]
 */
function fanOffsets(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i - (n - 1) / 2);
}

/**
 * Groups entries by textAnchor, sorts each group by baseY (then position as
 * tiebreaker for deterministic ordering), then partitions into clusters where
 * consecutive entries have baseY within `threshold` pixels of each other.
 */
function findClusters(entries: LabelSpec[], threshold: number): LabelSpec[][] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) =>
    a.baseY !== b.baseY ? a.baseY - b.baseY : a.position - b.position
  );
  const clusters: LabelSpec[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];
    if (current.baseY - previous.baseY <= threshold) {
      clusters[clusters.length - 1].push(current);
    } else {
      clusters.push([current]);
    }
  }

  return clusters;
}

export function separateLabels(labels: LabelSpec[], opts?: SeparationOptions): LabelSpec[] {
  if (labels.length === 0) return [];
  if (labels.length === 1) return [{ ...labels[0] }];

  const fontSize = opts?.fontSize ?? DEFAULT_DOT_LABEL_FONT_SIZE;
  const step = opts?.baseStep ?? (fontSize * 1.2);
  const maxDisplacement = fontSize * 3;

  // Track original input index → spread result to preserve input order.
  // findClusters() sorts by baseY, so we must re-map to original indices.
  const outputByInputIndex = new Map<number, LabelSpec>();

  // Group by textAnchor, tagging each label with its original input index
  const groups = new Map<LabelAnchor, Array<{ index: number; label: LabelSpec }>>();
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const group = groups.get(label.textAnchor) ?? [];
    group.push({ index: i, label });
    groups.set(label.textAnchor, group);
  }

  // Process each anchor group
  for (const [, group] of groups) {
    const clusterLabels = group.map(item => item.label);
    const clusters = findClusters(clusterLabels, step);

    for (const cluster of clusters) {
      if (cluster.length < 2) {
        // Singleton cluster: no spread needed
        const inputItem = group.find(item => item.label === cluster[0]);
        if (inputItem) {
          outputByInputIndex.set(inputItem.index, { ...cluster[0] });
        }
        continue;
      }

      const n = cluster.length;
      const centerY = cluster.reduce((sum, l) => sum + l.baseY, 0) / n;
      const outerOffset = (n - 1) / 2;
      const effectiveStep = outerOffset > 0
        ? Math.min(step, maxDisplacement / outerOffset)
        : step;

      // Spread cluster around centerY using fan offsets
      for (const [i, offset] of fanOffsets(n).entries()) {
        const spreadLabel = { ...cluster[i], baseY: centerY + offset * effectiveStep };
        // Map spread result back to its original input index
        const inputItem = group.find(item => item.label === cluster[i]);
        if (inputItem) {
          outputByInputIndex.set(inputItem.index, spreadLabel);
        }
      }
    }
  }

  // Rebuild result in input order (not sorted-position order)
  const result: LabelSpec[] = [];
  for (let i = 0; i < labels.length; i++) {
    const spread = outputByInputIndex.get(i);
    if (spread) {
      result.push(spread);
    }
  }

  return result;
}
