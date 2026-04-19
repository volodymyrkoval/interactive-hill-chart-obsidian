import { execSync } from 'child_process';
import { describe, it, expect } from 'vitest';

describe('Architecture: app layer isolation', () => {
  it('should have no imports from obsidian/ in app/ files', () => {
    const result = execSync(
      `grep -r "from ['\\\"].*obsidian" src/app/ 2>/dev/null || echo ""`,
      { encoding: 'utf-8' },
    ).trim();

    expect(result).toBe('');
  });
});
