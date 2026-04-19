import { describe, it, expect } from 'vitest';
import { HillPosition } from '../../src/model/hillPosition';

describe('HillPosition', () => {
  describe('fromPercent', () => {
    it('clamps values below 0 to 0', () => {
      expect(HillPosition.fromPercent(-10).toPercent()).toBe(0);
    });

    it('clamps values above 100 to 100', () => {
      expect(HillPosition.fromPercent(150).toPercent()).toBe(100);
    });

    it('accepts a value in range', () => {
      expect(HillPosition.fromPercent(50).toPercent()).toBe(50);
    });

    it('throws on NaN', () => {
      expect(() => HillPosition.fromPercent(NaN)).toThrow();
    });

    it('throws on Infinity', () => {
      expect(() => HillPosition.fromPercent(Infinity)).toThrow();
    });

    it('throws on -Infinity', () => {
      expect(() => HillPosition.fromPercent(-Infinity)).toThrow();
    });
  });

  describe('fromT', () => {
    it('converts t=0.5 to percent 50 and back to t 0.5', () => {
      const pos = HillPosition.fromT(0.5);
      expect(pos.toT()).toBeCloseTo(0.5);
      expect(pos.toPercent()).toBeCloseTo(50);
    });

    it('clamps t below 0 to 0', () => {
      expect(HillPosition.fromT(-0.1).toT()).toBe(0);
    });

    it('clamps t above 1 to 1', () => {
      expect(HillPosition.fromT(1.5).toT()).toBe(1);
    });
  });

  describe('round-trips', () => {
    it('fromPercent(75).toT() is approximately 0.75', () => {
      expect(HillPosition.fromPercent(75).toT()).toBeCloseTo(0.75);
    });

    it('fromT(0.3).toPercent() is approximately 30', () => {
      expect(HillPosition.fromT(0.3).toPercent()).toBeCloseTo(30);
    });
  });
});
