import type { Curve } from '../model/curve';
import type { Size } from '../types';
import type { HillChartItem, DotStyle } from '../model/hillChartConfig';
import { resolveDotStyle } from './dotStyle';
import { LabelLayout } from './labelLayout';
import type { RenderContext } from './chartChromeRenderer';
import { DotDragController } from './dotDragController';
import type { SharedDragState } from './dotDragController';
import type { LabelCeilingPolicy } from './labelCeilingPolicy';
import { computeLabelPlacement } from './labelPlacement';
import { applyPlacement } from './labelDragBinding';
import { applyResolvedOpacity } from './opacityHelper';
import { HOVER_OPACITY, DEFAULT_DOT_LABEL_FONT_SIZE } from './visualConstants';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_DOT_RADIUS = 6;

export interface RendererHooks {
  curve: Curve;
  size: Size;
  globalDotStyle?: DotStyle;
  labelLayout: LabelLayout;
  sharedDragState: SharedDragState;
  labelCeilingPolicy: LabelCeilingPolicy;
  /** Push a cleanup callback so the renderer can tear down event listeners. */
  registerCleanup: (fn: () => void) => void;
}

export interface NoteClickBindings {
  onNoteClick?: (noteName: string, newLeaf: boolean) => void;
  onPositionChange?: (specIndex: number, newPosition: import('../model/hillPosition').HillPosition) => void;
}

export interface DotRenderOptions extends RendererHooks, NoteClickBindings {}

interface HoverContext {
  hoverState: { isDragging: boolean };
  restoreOpacity: () => void;
  registerCleanup: (fn: () => void) => void;
}

interface LabelContext {
  effective: ReturnType<typeof resolveDotStyle>;
  labelLayout: LabelLayout;
}

interface CircleMountResult {
  circle: SVGCircleElement;
  hoverState: { isDragging: boolean };
  hoverCtx: HoverContext;
}

interface DragBindingContext {
  svg: SVGSVGElement;
  circle: SVGCircleElement;
  textEl: SVGTextElement | null;
  specIndex: number;
  item: HillChartItem;
  effective: ReturnType<typeof resolveDotStyle>;
  hoverState: { isDragging: boolean };
  options: DotRenderOptions;
}

export class DotRenderer {
  constructor(private ctx: RenderContext) {}

  render(item: HillChartItem, specIndex: number, options: DotRenderOptions): SVGCircleElement {
    const { curve, size, globalDotStyle } = options;
    const effective = resolveDotStyle(globalDotStyle, item.style);
    const t = item.position.toT();
    const { x, y } = curve.toSvgPoint(t, size);

    const { circle, hoverState, hoverCtx } = this.createAndMountCircle(x, y, effective, options);
    const textEl = this.createAndMountLabel(item, { t, x, y }, effective, circle, hoverCtx, options);
    this.attachDragIfEditable({ svg: this.ctx.svg, circle, textEl, specIndex, item, effective, hoverState, options });

    return circle;
  }

  private createAndMountCircle(
    x: number,
    y: number,
    effective: ReturnType<typeof resolveDotStyle>,
    options: DotRenderOptions,
  ): CircleMountResult {
    const { svg } = this.ctx;
    const { registerCleanup } = options;

    const circle = this.createDotCircle(x, y, effective);
    svg.appendChild(circle);

    const hoverState = { isDragging: false };
    const restoreOpacity = (): void => { applyResolvedOpacity(circle, effective.opacity); };
    const hoverCtx: HoverContext = { hoverState, restoreOpacity, registerCleanup };

    this.attachHoverFeedback(circle, hoverCtx);
    return { circle, hoverState, hoverCtx };
  }

  private createAndMountLabel(
    item: HillChartItem,
    dotPos: { t: number; x: number; y: number },
    effective: ReturnType<typeof resolveDotStyle>,
    circle: SVGCircleElement,
    hoverCtx: HoverContext,
    options: DotRenderOptions,
  ): SVGTextElement | null {
    const { onNoteClick, onPositionChange, labelLayout, registerCleanup } = options;
    const { svg } = this.ctx;
    if (!item.label) return null;

    const labelCtx: LabelContext = { effective, labelLayout };
    const textEl = this.createDotLabel(item, dotPos, labelCtx);
    this.attachLabelHoverFeedback(textEl, circle, hoverCtx);
    this.wireNoteLinkClick(textEl, item, { onNoteClick, onPositionChange, registerCleanup });
    svg.appendChild(textEl);
    return textEl;
  }

