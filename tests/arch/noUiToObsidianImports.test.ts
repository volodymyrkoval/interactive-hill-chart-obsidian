import { execSync } from 'child_process';
import { describe, it, expect } from 'vitest';

describe('Architecture: ui layer isolation', () => {
  it('should have no imports from obsidian/ in ui/ files, except the permitted resolvedStylesApplier seam', () => {
    // resolvedStylesApplier is the intentional ui→obsidian seam (W1 plan):
    // HillChartRenderer imports the schema-driven resolveChartStyle from there.
    const result = execSync(
      `grep -r "from ['\\\"].*obsidian" src/ui/ 2>/dev/null | grep -v "resolvedStylesApplier" || echo ""`,
      { encoding: 'utf-8' },
    ).trim();

    expect(result).toBe('');
  });
});
