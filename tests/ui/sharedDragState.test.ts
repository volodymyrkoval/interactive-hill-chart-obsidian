/**
 * Tests that SharedDragState uses DragToken instead of a raw seq number.
 *
 * The pre-emption protocol:
 *  - Each gesture captures `dragState.token` at mousedown.
 *  - On mousedown, `dragState.token` is advanced via `token.next()`.
 *  - On mousemove/mouseup, the gesture checks whether its captured token
 *    still equals `dragState.token`. If not, it was pre-empted.
 */

import { describe, it, expect } from 'vitest';
import { createSharedDragState } from '../../src/ui/dotDragController';
import { DragToken } from '../../src/ui/dragToken';

describe('SharedDragState uses DragToken', () => {
  it('createSharedDragState returns a token field that is a DragToken', () => {
    const state = createSharedDragState();
    expect(state.token).toBeInstanceOf(DragToken);
  });

  it('initial token equals another initial token', () => {
    const state = createSharedDragState();
    expect(state.token.equals(DragToken.initial())).toBe(true);
  });

  it('advancing the token makes the old captured token stale', () => {
    const state = createSharedDragState();
    const captured = state.token;
    state.token = state.token.next(); // simulate mousedown on a second dot
    expect(captured.equals(state.token)).toBe(false);
  });
});
