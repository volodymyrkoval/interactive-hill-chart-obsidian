import type { Curve } from '../model/curve';
import type { Size } from '../types';
import { HillPosition } from '../model/hillPosition';
import { LabelLayout } from './labelLayout';
import type { LabelEntry } from './labelLayout';
import { LabelDragBinding } from './labelDragBinding';
import type { LabelCeilingPolicy } from './labelCeilingPolicy';
import { applyResolvedOpacity } from './opacityHelper';
import { DragGestureRecognizer } from './dragGestureRecognizer';
import { ClickGuard } from './clickGuard';
import { HOVER_OPACITY } from './visualConstants';
import { DragToken } from './dragToken';

/**
 * Shared mutable drag state, owned by the renderer and threaded into every
 * DotDragController attachment so that a new mousedown on one dot can preempt
 * an in-flight drag on another.
 *
 * `activeDotIndex` is the specIndex of the currently-dragging dot, or null
 * when no drag is in progress. Each gesture captures the token at mousedown
 * and aborts on the next mousemove/mouseup if the shared token has advanced.
 */
export interface SharedDragState {
  activeDotIndex: number | null;
  /**
   * Monotonic token advanced on every mousedown and on renderer destroy.
   * Used to invalidate in-flight drag gestures even when the same dot is
   * targeted twice in succession, or to cancel drags at teardown.
   */
  token: DragToken;
}

export function createSharedDragState(): SharedDragState {
  return { activeDotIndex: null, token: DragToken.initial() };
}

export interface DomRefs {
  svg: SVGSVGElement;
  circle: SVGCircleElement;
  textEl: SVGTextElement | null;
}

export interface DotIdentity {
  specIndex: number;
  initialPosition: HillPosition;
  resolvedOpacity?: number;
}

export interface LabelBinding {
  labelEntry: LabelEntry | null;
  labelLayout: LabelLayout;
  /** Read lazily at drag-move time: renderer computes this after all dots render. */
  labelCeilingPolicy: LabelCeilingPolicy;
}

export interface SharedDragBindings {
  /** Per-dot hover flag — shared with hover handlers in the renderer. */
  hoverState: { isDragging: boolean };
  dragState: SharedDragState;
  curve: Curve;
  size: Size;
}

export interface DragCallbacks {
  onPositionChange: (specIndex: number, pos: HillPosition) => void;
  onNoteClick?: (noteName: string, newLeaf: boolean) => void;
}

export interface DotDragAttachment {
  dom: DomRefs;
  identity: DotIdentity;
  label: LabelBinding;
  shared: SharedDragBindings;
  callbacks: DragCallbacks;
}

export class DotDragController {
  private readonly a: DotDragAttachment;
  private readonly recognizer: DragGestureRecognizer;
  private readonly labelBinding: LabelDragBinding;
  private readonly clickGuard = new ClickGuard();

  // Per-attachment mutable state (one controller instance per dot).
  private currentT = 0;
  private originalPercent = 0;
  private svgGrabOffsetX = 0;

  private readonly boundOnCircleMouseDown = (ev: MouseEvent): void => this.onCircleMouseDown(ev);
  private readonly boundOnLabelMouseDown = (ev: MouseEvent): void => this.onLabelMouseDown(ev);
  private readonly boundOnLabelClick = (ev: MouseEvent): void => this.onLabelClick(ev);

  constructor(a: DotDragAttachment) {
    this.a = a;
    this.currentT = a.identity.initialPosition.toT();
    this.originalPercent = a.identity.initialPosition.toPercent();
    this.labelBinding = new LabelDragBinding(
      a.label.labelEntry,
      a.dom.textEl,
      a.label.labelLayout,
      a.label.labelCeilingPolicy,
    );
    this.recognizer = new DragGestureRecognizer(a.shared.dragState, a.identity.specIndex, {
      onArm: () => this.handleArm(),
      onMove: (ev) => this.handleMove(ev),
      onCommit: (wasArmed) => this.handleCommit(wasArmed),
      onCancel: (wasArmed) => this.handleCancel(wasArmed),
    });

    a.dom.circle.addEventListener('mousedown', this.boundOnCircleMouseDown);

    if (a.dom.textEl) {
      a.dom.textEl.addEventListener('mousedown', this.boundOnLabelMouseDown);
      a.dom.textEl.addEventListener('click', this.boundOnLabelClick, { capture: true });
    }
  }

