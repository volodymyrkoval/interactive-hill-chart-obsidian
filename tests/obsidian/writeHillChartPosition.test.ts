import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeHillChartPosition } from '../../src/obsidian/writeHillChartPosition';
import type { App, TFile, MarkdownSectionInformation } from 'obsidian';
import { TFile as MockTFile } from '../__mocks__/obsidian';
import { HillPosition } from '../../src/model/hillPosition';

function pos(n: number): HillPosition {
  return HillPosition.fromPercent(n);
}

// Minimal mock factory for App + Vault
function makeApp(fileContent: string): {
  app: App;
  modifyMock: ReturnType<typeof vi.fn>;
} {
  const modifyMock = vi.fn().mockResolvedValue(undefined);

  const app = {
    vault: {
      getAbstractFileByPath: vi.fn().mockReturnValue(new MockTFile('test.md') as unknown as TFile),
      read: vi.fn().mockResolvedValue(fileContent),
      modify: modifyMock,
    },
  } as unknown as App;

  return { app, modifyMock };
}

/**
 * Realistic Obsidian mock: info.text is the FULL document source,
 * not just the inner block content.
 */
function makeSectionInfo(
  fullDocText: string,
  lineStart: number,
  lineEnd: number,
): MarkdownSectionInformation {
  return { text: fullDocText, lineStart, lineEnd };
}

