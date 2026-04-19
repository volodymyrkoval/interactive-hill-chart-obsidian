import { describe, it, expect } from 'vitest';
import { ParsePath, ParseContext } from '../../src/obsidian/parseContext';

describe('ParsePath', () => {
  describe('root path', () => {
    it('of() creates a root path with the given segment', () => {
      const p = ParsePath.of('chart');
      expect(p.toString()).toBe('chart');
    });
  });

  describe('child path', () => {
    it('child() appends a dot-separated segment', () => {
      const p = ParsePath.of('chart').child('curve');
      expect(p.toString()).toBe('chart.curve');
    });

    it('chains multiple child() calls', () => {
      const p = ParsePath.of('chart').child('dot').child('color');
      expect(p.toString()).toBe('chart.dot.color');
    });
  });

  describe('indexed path', () => {
    it('index() appends a bracket-indexed segment', () => {
      const p = ParsePath.of('dots').index(2);
      expect(p.toString()).toBe('dots[2]');
    });

    it('index(0) uses zero as the index', () => {
      const p = ParsePath.of('dots').index(0);
      expect(p.toString()).toBe('dots[0]');
    });
  });

  describe('nested path construction', () => {
    it('composes index + child for dot style paths', () => {
      const p = ParsePath.of('dots').index(2).child('style').child('color');
      expect(p.toString()).toBe('dots[2].style.color');
    });

    it('child after index uses dot separator', () => {
      const p = ParsePath.of('dots').index(1).child('style');
      expect(p.toString()).toBe('dots[1].style');
    });
  });
});

describe('ParseContext', () => {
  describe('construction', () => {
    it('exposes path as string via path property', () => {
      const ctx = new ParseContext(ParsePath.of('curve'), []);
      expect(ctx.path).toBe('curve');
    });

    it('nested path is accessible via path property', () => {
      const ctx = new ParseContext(ParsePath.of('dots').index(0).child('style'), []);
      expect(ctx.path).toBe('dots[0].style');
    });
  });

  describe('error accumulation', () => {
    it('push() appends an error to the errors array', () => {
      const errors: import('../../src/model/parseErrors').HillChartParseError[] = [];
      const ctx = new ParseContext(ParsePath.of('chart'), errors);
      ctx.push({ message: 'test error', severity: 'warning' });
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('test error');
    });

    it('push() appends to the shared errors reference', () => {
      const errors: import('../../src/model/parseErrors').HillChartParseError[] = [];
      const ctx = new ParseContext(ParsePath.of('chart'), errors);
      ctx.push({ message: 'first', severity: 'warning' });
      ctx.push({ message: 'second', severity: 'error' });
      expect(errors).toHaveLength(2);
    });
  });

  describe('child context', () => {
    it('childCtx() creates a new ParseContext with extended path', () => {
      const errors: import('../../src/model/parseErrors').HillChartParseError[] = [];
      const parent = new ParseContext(ParsePath.of('chart'), errors);
      const child = parent.childCtx('curve');
      expect(child.path).toBe('chart.curve');
    });

    it('childCtx() shares the same errors array', () => {
      const errors: import('../../src/model/parseErrors').HillChartParseError[] = [];
      const parent = new ParseContext(ParsePath.of('chart'), errors);
      const child = parent.childCtx('curve');
      child.push({ message: 'child error', severity: 'warning' });
      expect(errors).toHaveLength(1);
    });

    it('indexCtx() creates a new ParseContext with bracket index', () => {
      const errors: import('../../src/model/parseErrors').HillChartParseError[] = [];
      const parent = new ParseContext(ParsePath.of('dots'), errors);
      const indexed = parent.indexCtx(3);
      expect(indexed.path).toBe('dots[3]');
    });
  });
});
