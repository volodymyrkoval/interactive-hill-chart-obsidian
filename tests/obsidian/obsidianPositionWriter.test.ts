import { describe, it, expect, vi } from 'vitest';
import { ObsidianPositionWriter } from '../../src/obsidian/obsidianPositionWriter';
import * as writeModule from '../../src/obsidian/writeHillChartPosition';
import type { App } from 'obsidian';
import type { WriteHillChartPositionRequest } from '../../src/app/positionWriter';
import type { HillPosition } from '../../src/model/hillPosition';
import type { Result, WriteError } from '../../src/types';

function makeApp(): App {
  return {
    vault: {
      getAbstractFileByPath: vi.fn(),
      read: vi.fn(),
      modify: vi.fn(),
    },
  } as unknown as App;
}

function makeRequest(): WriteHillChartPositionRequest {
  const position: HillPosition = { t: 0.5 } as unknown as HillPosition;
  return {
    sourcePath: 'note.md',
    sectionInfo: { lineStart: 0, lineEnd: 2 },
    oldContent: 'dots:\n  - 50: Task',
    specIndex: 0,
    newPosition: position,
  };
}

describe('ObsidianPositionWriter', () => {
  it('delegates write() to writeHillChartPosition with app and request and returns its Result', async () => {
    const app = makeApp();
    const writer = new ObsidianPositionWriter(app);
    const req = makeRequest();

    const expected = { ok: true, value: undefined } as const;
    const spy = vi
      .spyOn(writeModule, 'writeHillChartPosition')
      .mockResolvedValue(expected);

    const result = await writer.write(req);

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(app, req);
    expect(result).toBe(expected);

    spy.mockRestore();
  });

  it('propagates error Result from writeHillChartPosition', async () => {
    const app = makeApp();
    const writer = new ObsidianPositionWriter(app);
    const req = makeRequest();

    const expected: Result<void, WriteError> = {
      ok: false,
      error: { kind: 'StaleContent' },
    };
    const spy = vi
      .spyOn(writeModule, 'writeHillChartPosition')
      .mockResolvedValue(expected);

    const result = await writer.write(req);

    expect(result).toEqual(expected);
    spy.mockRestore();
  });
});
