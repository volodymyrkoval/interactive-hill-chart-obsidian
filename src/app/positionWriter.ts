import type { HillPosition } from '../model/hillPosition';
import type { Result, WriteError } from '../types';

/** Minimal section metadata needed to splice updated content back into the file. */
export interface SectionInfo {
  lineStart: number;
  lineEnd: number;
}

/** DTO carried from the drag handler to the vault write path. */
export interface WriteHillChartPositionRequest {
  sourcePath: string;
  sectionInfo: SectionInfo | null;
  newPosition: HillPosition;
  specIndex: number;
  oldContent: string;
}

/**
 * Abstraction over the vault write path for hill-chart positions.
 * Allows the block processor / UI layer to remain decoupled from the
 * Obsidian `App` object. Composed in `main.ts`.
 */
export interface PositionWriter {
  write(req: WriteHillChartPositionRequest): Promise<Result<void, WriteError>>;
}
