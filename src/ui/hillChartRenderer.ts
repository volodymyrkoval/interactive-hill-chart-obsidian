import type { Curve } from '../model/curve';
import type { Size } from '../types';
import type { HillChartConfig, DotStyle } from '../model/hillChartConfig';
import type { HillChartParseError } from '../model/parseErrors';
import { HillPosition } from '../model/hillPosition';
import { LabelLayout } from './labelLayout';
import { ChartChromeRenderer } from './chartChromeRenderer';
import type { RenderContext } from './chartChromeRenderer';
import { createSharedDragState } from './dotDragController';
import type { SharedDragState } from './dotDragController';
import { DotRenderer } from './dotRenderer';
import { resolveChartStyle } from '../obsidian/resolvedStylesApplier';
import type { ResolvedChartStyle } from '../model/chartStyle';
import { LabelCeilingPolicy } from './labelCeilingPolicy';
import { SECTION_LABEL_OFFSET } from './visualConstants';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BASELINE_Y_RATIO = 0.92;

export interface RenderOptions {
  config?: HillChartConfig;
  onNoteClick?: (noteName: string, newLeaf: boolean) => void;
  onPositionChange?: (specIndex: number, newPosition: HillPosition) => void;
}

interface DotRenderContext {
  curve: Curve;
  size: Size;
  baselineY: number;
  onNoteClick?: (noteName: string, newLeaf: boolean) => void;
  onPositionChange?: (specIndex: number, newPosition: HillPosition) => void;
  globalDotStyle?: DotStyle;
  layout: LabelLayout;
}

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 150;

export class HillChartRenderer {
  private mountedSvg: SVGSVGElement | null = null;
  private dragCleanups: Array<() => void> = [];
  private labelLayout: LabelLayout | null = null;
  private readonly labelCeilingPolicy = new LabelCeilingPolicy();
  private sharedDragState: SharedDragState = createSharedDragState();

  render(container: HTMLElement, curve: Curve, options: RenderOptions = {}): void {
    const { config = { dots: [], errors: [] }, onNoteClick, onPositionChange } = options;
    this.destroy();
    const layout = new LabelLayout();
    this.labelLayout = layout;

    const resolved = resolveChartStyle(config.chart);
    const size: Size = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
    if (config.errors.length > 0) this.renderErrorStrip(container, config.errors);

    const labelFontSize = this.computeSectionLabelFontSize(resolved);
    const svg = this.buildSvgRoot(size, labelFontSize);
    const baselineY = size.height * BASELINE_Y_RATIO;

    const ctx: RenderContext = { svg, size, baselineY };
    this.renderChrome(ctx, curve, resolved);

    const dotCtx: DotRenderContext = {
      curve, size, baselineY, onNoteClick, onPositionChange, globalDotStyle: resolved.dot, layout,
    };
    this.renderAllDots(svg, config, dotCtx);
    this.finalizeLabelLayout(layout, config, resolved, baselineY);

    container.appendChild(svg);
    this.mountedSvg = svg;
  }

  private renderChrome(ctx: RenderContext, curve: Curve, resolved: ResolvedChartStyle): void {
    const chrome = new ChartChromeRenderer(ctx);
    chrome.renderBaseline(resolved.baseline);
    chrome.renderDivider(curve, resolved.divider);
    chrome.renderCurvePath(curve, resolved.curve);
    chrome.renderSectionLabels(resolved);
  }

  private finalizeLabelLayout(layout: LabelLayout, config: HillChartConfig, resolved: ResolvedChartStyle, baselineY: number): void {
    const sectionFontSize = this.computeSectionLabelFontSize(resolved);
    this.labelCeilingPolicy.compute(baselineY, sectionFontSize, config, resolved);
    const ceiling = this.labelCeilingPolicy.getCeiling();
    if (ceiling !== null) {
      layout.finalize(ceiling, this.labelCeilingPolicy.getMaxFontSize());
    }
  }

  private computeSectionLabelFontSize(resolved: ResolvedChartStyle): number {
    return Math.max(resolved.uphill.fontSize, resolved.downhill.fontSize);
  }

  private buildSvgRoot(size: Size, labelFontSize: number): SVGSVGElement {
    const viewBoxHeight = size.height + SECTION_LABEL_OFFSET + labelFontSize;
    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('viewBox', `0 0 ${size.width} ${viewBoxHeight}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', 'auto');
    return svg;
  }

  private renderAllDots(svg: SVGSVGElement, config: HillChartConfig, dotCtx: DotRenderContext): void {
    const ctx: RenderContext = { svg, size: dotCtx.size, baselineY: dotCtx.baselineY };
    const dotRenderer = new DotRenderer(ctx);
    config.dots.forEach((dot, dotIndex) => {
      dotRenderer.render(dot, dotIndex, {
        curve: dotCtx.curve,
        size: dotCtx.size,
        onNoteClick: dotCtx.onNoteClick,
        onPositionChange: dotCtx.onPositionChange,
        globalDotStyle: dotCtx.globalDotStyle,
        labelLayout: dotCtx.layout,
        sharedDragState: this.sharedDragState,
        labelCeilingPolicy: this.labelCeilingPolicy,
        registerCleanup: (fn) => this.dragCleanups.push(fn),
      });
    });
  }

  private renderErrorStrip(container: HTMLElement, errors: HillChartParseError[]): void {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'hill-chart-error';
    for (const err of errors) {
      const p = document.createElement('p');
      p.textContent = `[${err.severity}] ${err.message}`;
      errorDiv.appendChild(p);
    }
    container.appendChild(errorDiv);
  }

  destroy(): void {
    this.sharedDragState.token = this.sharedDragState.token.next(); // invalidate any in-flight drag gesture
    this.sharedDragState.activeDotIndex = null;
    for (const cleanup of this.dragCleanups) cleanup();
    this.dragCleanups = [];
    this.labelLayout = null;
    this.labelCeilingPolicy.reset();
    if (this.mountedSvg && this.mountedSvg.parentElement) {
      this.mountedSvg.parentElement.removeChild(this.mountedSvg);
    }
    this.mountedSvg = null;
  }
}