  dispose(): void {
    this.cleanup();
  }

  // ── mousedown handlers ────────────────────────────────────────────────────

  private onCircleMouseDown(ev: MouseEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    // Circle grab is at the dot center — no offset needed.
    this.svgGrabOffsetX = 0;
    this.a.shared.hoverState.isDragging = true;
    this.recognizer.armImmediate(ev);
  }

  private onLabelMouseDown(ev: MouseEvent): void {
    ev.preventDefault();
    this.svgGrabOffsetX = this.computeSvgGrabOffset(ev.clientX);
    this.a.shared.hoverState.isDragging = true;
    this.recognizer.armPending(ev);
  }

  private onLabelClick(ev: MouseEvent): void {
    if (this.clickGuard.intercept(ev)) return;
    const noteLink = this.a.dom.textEl?.dataset.noteLink;
    if (noteLink && this.a.callbacks.onNoteClick) {
      this.a.callbacks.onNoteClick(noteLink, ev.metaKey || ev.ctrlKey);
    }
  }

  // ── recognizer callbacks ──────────────────────────────────────────────────

  private handleArm(): void {
    this.a.dom.circle.classList.add('hill-chart-dot--grabbing');
    this.a.dom.circle.setAttribute('fill-opacity', `${HOVER_OPACITY}`);
  }

  private handleMove(ev: MouseEvent): void {
    this.updatePosition(ev);
  }

  private handleCommit(wasArmed: boolean): void {
    this.a.shared.hoverState.isDragging = false;
    if (wasArmed) this.commitDrag();
    // If not armed: let the natural click handler fire.
  }

  private handleCancel(wasArmed: boolean): void {
    if (wasArmed) this.restoreOpacity();
    this.a.shared.hoverState.isDragging = false;
  }

  private commitDrag(): void {
    this.clickGuard.arm();
    this.a.dom.circle.classList.remove('hill-chart-dot--grabbing');
    this.restoreOpacity();
    const newPercent = Math.round(this.currentT * 100);
    if (newPercent !== this.originalPercent) {
      this.a.callbacks.onPositionChange(this.a.identity.specIndex, HillPosition.fromPercent(newPercent));
    }
  }

  // ── position update ───────────────────────────────────────────────────────

  private updatePosition(ev: MouseEvent): void {
    const { svg, circle, textEl } = this.a.dom;
    const { curve, size } = this.a.shared;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    if (!pt) return;
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());
    this.currentT = curve.tFromSvgX(svgPt.x - this.svgGrabOffsetX, size);
    const { x: newX, y: newY } = curve.toSvgPoint(this.currentT, size);
    circle.setAttribute('cx', `${newX}`);
    circle.setAttribute('cy', `${newY}`);
    if (textEl) this.labelBinding.update(this.currentT, newX, newY);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private computeSvgGrabOffset(clientX: number): number {
    const { svg, circle } = this.a.dom;
    try {
      const ctm = svg.getScreenCTM();
      if (!ctm) return 0;
      const pt = svg.createSVGPoint();
      if (!pt) return 0;
      pt.x = clientX;
      pt.y = 0;
      const svgGrab = pt.matrixTransform(ctm.inverse());
      const dotSvgX = parseFloat(circle.getAttribute('cx') ?? '0');
      return svgGrab.x - dotSvgX;
    } catch {
      return 0;
    }
  }

  private restoreOpacity(): void {
    applyResolvedOpacity(this.a.dom.circle, this.a.identity.resolvedOpacity);
  }

  private cleanup(): void {
    this.recognizer.dispose();
    this.a.shared.hoverState.isDragging = false;
    this.a.dom.circle.removeEventListener('mousedown', this.boundOnCircleMouseDown);
    if (this.a.dom.textEl) {
      this.a.dom.textEl.removeEventListener('mousedown', this.boundOnLabelMouseDown);
      this.a.dom.textEl.removeEventListener('click', this.boundOnLabelClick, { capture: true });
    }
  }
}
