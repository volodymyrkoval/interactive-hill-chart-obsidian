/**
 * Unit tests for DragGestureRecognizer — the pure gesture state machine
 * extracted from DotDragController (B3).
 *
 * Responsibilities under test:
 *  - Arming: immediate vs pending (threshold-gated)
 *  - Threshold detection on mousemove
 *  - Pre-emption: a second gesture bumps the shared seq and cancels the first
 *  - Single teardown path: window listeners removed exactly once
 *  - Callback contract: onArm / onMove / onCommit / onCancel
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DragGestureRecognizer,
  type GestureCallbacks,
} from '../../src/ui/dragGestureRecognizer';
import { createSharedDragState } from '../../src/ui/dotDragController';
import type { SharedDragState } from '../../src/ui/dotDragController';

function makeCallbacks(): {
  cbs: GestureCallbacks;
  calls: { arm: number; move: number; commit: number; cancel: number[] };
} {
  const calls = { arm: 0, move: 0, commit: 0, cancel: [] as number[] };
  const cbs: GestureCallbacks = {
    onArm: () => { calls.arm += 1; },
    onMove: () => { calls.move += 1; },
    onCommit: () => { calls.commit += 1; },
    onCancel: (wasArmed: boolean) => { calls.cancel.push(wasArmed ? 1 : 0); },
  };
  return { cbs, calls };
}

describe('DragGestureRecognizer', () => {
  let dragState: SharedDragState;

  beforeEach(() => {
    dragState = createSharedDragState();
  });

  afterEach(() => {
    // Drain any leftover window listeners.
    window.dispatchEvent(new MouseEvent('mouseup'));
    vi.restoreAllMocks();
  });

  it('armImmediate fires onArm and registers window listeners', () => {
    const { cbs, calls } = makeCallbacks();
    const rec = new DragGestureRecognizer(dragState, 0, cbs);

    rec.armImmediate(new MouseEvent('mousedown', { clientX: 10, clientY: 10 }));

    expect(calls.arm).toBe(1);
    expect(dragState.activeDotIndex).toBe(0);

    // Mousemove should reach onMove (since armed).
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 30, clientY: 10 }));
    expect(calls.move).toBe(1);
  });

  it('armPending does not fire onArm until threshold crossed', () => {
    const { cbs, calls } = makeCallbacks();
    const rec = new DragGestureRecognizer(dragState, 0, cbs);

    rec.armPending(new MouseEvent('mousedown', { clientX: 10, clientY: 10 }));
    expect(calls.arm).toBe(0);

    // Move 3 px — below threshold of 4.
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 13, clientY: 10 }));
    expect(calls.arm).toBe(0);
    expect(calls.move).toBe(0);

    // Move 5 px total — crosses threshold.
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 15, clientY: 10 }));
    expect(calls.arm).toBe(1);
    expect(calls.move).toBe(1);
  });

  it('mouseup after armed gesture fires onCommit, not onCancel', () => {
    const { cbs, calls } = makeCallbacks();
    const rec = new DragGestureRecognizer(dragState, 0, cbs);

    rec.armImmediate(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(calls.commit).toBe(1);
    expect(calls.cancel.length).toBe(0);
  });

  it('mouseup without arming (pending + sub-threshold) fires onCommit with not-armed path', () => {
    // Matches existing behavior: finish() runs; if not armed, skips commitDrag.
    // The recognizer should still call onCommit so the controller knows the
    // gesture ended — the controller decides whether a write happens based on
    // an internal flag (the delta check). Here we just confirm no cancel.
    const { cbs, calls } = makeCallbacks();
    const rec = new DragGestureRecognizer(dragState, 0, cbs);

    rec.armPending(new MouseEvent('mousedown', { clientX: 10, clientY: 10 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(calls.cancel.length).toBe(0);
    expect(calls.commit).toBe(1);
  });

  it('a second armImmediate on a different recognizer preempts the first', () => {
    const first = makeCallbacks();
    const second = makeCallbacks();
    const rec1 = new DragGestureRecognizer(dragState, 0, first.cbs);
    const rec2 = new DragGestureRecognizer(dragState, 1, second.cbs);

    rec1.armImmediate(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 0 }));
    expect(first.calls.move).toBe(1);

    // Preempt.
    rec2.armImmediate(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));

    // Next mousemove: rec1 should cancel (cancelled, not move), rec2 should move.
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 0 }));

    expect(first.calls.move).toBe(1); // unchanged
    expect(first.calls.cancel).toEqual([1]); // cancelled, wasArmed=true
    expect(second.calls.move).toBe(1);
  });

  it('dispose() called twice only removes listeners once (idempotent teardown)', () => {
    const { cbs, calls } = makeCallbacks();
    const rec = new DragGestureRecognizer(dragState, 0, cbs);

    rec.armImmediate(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
    rec.dispose();
    rec.dispose(); // second call must not explode

    // Further mousemove should not reach onMove — listeners removed.
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 0 }));
    expect(calls.move).toBe(0);
  });

  it('dispose() bumps token so other in-flight gestures also see themselves preempted', () => {
    const first = makeCallbacks();
    const rec1 = new DragGestureRecognizer(dragState, 0, first.cbs);

    rec1.armImmediate(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
    rec1.dispose();

    // After dispose, token advanced; further mousemove is already detached, so
    // no callback fires. Just verify token advanced (a new arm sees a different token).
    const tokenAfterDispose = dragState.token;
    const rec2 = new DragGestureRecognizer(dragState, 1, makeCallbacks().cbs);
    rec2.armImmediate(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
    expect(dragState.token.equals(tokenAfterDispose)).toBe(false);
  });
});
