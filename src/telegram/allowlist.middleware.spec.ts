import { createAllowlistMiddleware } from './allowlist.middleware';

describe('createAllowlistMiddleware', () => {
  let next: jest.Mock;
  beforeEach(() => {
    next = jest.fn().mockResolvedValue(undefined);
  });

  it('lets an allowed user through', async () => {
    const mw = createAllowlistMiddleware([1, 2]);
    const ctx: any = { from: { id: 1 }, chat: { id: 1 }, reply: jest.fn() };
    await mw(ctx, next);
    expect(next).toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('blocks a disallowed user with a polite reply', async () => {
    const mw = createAllowlistMiddleware([1]);
    const ctx: any = { from: { id: 99 }, chat: { id: 99 }, reply: jest.fn().mockResolvedValue(undefined) };
    await mw(ctx, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalled();
  });

  it('blocks updates without a known user', async () => {
    const mw = createAllowlistMiddleware([1]);
    const ctx: any = { reply: jest.fn() };
    await mw(ctx, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('swallows reply errors', async () => {
    const mw = createAllowlistMiddleware([1]);
    const ctx: any = { from: { id: 99 }, chat: { id: 99 }, reply: jest.fn().mockRejectedValue(new Error('x')) };
    await expect(mw(ctx, next)).resolves.toBeUndefined();
  });

  it('an empty allowlist rejects everyone', async () => {
    const mw = createAllowlistMiddleware([]);
    const ctx: any = { from: { id: 1 }, chat: { id: 1 }, reply: jest.fn().mockResolvedValue(undefined) };
    await mw(ctx, next);
    expect(next).not.toHaveBeenCalled();
  });
});
