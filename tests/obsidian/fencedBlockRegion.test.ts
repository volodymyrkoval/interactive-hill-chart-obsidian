import { describe, it, expect } from 'vitest';
import { FencedBlockRegion } from '../../src/obsidian/fencedBlockRegion';

// Document layout used across most tests:
//   line 0: before line
//   line 1: ```hill-chart   (startLine)
//   line 2: inner line(s)
//   line 3: ```             (endLine)
//   line 4: after line

describe('FencedBlockRegion.readInner', () => {
  it('returns the single line between the fences', () => {
    const doc = 'before\n```hill-chart\n50: My Feature\n```\nafter';
    const region = new FencedBlockRegion(doc, 1, 3);
    expect(region.readInner()).toBe('50: My Feature');
  });

  it('returns multiple lines between the fences joined by newlines', () => {
    const doc = 'before\n```hill-chart\n50: Alpha\n75: Beta\n```\nafter';
    const region = new FencedBlockRegion(doc, 1, 4);
    expect(region.readInner()).toBe('50: Alpha\n75: Beta');
  });

  it('returns empty string when fences are adjacent (no inner lines)', () => {
    const doc = 'before\n```hill-chart\n```\nafter';
    const region = new FencedBlockRegion(doc, 1, 2);
    expect(region.readInner()).toBe('');
  });

  it('preserves internal newlines in multi-line inner content', () => {
    const doc = '```hill-chart\nline one\nline two\nline three\n```';
    const region = new FencedBlockRegion(doc, 0, 4);
    const inner = region.readInner();
    expect(inner).toContain('\n');
    expect(inner.split('\n')).toHaveLength(3);
  });
});

describe('FencedBlockRegion.replaceInner', () => {
  it('replaces single-line inner with single-line produces correct full content', () => {
    const doc = 'before\n```hill-chart\n50: My Feature\n```\nafter';
    const region = new FencedBlockRegion(doc, 1, 3);
    const result = region.replaceInner('75: My Feature');
    expect(result).toBe('before\n```hill-chart\n75: My Feature\n```\nafter');
  });

  it('replaces single-line inner with multi-line inserts all new lines', () => {
    const doc = 'before\n```hill-chart\n50: My Feature\n```\nafter';
    const region = new FencedBlockRegion(doc, 1, 3);
    const result = region.replaceInner('50: Alpha\n75: Beta');
    expect(result).toBe('before\n```hill-chart\n50: Alpha\n75: Beta\n```\nafter');
  });

  it('preserves content before the fenced block unchanged', () => {
    const doc = 'line one\nline two\n```hill-chart\n50: Dot\n```';
    const region = new FencedBlockRegion(doc, 2, 4);
    const result = region.replaceInner('99: Dot');
    expect(result.startsWith('line one\nline two\n')).toBe(true);
  });

  it('preserves content after the fenced block unchanged', () => {
    const doc = '```hill-chart\n50: Dot\n```\nline after one\nline after two';
    const region = new FencedBlockRegion(doc, 0, 2);
    const result = region.replaceInner('99: Dot');
    expect(result.endsWith('\nline after one\nline after two')).toBe(true);
  });

  it('preserves trailing newline when original document ends with one', () => {
    const doc = '```hill-chart\n50: Dot\n```\n';
    const region = new FencedBlockRegion(doc, 0, 2);
    const result = region.replaceInner('75: Dot');
    expect(result).toBe('```hill-chart\n75: Dot\n```\n');
  });

  it('does not add trailing newline when original document has none', () => {
    const doc = '```hill-chart\n50: Dot\n```';
    const region = new FencedBlockRegion(doc, 0, 2);
    const result = region.replaceInner('75: Dot');
    expect(result).toBe('```hill-chart\n75: Dot\n```');
  });
});
