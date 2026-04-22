import { Plugin } from 'obsidian';
import { createHillChartBlockProcessor } from './obsidian/hillChartBlockProcessor';
import { ObsidianPositionWriter } from './obsidian/obsidianPositionWriter';

export default class HillChartPlugin extends Plugin {
  onload(): void {
    const positionWriter = new ObsidianPositionWriter(this.app);
    this.registerMarkdownCodeBlockProcessor(
      'hill-chart',
      createHillChartBlockProcessor(this.app, positionWriter),
    );
  }

  onunload(): void {
    // Cleanup handled by Obsidian
  }
}
