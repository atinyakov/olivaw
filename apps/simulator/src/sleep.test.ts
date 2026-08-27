import { describe, expect, it, vi } from 'vitest';
import { abortableSleep } from './sleep.js';

describe('abortableSleep', () => {
  it('removes its abort listener after the timer completes', async () => {
    vi.useFakeTimers();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const signal = {
      aborted: false,
      addEventListener,
      removeEventListener,
    } as unknown as AbortSignal;

    const pending = abortableSleep(100, signal);
    await vi.advanceTimersByTimeAsync(100);
    await pending;

    expect(addEventListener).toHaveBeenCalledOnce();
    expect(removeEventListener).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