describe('writeHillChartPosition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls vault.modify with the updated spec line (happy path)', async () => {
    const fileContent = [
      'Some markdown',
      '```hill-chart',
      'dots:',
      '  - 50: My Task',
      '```',
      'More markdown',
    ].join('\n');

    const { app, modifyMock } = makeApp(fileContent);
    const sectionInfo = makeSectionInfo(fileContent, 1, 4);
    const oldContent = 'dots:\n  - 50: My Task';

    const result = await writeHillChartPosition(app, {
      sourcePath: 'test.md',
      sectionInfo,
      oldContent,
      specIndex: 0,
      newPosition: pos(75),
    });

    expect(result.ok).toBe(true);
    expect(modifyMock).toHaveBeenCalledOnce();
    const [, newContent] = modifyMock.mock.calls[0];
    expect(newContent).toContain('  - 75: My Task');
    expect(newContent).not.toContain('  - 50: My Task');
  });

  it('returns SectionInfoMissing error when sectionInfo is null', async () => {
    const { app, modifyMock } = makeApp('anything');

    const result = await writeHillChartPosition(app, {
      sourcePath: 'test.md',
      sectionInfo: null,
      oldContent: 'anything',
      specIndex: 0,
      newPosition: pos(50),
    });

    expect(modifyMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('SectionInfoMissing');
    }
  });

  it('returns FileNotFound error when file is not in vault', async () => {
    const { app, modifyMock } = makeApp('anything');
    (app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const fileContent = 'Some markdown\n```hill-chart\ndots:\n  - 50: Task\n```\n';
    const sectionInfo = makeSectionInfo(fileContent, 1, 4);

    const result = await writeHillChartPosition(app, {
      sourcePath: 'missing.md',
      sectionInfo,
      oldContent: 'dots:\n  - 50: Task',
      specIndex: 0,
      newPosition: pos(75),
    });

    expect(modifyMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('FileNotFound');
      if (result.error.kind === 'FileNotFound') {
        expect(result.error.path).toBe('missing.md');
      }
    }
  });

  it('returns StaleContent error when file inner block does not match oldContent', async () => {
    // File was edited between the render and the drop
    const fileContent = [
      'Some markdown',
      '```hill-chart',
      'dots:',
      '  - 99: Changed By User',
      '```',
    ].join('\n');

    const { app, modifyMock } = makeApp(fileContent);
    const sectionInfo = makeSectionInfo(fileContent, 1, 4);
    const oldContent = 'dots:\n  - 50: Original';

    const result = await writeHillChartPosition(app, {
      sourcePath: 'test.md',
      sectionInfo,
      oldContent,
      specIndex: 0,
      newPosition: pos(75),
    });

    expect(modifyMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('StaleContent');
    }
  });

  it('splices updated block back into multi-line file correctly', async () => {
    const lines = [
      'Header line',
      '```hill-chart',
      'dots:',
      '  - 25: Alpha',
      '  - 75: Beta',
      '```',
      'Footer line',
    ];
    const fileContent = lines.join('\n');
    const { app, modifyMock } = makeApp(fileContent);
    const sectionInfo = makeSectionInfo(fileContent, 1, 5);
    const innerText = 'dots:\n  - 25: Alpha\n  - 75: Beta';

    const result = await writeHillChartPosition(app, {
      sourcePath: 'test.md',
      sectionInfo,
      oldContent: innerText,
      specIndex: 1,
      newPosition: pos(50),
    });

    expect(result.ok).toBe(true);
    expect(modifyMock).toHaveBeenCalledOnce();
    const [, newContent] = modifyMock.mock.calls[0];
    const newLines = newContent.split('\n');
    expect(newLines[0]).toBe('Header line');
    expect(newLines[2]).toBe('dots:');
    expect(newLines[3]).toBe('  - 25: Alpha');
    expect(newLines[4]).toBe('  - 50: Beta');
    expect(newLines[6]).toBe('Footer line');
  });

  it('returns WriteFailed error when vault.modify rejects', async () => {
    const fileContent = [
      'Some markdown',
      '```hill-chart',
      'dots:',
      '  - 50: My Task',
      '```',
    ].join('\n');

    const { app } = makeApp(fileContent);
    const cause = new Error('disk full');
    (app.vault.modify as ReturnType<typeof vi.fn>).mockRejectedValue(cause);

    const sectionInfo = makeSectionInfo(fileContent, 1, 4);
    const oldContent = 'dots:\n  - 50: My Task';

    const result = await writeHillChartPosition(app, {
      sourcePath: 'test.md',
      sectionInfo,
      oldContent,
      specIndex: 0,
      newPosition: pos(75),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('WriteFailed');
      if (result.error.kind === 'WriteFailed') {
        expect(result.error.cause).toBe(cause);
      }
    }
  });

  it('returns ReadFailed error when vault.read rejects', async () => {
    const fileContent = [
      '```hill-chart',
      'dots:',
      '  - 50: My Task',
      '```',
    ].join('\n');

    const { app } = makeApp(fileContent);
    const cause = new Error('read error');
    (app.vault.read as ReturnType<typeof vi.fn>).mockRejectedValue(cause);

    const sectionInfo = makeSectionInfo(fileContent, 0, 3);

    const result = await writeHillChartPosition(app, {
      sourcePath: 'test.md',
      sectionInfo,
      oldContent: 'dots:\n  - 50: My Task',
      specIndex: 0,
      newPosition: pos(75),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('ReadFailed');
      if (result.error.kind === 'ReadFailed') {
        expect(result.error.cause).toBe(cause);
      }
    }
  });

  it('returns NotATFile error when getAbstractFileByPath returns a folder', async () => {
    const folderLike = { path: 'some-folder' }; // plain object — NOT a TFile instance
    const { app, modifyMock } = makeApp('anything');
    (app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(folderLike);

    const fileContent = 'Some markdown\n```hill-chart\ndots:\n  - 50: Task\n```\n';
    const sectionInfo = makeSectionInfo(fileContent, 1, 4);

    const result = await writeHillChartPosition(app, {
      sourcePath: 'some-folder',
      sectionInfo,
      oldContent: 'dots:\n  - 50: Task',
      specIndex: 0,
      newPosition: pos(75),
    });

    expect(modifyMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('NotATFile');
      if (result.error.kind === 'NotATFile') {
        expect(result.error.path).toBe('some-folder');
      }
    }
  });

  it('no-op: does NOT call vault.modify when position is unchanged', async () => {
    const fileContent = [
      'Some markdown',
      '```hill-chart',
      'dots:',
      '  - 50: My Task',
      '```',
      'More markdown',
    ].join('\n');

    const { app, modifyMock } = makeApp(fileContent);
    const sectionInfo = makeSectionInfo(fileContent, 1, 4);
    const oldContent = 'dots:\n  - 50: My Task';

    // newPosition = 50 = same as current → no-op
    const result = await writeHillChartPosition(app, {
      sourcePath: 'test.md',
      sectionInfo,
      oldContent,
      specIndex: 0,
      newPosition: pos(50),
    });

    expect(modifyMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  // Edge cases for B18: characterization tests that must survive the
  // spliceInnerBlock → FencedBlockRegion.replaceInner refactor.

  it('stale-write guard: fires when vault content differs from oldContent (characterization)', async () => {
    // The guard compares the inner block extracted from the current vault file
    // against the oldContent snapshot held by the drag handler. If they differ,
    // the user edited the file between render and drop — we must not overwrite.
    const vaultContent = [
      '```hill-chart',
      'dots:',
      '  - 80: Edited By User',
      '```',
    ].join('\n');

    const { app, modifyMock } = makeApp(vaultContent);
    const sectionInfo = makeSectionInfo(vaultContent, 0, 3);
    // oldContent snapshot is from before the user's edit
    const oldContent = 'dots:\n  - 50: Original';

    const result = await writeHillChartPosition(app, {
      sourcePath: 'test.md',
      sectionInfo,
      oldContent,
      specIndex: 0,
      newPosition: pos(75),
    });

    expect(modifyMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('StaleContent');
  });

  it('block at start of file (lineStart=0): writes correctly with no preceding content', async () => {
    // Block is the very first thing in the file — no header lines above the fence.
    const fileContent = [
      '```hill-chart',
      'dots:',
      '  - 50: Task',
      '```',
      'Footer',
    ].join('\n');

    const { app, modifyMock } = makeApp(fileContent);
    const sectionInfo = makeSectionInfo(fileContent, 0, 3);
    const oldContent = 'dots:\n  - 50: Task';

    const result = await writeHillChartPosition(app, {
      sourcePath: 'test.md',
      sectionInfo,
      oldContent,
      specIndex: 0,
      newPosition: pos(90),
    });

    expect(result.ok).toBe(true);
    expect(modifyMock).toHaveBeenCalledOnce();
    const [, newContent] = modifyMock.mock.calls[0];
    expect(newContent).toContain('  - 90: Task');
    expect(newContent).toContain('Footer');
    expect(newContent.startsWith('```hill-chart')).toBe(true);
  });

  it('empty block (fences adjacent, no inner lines): returns StaleContent when oldContent is non-empty', async () => {
    // Inner block is empty but oldContent claims there is content — stale guard fires.
    const fileContent = '```hill-chart\n```';
    const { app, modifyMock } = makeApp(fileContent);
    const sectionInfo = makeSectionInfo(fileContent, 0, 1);
    const oldContent = 'dots:\n  - 50: Task';

    const result = await writeHillChartPosition(app, {
      sourcePath: 'test.md',
      sectionInfo,
      oldContent,
      specIndex: 0,
      newPosition: pos(75),
    });

    expect(modifyMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('StaleContent');
  });

  it('block at end of file with no trailing newline: preserves absence of trailing newline', async () => {
    // File ends immediately after the closing fence — no trailing newline.
    const fileContent = 'Header\n```hill-chart\ndots:\n  - 50: Task\n```';
    const { app, modifyMock } = makeApp(fileContent);
    const sectionInfo = makeSectionInfo(fileContent, 1, 4);
    const oldContent = 'dots:\n  - 50: Task';

    const result = await writeHillChartPosition(app, {
      sourcePath: 'test.md',
      sectionInfo,
      oldContent,
      specIndex: 0,
      newPosition: pos(70),
    });

    expect(result.ok).toBe(true);
    expect(modifyMock).toHaveBeenCalledOnce();
    const [, newContent] = modifyMock.mock.calls[0];
    expect(newContent).toContain('  - 70: Task');
    // Must NOT have gained a trailing newline
    expect(newContent.endsWith('\n')).toBe(false);
  });

  it('block at end of file with trailing newline: preserves trailing newline', async () => {
    // File ends with a newline after the closing fence.
    const fileContent = 'Header\n```hill-chart\ndots:\n  - 50: Task\n```\n';
    const { app, modifyMock } = makeApp(fileContent);
    const sectionInfo = makeSectionInfo(fileContent, 1, 4);
    const oldContent = 'dots:\n  - 50: Task';

    const result = await writeHillChartPosition(app, {
      sourcePath: 'test.md',
      sectionInfo,
      oldContent,
      specIndex: 0,
      newPosition: pos(70),
    });

    expect(result.ok).toBe(true);
    expect(modifyMock).toHaveBeenCalledOnce();
    const [, newContent] = modifyMock.mock.calls[0];
    expect(newContent).toContain('  - 70: Task');
    // Must preserve the trailing newline
    expect(newContent.endsWith('\n')).toBe(true);
  });
});