  private attachDragIfEditable(ctx: DragBindingContext): void {
    const { svg, circle, textEl, specIndex, item, effective, hoverState, options } = ctx;
    const { onPositionChange, onNoteClick, labelLayout, sharedDragState, curve, size, labelCeilingPolicy, registerCleanup } = options;
    if (!onPositionChange) return;

    const entries = labelLayout.getEntries();
    const labelEntry = textEl !== null ? entries[entries.length - 1] : null;
    const controller = new DotDragController({
      dom: { svg, circle, textEl },
      identity: { specIndex, initialPosition: item.position, resolvedOpacity: effective.opacity },
      label: { labelEntry, labelLayout, labelCeilingPolicy },
      shared: { hoverState, dragState: sharedDragState, curve, size },
      callbacks: { onPositionChange, onNoteClick },
    });
    registerCleanup(() => controller.dispose());
  }

  private createDotCircle(x: number, y: number, effective: ReturnType<typeof resolveDotStyle>): SVGCircleElement {
    const circle = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
    circle.setAttribute('cx', `${x}`);
    circle.setAttribute('cy', `${y}`);
    circle.setAttribute('r', `${effective.radius ?? DEFAULT_DOT_RADIUS}`);
    circle.setAttribute('fill', effective.color ?? 'currentColor');
    if (effective.opacity !== undefined) {
      circle.setAttribute('fill-opacity', `${effective.opacity}`);
    }
    circle.setAttribute('stroke', 'var(--background-primary)');
    circle.setAttribute('stroke-width', '2');
    circle.style.cursor = 'grab';
    circle.classList.add('hill-chart-dot');
    return circle;
  }

  private attachHoverTarget(target: SVGElement, circle: SVGCircleElement, hoverCtx: HoverContext): void {
    const { hoverState, restoreOpacity, registerCleanup } = hoverCtx;
    const onEnter = (): void => { circle.setAttribute('fill-opacity', `${HOVER_OPACITY}`); };
    const onLeave = (): void => { if (!hoverState.isDragging) restoreOpacity(); };
    target.addEventListener('mouseenter', onEnter);
    target.addEventListener('mouseleave', onLeave);
    registerCleanup(() => {
      target.removeEventListener('mouseenter', onEnter);
      target.removeEventListener('mouseleave', onLeave);
    });
  }

  private attachHoverFeedback(circle: SVGCircleElement, hoverCtx: HoverContext): void {
    this.attachHoverTarget(circle, circle, hoverCtx);
  }

  private createDotLabel(item: HillChartItem, dotPos: { t: number; x: number; y: number }, labelCtx: LabelContext): SVGTextElement {
    const { effective, labelLayout } = labelCtx;
    const textEl = document.createElementNS(SVG_NS, 'text') as SVGTextElement;
    textEl.setAttribute('dominant-baseline', 'middle');
    textEl.setAttribute('font-size', `${effective.fontSize ?? DEFAULT_DOT_LABEL_FONT_SIZE}`);
    textEl.setAttribute('fill', effective.fontColor ?? 'currentColor');
    textEl.textContent = item.label!;

    const placement = computeLabelPlacement(dotPos.t, dotPos.x, dotPos.y);
    applyPlacement(textEl, placement);

    labelLayout.add({
      textEl,
      position: item.position,
      textAnchor: placement.textAnchor,
      baseY: placement.labelY,
    });

    return textEl;
  }

  private attachLabelHoverFeedback(textEl: SVGTextElement, circle: SVGCircleElement, hoverCtx: HoverContext): void {
    this.attachHoverTarget(textEl, circle, hoverCtx);
  }

  private wireNoteLinkClick(textEl: SVGTextElement, item: HillChartItem, callbacks: NoteClickBindings & { registerCleanup: (fn: () => void) => void }): void {
    if (!item.noteLink || !callbacks.onNoteClick) return;
    textEl.dataset.noteLink = item.noteLink;
    textEl.classList.add('hill-chart-note-link');
    // No drag mode: keep simple bubble-phase click handler.
    if (!callbacks.onPositionChange) {
      const handler = (ev: MouseEvent): void => {
        callbacks.onNoteClick!(item.noteLink!, ev.metaKey || ev.ctrlKey);
      };
      textEl.addEventListener('click', handler);
      callbacks.registerCleanup(() => textEl.removeEventListener('click', handler));
    }
  }
}
