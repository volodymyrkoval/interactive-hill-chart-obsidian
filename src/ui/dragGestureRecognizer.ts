import type { SharedDragState } from './dotDragController';
import { DragToken } from './dragToken';

const DRAG_THRESHOLD_PX = 4;

export interface GestureCallbacks {
  /** Fired when the gesture becomes armed (immediate or threshold-crossed). */
  onArm: () => void;
  /** Fired on each mousemove while armed. */
  onMove: (ev: MouseEvent) => void;
  /**
   * Fired on mouseup — the gesture is ending normally. `wasArmed` tells the
   * caller whether the drag actually engaged (and thus whether to commit
   * a write and suppress the ensuing click).
   */
  onCommit: (wasArmed: boolean) => void;
  /**
   * Fired when a concurrent gesture pre-empts this one (shared DragToken advanced
   * while a mousemove/mouseup fires for us). `wasArmed` tells the caller
   * whether to restore cursor/opacity state that was set on arm.
   */
  onCancel: (wasArmed: boolean) => void;
}

/**
 * Owns the drag gesture state machine:
 *  - arming (immediate for circle, pending+threshold for label)
 *  - window-level mousemove/mouseup listener lifecycle
 *  - pre-emption via the shared DragToken
 *  - single idempotent teardown path
 *
 * It does not know about the DOM circle, position math, or the writer —
 * those live in the controller, reached via callbacks.
 */
export class DragGestureRecognizer {
  private active = false;
  private armed = false;
  private disposed = false;
  private myToken = DragToken.initial();
  private startClientX = 0;
  private startClientY = 0;

  private readonly boundOnMouseMove = (ev: MouseEvent): void => this.onMouseMove(ev);
  private readonly boundOnMouseUp = (): void => this.onMouseUp();

  constructor(
    private readonly dragState: SharedDragState,
    private readonly specIndex: number,
    private readonly callbacks: GestureCallbacks,
  ) {}

  /** Arm immediately (circle grab). Callback onArm fires synchronously. */
  armImmediate(ev: MouseEvent): void {
    this.beginGesture(ev, true);
    this.callbacks.onArm();
  }

  /** Arm pending (label grab). onArm fires only when the move threshold is crossed. */
  armPending(ev: MouseEvent): void {
    this.beginGesture(ev, false);
  }

  /**
   * Idempotent teardown — remove window listeners and advance the shared token
   * so any in-flight gesture sees itself preempted on next tick.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.teardown();
    // Advance token so external in-flight gestures see themselves preempted.
    this.dragState.token = this.dragState.token.next();
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private beginGesture(ev: MouseEvent, armedImmediately: boolean): void {
    this.dragState.token = this.dragState.token.next();
    this.myToken = this.dragState.token;
    this.dragState.activeDotIndex = this.specIndex;
    this.active = true;
    this.armed = armedImmediately;
    this.startClientX = ev.clientX;
    this.startClientY = ev.clientY;
    window.addEventListener('mousemove', this.boundOnMouseMove);
    window.addEventListener('mouseup', this.boundOnMouseUp);
  }

  private onMouseMove(ev: MouseEvent): void {
    if (!this.active) return;
    if (this.cancelIfPreempted()) return;
    if (!this.armed && !this.tryArm(ev)) return;
    this.callbacks.onMove(ev);
  }

  private onMouseUp(): void {
    if (!this.active) return;
    if (this.cancelIfPreempted()) return;
    this.finish();
  }

  private tryArm(ev: MouseEvent): boolean {
    const displacement =
      Math.abs(ev.clientX - this.startClientX) + Math.abs(ev.clientY - this.startClientY);
    if (displacement < DRAG_THRESHOLD_PX) return false;
    this.armed = true;
    this.callbacks.onArm();
    return true;
  }

  private cancelIfPreempted(): boolean {
    if (this.myToken.equals(this.dragState.token)) return false;
    const wasArmed = this.armed;
    this.teardown();
    this.callbacks.onCancel(wasArmed);
    return true;
  }

  private finish(): void {
    const wasArmed = this.armed;
    if (this.dragState.activeDotIndex === this.specIndex) {
      this.dragState.activeDotIndex = null;
    }
    this.teardown();
    this.callbacks.onCommit(wasArmed);
  }

  /** Single source of truth for listener removal + flag reset. */
  private teardown(): void {
    this.active = false;
    this.armed = false;
    window.removeEventListener('mousemove', this.boundOnMouseMove);
    window.removeEventListener('mouseup', this.boundOnMouseUp);
  }
}
