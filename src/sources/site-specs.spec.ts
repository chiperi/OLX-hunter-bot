import { SITE_SPECS } from './site-specs';
import { SearchCriteria } from './listing.interface';

const cfg: any = {
  olx: { baseUrl: 'https://www.olx.ua', categoryPath: 'uk/nedvizhimost/kvartiry' },
  domria: { baseUrl: 'https://developers.ria.com', maxDetails: 2, apiKey: undefined },
};

const criteria: SearchCriteria = {
  city: 'Київ',
  district: 'Центр',
  priceMin: 5000,
  priceMax: 15000,
  areaMin: 30,
  areaMax: 60,
  ownerOnly: true,
};

describe('OLX spec', () => {
  it('builds a filtered search url', () => {
    const url = SITE_SPECS.olx.buildUrl!(criteria, cfg);
    expect(url).toContain('https://www.olx.ua/uk/nedvizhimost/kvartiry/');
    expect(url).toContain('5000');
    expect(url).toContain('15000');
    expect(url).toContain('private');
  });

  it('parses an offer from __NEXT_DATA__', () => {
    const offer = {
      id: 42,
      title: 'Квартира',
      url: '/d/uk/obyavlenie/kv-42.html',
      price: { value: 9000, currency: 'грн' },
      total_area: '50',
      location: { city: { name: 'Київ' }, district: { name: 'Центр' } },
      photos: [],
      business: false,
    };
    const html = `<script id="__NEXT_DATA__">${JSON.stringify({ props: { data: [offer] } })}</script>`;
    const res = SITE_SPECS.olx.parse!(html, cfg);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ id: '42', title: 'Квартира', price: 9000, area: 50 });
  });

  it('returns [] for empty html', () => {
    expect(SITE_SPECS.olx.parse!('<html></html>', cfg)).toEqual([]);
  });
});

describe('HTML specs build urls and parse __NEXT_DATA__', () => {
  it.each([
    ['rieltor', 'rieltor.ua'],
    ['lun', 'lun.ua'],
    ['flatfy', 'flatfy.ua'],
    ['birdrent', 'birdrent.com'],
    ['josti', 'josti.com.ua'],
  ])('%s → %s', (key, domain) => {
    const spec = SITE_SPECS[key];
    const url = spec.buildUrl!(criteria, cfg);
    expect(url).toContain(domain);

    const offer = { id: 7, title: 'T', url: '/x/7', price: { value: 1000 }, photos: [] };
    const html = `<script id="__NEXT_DATA__">${JSON.stringify({ items: [offer] })}</script>`;
    const res = spec.parse!(html, cfg);
    expect(res[0]).toMatchObject({ id: '7', title: 'T' });
  });
});

describe('DOM.RIA spec', () => {
  it('returns [] without an api key', async () => {
    const ctx = { cfg, getHtml: jest.fn(), getJson: jest.fn() };
    await expect(SITE_SPECS.domria.fetch!(ctx as any, criteria)).resolves.toEqual([]);
  });

  it('fetches search + details (capped) with a key', async () => {
    const dcfg = { ...cfg, domria: { ...cfg.domria, apiKey: 'k' } };
    const getJson = jest
      .fn()
      .mockResolvedValueOnce({ items: [1, 2, 3] }) // search — capped to maxDetails=2
      .mockResolvedValueOnce({
        description_title: 'Квартира 1',
        price: 9000,
        total_square_meters: '50',
        city_name: 'Київ',
        district_name: 'Центр',
        beautiful_url: 'realty-1',
        main_photo: 'p1.jpg',
        is_owner: 1,
      })
      .mockRejectedValueOnce(new Error('bad id')); // second detail fails → skipped
    const ctx = { cfg: dcfg, getHtml: jest.fn(), getJson };
    const res = await SITE_SPECS.domria.fetch!(ctx as any, criteria);
    expect(getJson).toHaveBeenCalledTimes(3); // 1 search + 2 details (one throws)
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      id: '1',
      title: 'Квартира 1',
      price: 9000,
      area: 50,
      city: 'Київ',
      isBusiness: false,
      url: 'https://dom.ria.com/uk/realty-1',
    });
  });
});
