import type { App } from 'obsidian';
import type { PositionWriter, WriteHillChartPositionRequest } from '../app/positionWriter';
import type { Result, WriteError } from '../types';
import { writeHillChartPosition } from './writeHillChartPosition';

/**
 * Concrete `PositionWriter` that delegates to `writeHillChartPosition`.
 * The block processor depends on `PositionWriter`, not on `App`;
 * `main.ts` wires this implementation in at composition root.
 */
export class ObsidianPositionWriter implements PositionWriter {
  constructor(private readonly app: App) {}

  write(req: WriteHillChartPositionRequest): Promise<Result<void, WriteError>> {
    return writeHillChartPosition(this.app, req);
  }
}
