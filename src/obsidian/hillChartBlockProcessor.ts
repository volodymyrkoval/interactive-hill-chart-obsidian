import type { App, MarkdownPostProcessorContext } from 'obsidian';
import { MarkdownRenderChild } from 'obsidian';
import { HillCurve } from '../model/hillCurve';
import { HillChartRenderer } from '../ui/hillChartRenderer';
import { parseYamlHillChart } from './parseYamlHillChart';
import type { HillPosition } from '../model/hillPosition';
import type { Logger } from '../app/logger';
import { consoleLogger } from '../app/logger';
import type { PositionWriter } from '../app/positionWriter';

class HillChartChild extends MarkdownRenderChild {
  constructor(
    el: HTMLElement,
    private readonly renderer: HillChartRenderer,
  ) {
    super(el);
  }

  onunload(): void {
    this.renderer.destroy();
  }
}

export function createHillChartBlockProcessor(
  app: App,
  positionWriter: PositionWriter,
  logger: Logger = consoleLogger,
): (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void {
  return (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    const config = parseYamlHillChart(source);
    const curve = new HillCurve();
    const renderer = new HillChartRenderer();

    renderer.render(el, curve, {
      config,
      onNoteClick: (noteName, newLeaf) => {
        app.workspace.openLinkText(noteName, '', newLeaf);
      },
      onPositionChange: (specIndex: number, newPosition: HillPosition) => {
        const sectionInfo = ctx.getSectionInfo(el);
        const convertedSectionInfo = sectionInfo ? { lineStart: sectionInfo.lineStart, lineEnd: sectionInfo.lineEnd } : null;
        void positionWriter
          .write({
            sourcePath: ctx.sourcePath,
            sectionInfo: convertedSectionInfo,
            oldContent: source,
            specIndex,
            newPosition,
          })
          .then((result) => {
            if (!result.ok) {
              logger.warn('[hill-chart] writeHillChartPosition failed', { error: result.error });
            }
          });
      },
    });

    ctx.addChild(new HillChartChild(el, renderer));
  };
}
