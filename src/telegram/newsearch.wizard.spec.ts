import { NewSearchWizard } from './newsearch.wizard';

const makeCtx = () => ({
  scene: { state: {} as any, leave: jest.fn().mockResolvedValue(undefined) },
  from: { id: 7 },
  chat: { id: 7 },
  message: { text: '' } as { text: string },
  reply: jest.fn().mockResolvedValue(undefined),
});

const build = () => {
  const profiles = {
    create: jest.fn().mockResolvedValue({
      id: 'x',
      name: 'Київ',
      criteria: { city: 'Київ', ownerOnly: true },
      paused: false,
      primed: false,
      userId: 7,
      chatId: 7,
      createdAt: 0,
    }),
  };
  const wizard = new NewSearchWizard(profiles as any);
  return { wizard, profiles };
};

const feed = async (wizard: NewSearchWizard, ctx: any, text: string) => {
  ctx.message = { text };
  await wizard.onText(ctx as any);
};

describe('NewSearchWizard', () => {
  it('completes the Kyiv branch and creates a profile', async () => {
    const { wizard, profiles } = build();
    const ctx = makeCtx();
    await wizard.onEnter(ctx as any);
    expect(ctx.scene.state.stage).toBe('city');

    await feed(wizard, ctx, '🏙 Київ');
    expect(ctx.scene.state.city).toBe('Київ');
    expect(ctx.scene.state.stage).toBe('districtKyiv');

    await feed(wizard, ctx, 'Печерський');
    expect(ctx.scene.state.district).toBe('Печерський');
    expect(ctx.scene.state.stage).toBe('price');

    await feed(wizard, ctx, 'до 20000');
    expect(ctx.scene.state.priceMax).toBe(20000);
    expect(ctx.scene.state.stage).toBe('area');

    await feed(wizard, ctx, '30–60');
    expect(ctx.scene.state).toMatchObject({ areaMin: 30, areaMax: 60, stage: 'owner' });

    await feed(wizard, ctx, '🔑 Тільки власники');
    expect(profiles.create).toHaveBeenCalledWith(
      7,
      7,
      expect.objectContaining({
        city: 'Київ',
        district: 'Печерський',
        priceMax: 20000,
        areaMin: 30,
        areaMax: 60,
        ownerOnly: true,
      }),
    );
    expect(ctx.scene.leave).toHaveBeenCalled();
  });

  it('"будь-який район" clears the district', async () => {
    const { wizard } = build();
    const ctx = makeCtx();
    await wizard.onEnter(ctx as any);
    await feed(wizard, ctx, 'Київ');
    await feed(wizard, ctx, '🏙 Будь-який район');
    expect(ctx.scene.state.district).toBeUndefined();
    expect(ctx.scene.state.stage).toBe('price');
  });

  it('handles the "Інше місто" manual branch', async () => {
    const { wizard } = build();
    const ctx = makeCtx();
    await wizard.onEnter(ctx as any);
    await feed(wizard, ctx, '✏️ Інше місто');
    expect(ctx.scene.state.stage).toBe('cityManual');
    await feed(wizard, ctx, ''); // empty re-asks, stays
    expect(ctx.scene.state.stage).toBe('cityManual');
    await feed(wizard, ctx, 'Львів');
    expect(ctx.scene.state.city).toBe('Львів');
    expect(ctx.scene.state.stage).toBe('districtManual');
    await feed(wizard, ctx, '-');
    expect(ctx.scene.state.district).toBeUndefined();
    expect(ctx.scene.state.stage).toBe('price');
  });

  it('accepts a directly-typed city', async () => {
    const { wizard } = build();
    const ctx = makeCtx();
    await wizard.onEnter(ctx as any);
    await feed(wizard, ctx, 'Одеса');
    expect(ctx.scene.state.city).toBe('Одеса');
    expect(ctx.scene.state.stage).toBe('districtManual');
  });

  it('supports manual price and area entry via "Інше"', async () => {
    const { wizard } = build();
    const ctx = makeCtx();
    ctx.scene.state = { stage: 'price' };
    await feed(wizard, ctx, '✏️ Інше');
    expect(ctx.scene.state.stage).toBe('priceManual');
    await feed(wizard, ctx, 'від 5000 до 15000');
    expect(ctx.scene.state).toMatchObject({ priceMin: 5000, priceMax: 15000, stage: 'area' });

    await feed(wizard, ctx, '✏️ Інше');
    expect(ctx.scene.state.stage).toBe('areaManual');
    await feed(wizard, ctx, 'від 40 до 90');
    expect(ctx.scene.state).toMatchObject({ areaMin: 40, areaMax: 90, stage: 'owner' });
  });

  it('re-asks on an unrecognized owner answer', async () => {
    const { wizard, profiles } = build();
    const ctx = makeCtx();
    ctx.scene.state = { stage: 'owner', city: 'Київ' };
    await feed(wizard, ctx, 'нісенітниця');
    expect(profiles.create).not.toHaveBeenCalled();
    expect(ctx.scene.state.stage).toBe('owner');
  });

  it('/cancel leaves the scene', async () => {
    const { wizard } = build();
    const ctx = makeCtx();
    ctx.scene.state = { stage: 'price' };
    await feed(wizard, ctx, '/cancel');
    expect(ctx.scene.leave).toHaveBeenCalled();
  });

  it('resets on an unknown stage', async () => {
    const { wizard } = build();
    const ctx = makeCtx();
    ctx.scene.state = { stage: 'bogus' };
    await feed(wizard, ctx, 'anything');
    expect(ctx.scene.state.stage).toBe('city');
  });
});
