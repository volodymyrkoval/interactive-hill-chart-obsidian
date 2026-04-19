import { describe, it, expect, vi } from 'vitest';
import { consoleLogger } from '../../src/app/logger';

describe('consoleLogger', () => {
  it('delegates warn to console.warn with message and context', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleLogger.warn('something went wrong', { detail: 'x' });
    expect(spy).toHaveBeenCalledWith('something went wrong', { detail: 'x' });
    spy.mockRestore();
  });

  it('delegates warn to console.warn with message only when ctx omitted', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleLogger.warn('bare warning');
    expect(spy).toHaveBeenCalledWith('bare warning', undefined);
    spy.mockRestore();
  });
});
