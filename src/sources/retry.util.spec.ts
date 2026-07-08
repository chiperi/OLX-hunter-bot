import { sleep, withRetry } from './retry.util';

const fast = { retries: 2, baseDelayMs: 1, maxDelayMs: 2 };

describe('sleep', () => {
  it('resolves', async () => {
    await expect(sleep(1)).resolves.toBeUndefined();
  });
});

describe('withRetry', () => {
  it('returns immediately on success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, fast)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries then succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('y'))
      .mockResolvedValue('ok');
    const onRetry = jest.fn();
    await expect(withRetry(fn, { ...fast, onRetry })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('throws the last error after exhausting retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always'));
    await expect(withRetry(fn, fast)).rejects.toThrow('always');
    expect(fn).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });
});
