import { spawnSync } from 'child_process';
import { describe, it, expect } from 'vitest';

describe('Architecture', () => {
  it('should have no circular dependencies in src/', () => {
    const result = spawnSync('npx', ['madge', '--circular', 'src/'], {
      cwd: process.cwd(),
    });

    expect(result.status).toBe(0, `madge found circular dependencies.\nstdout:\n${result.stdout?.toString() ?? '(empty)'}\nstderr:\n${result.stderr?.toString() ?? '(empty)'}`);
  });
});
