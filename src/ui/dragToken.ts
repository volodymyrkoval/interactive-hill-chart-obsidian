/**
 * Value object wrapping the monotonic seq counter used for drag pre-emption.
 *
 * A gesture captures a DragToken at mousedown via DragToken.fromSeq(seq).
 * On each mousemove/mouseup it calls token.equals(shared.token) to detect
 * whether a concurrent gesture has bumped the counter and pre-empted it.
 */
export class DragToken {
  private constructor(private readonly seq: number) {}

  static initial(): DragToken {
    return new DragToken(0);
  }

  static fromSeq(seq: number): DragToken {
    return new DragToken(seq);
  }

  /** Returns a new token with the next sequential value. */
  next(): DragToken {
    return new DragToken(this.seq + 1);
  }

  /** True when both tokens represent the same seq value (gesture not pre-empted). */
  equals(other: DragToken): boolean {
    return this.seq === other.seq;
  }

  /** The raw seq value — used internally when interfacing with numeric SharedDragState. */
  toSeq(): number {
    return this.seq;
  }
}
