export class HillPosition {
  private constructor(private readonly percent: number) {}

  static fromPercent(n: number): HillPosition {
    if (!isFinite(n)) {
      throw new Error(`HillPosition.fromPercent: invalid value ${n}`);
    }
    return new HillPosition(Math.min(100, Math.max(0, n)));
  }

  static fromT(t: number): HillPosition {
    const clamped = Math.min(1, Math.max(0, t));
    return new HillPosition(clamped * 100);
  }

  toPercent(): number {
    return this.percent;
  }

  toT(): number {
    return this.percent / 100;
  }
}
