/**
 * One-shot click suppressor.
 *
 * arm()      — sets the suppress flag (call on drag commit).
 * intercept() — if armed, consumes the flag, blocks the event, returns true;
 *               otherwise returns false.
 */
export class ClickGuard {
  private armed = false;

  arm(): void {
    this.armed = true;
  }

  intercept(ev: MouseEvent): boolean {
    if (!this.armed) return false;
    this.armed = false;
    ev.stopImmediatePropagation();
    ev.preventDefault();
    return true;
  }
}
