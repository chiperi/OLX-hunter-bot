import { SourceRegistry } from './source-registry.service';
import { Listing, SearchCriteria } from './listing.interface';
import { ListingSource } from './listing-source.interface';

const criteria: SearchCriteria = { city: 'Київ', ownerOnly: false };

const listing = (id: string, source: string): Listing => ({
  id,
  title: 'Flat',
  price: 1,
  currency: 'грн',
  area: null,
  url: 'u',
  isBusiness: false,
  source,
  sourceLabel: source,
});

const src = (id: string, impl: () => Promise<Listing[]>): ListingSource => ({
  id,
  label: id,
  fetchListings: jest.fn(impl),
});

describe('SourceRegistry', () => {
  it('reports the active source count', () => {
    const reg = new SourceRegistry([src('a', async () => []), src('b', async () => [])]);
    expect(reg.count).toBe(2);
  });

  it('merges listings from all sources', async () => {
    const reg = new SourceRegistry([
      src('a', async () => [listing('1', 'a')]),
      src('c', async () => [listing('2', 'c'), listing('3', 'c')]),
    ]);
    const all = await reg.fetchAll(criteria);
    expect(all).toHaveLength(3);
    expect(all.map((l) => l.source).sort()).toEqual(['a', 'c', 'c']);
  });

  it('isolates a throwing source without failing the rest', async () => {
    const reg = new SourceRegistry([
      src('a', async () => [listing('1', 'a')]),
      src('b', async () => {
        throw new Error('boom');
      }),
    ]);
    const all = await reg.fetchAll(criteria);
    expect(all).toHaveLength(1);
    expect(all[0].source).toBe('a');
  });

  it('handles an empty registry', async () => {
    const reg = new SourceRegistry([]);
    expect(reg.count).toBe(0);
    await expect(reg.fetchAll(criteria)).resolves.toEqual([]);
  });
});
