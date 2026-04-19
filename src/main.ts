import { Plugin } from 'obsidian';
import { createHillChartBlockProcessor } from './obsidian/hillChartBlockProcessor';
import { ObsidianPositionWriter } from './obsidian/obsidianPositionWriter';

export default class HillChartPlugin extends Plugin {
  async onload(): Promise<void> {
    const positionWriter = new ObsidianPositionWriter(this.app);
    this.registerMarkdownCodeBlockProcessor(
      'hill-chart',
      createHillChartBlockProcessor(this.app, positionWriter),
    );
  }

  async onunload(): Promise<void> {
    // Cleanup handled by Obsidian
  }
}
