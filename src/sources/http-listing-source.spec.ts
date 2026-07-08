jest.mock('axios');
import axios from 'axios';
import { HttpListingSource, SiteSpec } from './http-listing-source';
import { SearchCriteria } from './listing.interface';

const httpGet = jest.fn();
beforeEach(() => {
  httpGet.mockReset();
  (axios.create as jest.Mock).mockReturnValue({ get: httpGet });
});

const cfg = (over: Record<string, unknown> = {}): any => ({
  mode: 'mock',
  enabled: [],
  timeoutMs: 1000,
  maxRetries: 0,
  proxyUrl: undefined,
  olx: { baseUrl: 'https://www.olx.ua', categoryPath: 'x' },
  domria: { baseUrl: 'https://d', maxDetails: 10 },
  ...over,
});

const criteria: SearchCriteria = { city: 'Київ', ownerOnly: true, priceMin: 5000, priceMax: 20000 };

describe('HttpListingSource — mock mode', () => {
  const spec: SiteSpec = { id: 'm', label: 'MockSite' };

  it('produces listings tagged with source/label that respect the criteria', async () => {
    const source = new HttpListingSource(spec, cfg({ mode: 'mock' }));
    const res = await source.fetchListings(criteria);
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((l) => l.source === 'm' && l.sourceLabel === 'MockSite')).toBe(true);
    expect(res.every((l) => !l.isBusiness)).toBe(true); // ownerOnly
    expect(res.every((l) => l.price! >= 5000 && l.price! <= 20000)).toBe(true);
  });

  it('is deterministic for the same source + criteria', async () => {
    const source = new HttpListingSource(spec, cfg({ mode: 'mock' }));
    const a = await source.fetchListings(criteria);
    const b = await source.fetchListings(criteria);
    expect(a.map((l) => l.id)).toEqual(b.map((l) => l.id));
  });
});

describe('HttpListingSource — http mode', () => {
  it('runs a declarative html spec and stamps the source', async () => {
    const spec: SiteSpec = {
      id: 't',
      label: 'T',
      kind: 'html',
      buildUrl: () => 'https://x/search',
      parse: () => [
        { id: '1', title: 'A', price: 100, currency: 'грн', area: null, url: 'u', isBusiness: false },
      ],
    };
    httpGet.mockResolvedValue({ status: 200, data: '<html></html>' });
    const source = new HttpListingSource(spec, cfg({ mode: 'http' }));
    const res = await source.fetchListings(criteria);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ id: '1', source: 't', sourceLabel: 'T' });
  });

  it('runs an imperative json fetch spec', async () => {
    const spec: SiteSpec = {
      id: 'd',
      label: 'D',
      fetch: async (ctx) => {
        const data: any = await ctx.getJson('https://api');
        return data.items.map((id: number) => ({
          id: String(id),
          title: 'x',
          price: null,
          currency: 'грн',
          area: null,
          url: 'u',
          isBusiness: false,
        }));
      },
    };
    httpGet.mockResolvedValue({ status: 200, data: { items: [1, 2] } });
    const source = new HttpListingSource(spec, cfg({ mode: 'http' }));
    const res = await source.fetchListings({ city: 'Київ', ownerOnly: false });
    expect(res.map((l) => l.id)).toEqual(['1', '2']);
  });

  it('returns [] on an HTTP error (never throws)', async () => {
    const spec: SiteSpec = { id: 't', label: 'T', kind: 'html', buildUrl: () => 'https://x', parse: () => [] };
    httpGet.mockResolvedValue({ status: 500, data: '' });
    const source = new HttpListingSource(spec, cfg({ mode: 'http' }));
    await expect(source.fetchListings(criteria)).resolves.toEqual([]);
  });

  it('returns [] when buildUrl yields null', async () => {
    const spec: SiteSpec = { id: 't', label: 'T', kind: 'html', buildUrl: () => null, parse: () => [] };
    const source = new HttpListingSource(spec, cfg({ mode: 'http' }));
    await expect(source.fetchListings(criteria)).resolves.toEqual([]);
  });
});

describe('HttpListingSource — proxy config', () => {
  it('passes a parsed proxy to axios', () => {
    new HttpListingSource({ id: 'p', label: 'P' }, cfg({ proxyUrl: 'http://user:pass@host:3128' }));
    const opts = (axios.create as jest.Mock).mock.calls.pop()![0];
    expect(opts.proxy).toMatchObject({ host: 'host', port: 3128 });
  });

  it('disables the proxy on an invalid url', () => {
    new HttpListingSource({ id: 'p', label: 'P' }, cfg({ proxyUrl: 'not a url' }));
    const opts = (axios.create as jest.Mock).mock.calls.pop()![0];
    expect(opts.proxy).toBe(false);
  });
});
