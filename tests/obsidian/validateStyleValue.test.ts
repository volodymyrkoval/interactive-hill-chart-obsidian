import { describe, it, expect } from 'vitest';
import {
  isValidCssColor,
  isNonNegativeFinite,
  isOpacity,
} from '../../src/obsidian/validateStyleValue';

describe('validateStyleValue - isValidCssColor', () => {
  describe('valid hex colors', () => {
    it('#rgb format → true', () => {
      expect(isValidCssColor('#fff')).toBe(true);
      expect(isValidCssColor('#abc')).toBe(true);
      expect(isValidCssColor('#123')).toBe(true);
    });

    it('#rrggbb format → true', () => {
      expect(isValidCssColor('#ffffff')).toBe(true);
      expect(isValidCssColor('#23ad32')).toBe(true);
      expect(isValidCssColor('#ff0000')).toBe(true);
      expect(isValidCssColor('#000000')).toBe(true);
    });

    it('#rgba format → true', () => {
      expect(isValidCssColor('#ffff')).toBe(true);
      expect(isValidCssColor('#123f')).toBe(true);
    });

    it('#rrggbbaa format → true', () => {
      expect(isValidCssColor('#ffffff00')).toBe(true);
      expect(isValidCssColor('#23ad32ff')).toBe(true);
      expect(isValidCssColor('#00000080')).toBe(true);
    });
  });

  describe('invalid hex colors', () => {
    it('#gg0000 (invalid hex chars) → false', () => {
      expect(isValidCssColor('#gg0000')).toBe(false);
    });

    it('#12345 (wrong length) → false', () => {
      expect(isValidCssColor('#12345')).toBe(false);
    });

    it('no # prefix → false', () => {
      expect(isValidCssColor('ffffff')).toBe(false);
    });
  });

  describe('rgb/rgba functions', () => {
    it('rgb(0,0,0) → true', () => {
      expect(isValidCssColor('rgb(0,0,0)')).toBe(true);
    });

    it('rgb(255, 128, 64) → true', () => {
      expect(isValidCssColor('rgb(255, 128, 64)')).toBe(true);
    });

    it('rgba(255, 128, 64, 0.5) → true', () => {
      expect(isValidCssColor('rgba(255, 128, 64, 0.5)')).toBe(true);
    });

    it('rgb(256, 0, 0) (out of range) → false', () => {
      expect(isValidCssColor('rgb(256, 0, 0)')).toBe(false);
    });

    it('rgb(0, 0) (too few args) → false', () => {
      expect(isValidCssColor('rgb(0, 0)')).toBe(false);
    });
  });

  describe('hsl/hsla functions', () => {
    it('hsl(0, 100%, 50%) → true', () => {
      expect(isValidCssColor('hsl(0, 100%, 50%)')).toBe(true);
    });

    it('hsl(120, 50%, 75%) → true', () => {
      expect(isValidCssColor('hsl(120, 50%, 75%)')).toBe(true);
    });

    it('hsla(240, 100%, 50%, 0.8) → true', () => {
      expect(isValidCssColor('hsla(240, 100%, 50%, 0.8)')).toBe(true);
    });

    it('hsl(0, 101%, 50%) (saturation out of range) → false', () => {
      expect(isValidCssColor('hsl(0, 101%, 50%)')).toBe(false);
    });
  });

  describe('CSS named colors', () => {
    it('red → true', () => {
      expect(isValidCssColor('red')).toBe(true);
    });

    it('blue → true', () => {
      expect(isValidCssColor('blue')).toBe(true);
    });

    it('transparent → true', () => {
      expect(isValidCssColor('transparent')).toBe(true);
    });

    it('notacolor → false', () => {
      expect(isValidCssColor('notacolor')).toBe(false);
    });
  });

  describe('special values', () => {
    it('currentColor → true', () => {
      expect(isValidCssColor('currentColor')).toBe(true);
    });

    it('inherit → true', () => {
      expect(isValidCssColor('inherit')).toBe(true);
    });

    it('var(--interactive-accent) → true', () => {
      expect(isValidCssColor('var(--interactive-accent)')).toBe(true);
    });

    it('var(--color) → true', () => {
      expect(isValidCssColor('var(--color)')).toBe(true);
    });

    it('var(--a, red) → true', () => {
      expect(isValidCssColor('var(--a, red)')).toBe(true);
    });

    it('none → true', () => {
      expect(isValidCssColor('none')).toBe(true);
    });
  });

  describe('empty/invalid', () => {
    it('empty string → false', () => {
      expect(isValidCssColor('')).toBe(false);
    });

    it('whitespace only → false', () => {
      expect(isValidCssColor('   ')).toBe(false);
    });
  });
});

describe('validateStyleValue - isNonNegativeFinite', () => {
  it('0 → true', () => {
    expect(isNonNegativeFinite(0)).toBe(true);
  });

  it('positive numbers → true', () => {
    expect(isNonNegativeFinite(1)).toBe(true);
    expect(isNonNegativeFinite(100)).toBe(true);
    expect(isNonNegativeFinite(0.5)).toBe(true);
  });

  it('negative numbers → false', () => {
    expect(isNonNegativeFinite(-1)).toBe(false);
    expect(isNonNegativeFinite(-0.5)).toBe(false);
  });

  it('Infinity → false', () => {
    expect(isNonNegativeFinite(Infinity)).toBe(false);
  });

  it('-Infinity → false', () => {
    expect(isNonNegativeFinite(-Infinity)).toBe(false);
  });

  it('NaN → false', () => {
    expect(isNonNegativeFinite(NaN)).toBe(false);
  });
});

describe('validateStyleValue - isOpacity', () => {
  it('0 → true', () => {
    expect(isOpacity(0)).toBe(true);
  });

  it('1 → true', () => {
    expect(isOpacity(1)).toBe(true);
  });

  it('0.5 → true', () => {
    expect(isOpacity(0.5)).toBe(true);
  });

  it('0.1 → true', () => {
    expect(isOpacity(0.1)).toBe(true);
  });

  it('-0.1 (below range) → false', () => {
    expect(isOpacity(-0.1)).toBe(false);
  });

  it('1.1 (above range) → false', () => {
    expect(isOpacity(1.1)).toBe(false);
  });

  it('Infinity → false', () => {
    expect(isOpacity(Infinity)).toBe(false);
  });

  it('NaN → false', () => {
    expect(isOpacity(NaN)).toBe(false);
  });
});
