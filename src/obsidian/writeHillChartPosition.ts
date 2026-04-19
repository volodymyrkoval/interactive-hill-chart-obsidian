import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import { updateHillChartSource } from './updateHillChartSource';
import { FencedBlockRegion } from './fencedBlockRegion';
import type { WriteHillChartPositionRequest } from '../app/positionWriter';
import type { Result, WriteError } from '../types';

/**
 * Reads the vault file at `sourcePath`, validates that the inner block
 * content still matches `oldContent` (stale-write guard), then calls
 * `updateHillChartSource` and splices the result back into the full file
 * before writing via `vault.modify`.
 *
 * Returns a typed `Result` so callers can decide how to surface failures.
 * Logging is the caller's responsibility.
 */
export async function writeHillChartPosition(
  app: App,
  req: WriteHillChartPositionRequest,
): Promise<Result<void, WriteError>> {
  const { sourcePath, sectionInfo, newPosition, specIndex, oldContent } = req;

  if (!sectionInfo) {
    return { ok: false, error: { kind: 'SectionInfoMissing' } };
  }

  const fileOrError = resolveFile(app, sourcePath);
  if (!(fileOrError instanceof TFile)) {
    return { ok: false, error: fileOrError };
  }
  const file = fileOrError;

  const readResult = await readFileContent(app, file);
  if (typeof readResult !== 'string') {
    return { ok: false, error: readResult };
  }
  const content = readResult;

  const region = new FencedBlockRegion(content, sectionInfo.lineStart, sectionInfo.lineEnd);
  const currentInner = region.readInner();

  if (isStale(currentInner, oldContent)) {
    return { ok: false, error: { kind: 'StaleContent' } };
  }

  const updatedInner = updateHillChartSource(oldContent, specIndex, newPosition);

  // No-op: position didn't actually change
  if (updatedInner === oldContent) return { ok: true, value: undefined };

  const newContent = region.replaceInner(updatedInner);

  const writeError = await writeFile(app, file, newContent);
  if (writeError) {
    return { ok: false, error: writeError };
  }
  return { ok: true, value: undefined };
}

function resolveFile(app: App, path: string): TFile | WriteError {
  const abstractFile = app.vault.getAbstractFileByPath(path);
  if (!abstractFile) {
    return { kind: 'FileNotFound', path };
  }
  if (!(abstractFile instanceof TFile)) {
    return { kind: 'NotATFile', path };
  }
  return abstractFile;
}

async function readFileContent(app: App, file: TFile): Promise<string | WriteError> {
  try {
    return await app.vault.read(file);
  } catch (cause) {
    return { kind: 'ReadFailed', cause };
  }
}

function isStale(current: string, expected: string): boolean {
  return current !== expected;
}

async function writeFile(app: App, file: TFile, content: string): Promise<WriteError | null> {
  try {
    await app.vault.modify(file, content);
    return null;
  } catch (cause) {
    return { kind: 'WriteFailed', cause };
  }
}
