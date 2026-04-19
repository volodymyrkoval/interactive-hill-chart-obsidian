import { describe, it, expect } from 'vitest';
import { SECTION_LABEL_OFFSET, DEFAULT_DOT_LABEL_FONT_SIZE } from '../../src/ui/visualConstants';

describe('visualConstants', () => {
  it('exports SECTION_LABEL_OFFSET with value 18', () => {
    expect(SECTION_LABEL_OFFSET).toBe(18);
  });

  it('exports DEFAULT_DOT_LABEL_FONT_SIZE with value 12', () => {
    expect(DEFAULT_DOT_LABEL_FONT_SIZE).toBe(12);
  });
});
