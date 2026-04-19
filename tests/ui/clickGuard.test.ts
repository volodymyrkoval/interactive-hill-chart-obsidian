import { describe, it, expect, vi } from 'vitest';
import { ClickGuard } from '../../src/ui/clickGuard';

function makeEvent(): MouseEvent {
  return {
    stopImmediatePropagation: vi.fn(),
    preventDefault: vi.fn(),
  } as unknown as MouseEvent;
}

describe('ClickGuard', () => {
  it('intercept returns false when not armed', () => {
    const guard = new ClickGuard();
    const ev = makeEvent();
    expect(guard.intercept(ev)).toBe(false);
  });

  it('intercept does not call stopImmediatePropagation or preventDefault when not armed', () => {
    const guard = new ClickGuard();
    const ev = makeEvent();
    guard.intercept(ev);
    expect(ev.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(ev.preventDefault).not.toHaveBeenCalled();
  });

  it('intercept returns true and suppresses event after arm()', () => {
    const guard = new ClickGuard();
    const ev = makeEvent();
    guard.arm();
    expect(guard.intercept(ev)).toBe(true);
    expect(ev.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(ev.preventDefault).toHaveBeenCalledOnce();
  });

  it('flag is consumed after one intercept — subsequent intercept returns false', () => {
    const guard = new ClickGuard();
    guard.arm();
    guard.intercept(makeEvent()); // consumes the flag
    const ev2 = makeEvent();
    expect(guard.intercept(ev2)).toBe(false);
    expect(ev2.stopImmediatePropagation).not.toHaveBeenCalled();
  });

  it('arm() twice still consumed by a single intercept', () => {
    const guard = new ClickGuard();
    guard.arm();
    guard.arm();
    guard.intercept(makeEvent()); // one arm → one consume
    const ev2 = makeEvent();
    expect(guard.intercept(ev2)).toBe(false);
  });
});
