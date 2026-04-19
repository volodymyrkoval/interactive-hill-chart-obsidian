/**
 * Unit tests for DragToken value object.
 *
 * DragToken wraps the monotonic seq counter used for drag pre-emption.
 * A gesture captures a token at mousedown; on mousemove/mouseup it compares
 * its captured token against the shared current token to detect whether
 * another gesture has pre-empted it.
 *
 * Scenarios:
 *  1. Two tokens created from the same seq value are equal.
 *  2. A token captured before an increment is NOT equal to a token captured after.
 *  3. The initial token is distinct from any advanced token.
 *  4. Multiple increments produce strictly increasing tokens.
 */

import { describe, it, expect } from 'vitest';
import { DragToken } from '../../src/ui/dragToken';

describe('DragToken', () => {
  it('two tokens with the same seq value are equal', () => {
    const a = DragToken.fromSeq(3);
    const b = DragToken.fromSeq(3);
    expect(a.equals(b)).toBe(true);
  });

  it('a captured token does not equal the token after a pre-empting increment', () => {
    const captured = DragToken.fromSeq(1);
    const afterPreemption = DragToken.fromSeq(2);
    expect(captured.equals(afterPreemption)).toBe(false);
  });

  it('initial token (seq 0) is not equal to a token advanced by one increment', () => {
    const initial = DragToken.initial();
    const advanced = DragToken.fromSeq(1);
    expect(initial.equals(advanced)).toBe(false);
  });

  it('multiple increments produce tokens that are each unequal to the previous', () => {
    const tokens = [0, 1, 2, 3, 4].map(DragToken.fromSeq);
    for (let i = 1; i < tokens.length; i++) {
      expect(tokens[i - 1].equals(tokens[i])).toBe(false);
    }
  });

  it('a token equals itself', () => {
    const t = DragToken.fromSeq(7);
    expect(t.equals(t)).toBe(true);
  });

  it('next() returns a token that does not equal the current token', () => {
    const current = DragToken.fromSeq(5);
    const next = current.next();
    expect(current.equals(next)).toBe(false);
  });

  it('next() is monotonically increasing — two successive nexts are unequal', () => {
    const t0 = DragToken.initial();
    const t1 = t0.next();
    const t2 = t1.next();
    expect(t1.equals(t2)).toBe(false);
    expect(t0.equals(t2)).toBe(false);
  });
});
