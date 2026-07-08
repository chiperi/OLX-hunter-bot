import {
  toInt,
  toFloat,
  absoluteUrl,
  extractNextData,
  deepFindOffers,
  mapOffer,
  parseCards,
  idFromHref,
} from './parsing.util';

describe('toInt', () => {
  it.each([
    ['5 000 грн', 5000],
    ['10000', 10000],
    ['12,5', 125],
  ])('parses %s → %d', (input, expected) => {
    expect(toInt(input)).toBe(expected);
  });
  it.each(['', 'abc', null, undefined])('returns null for %s', (input) => {
    expect(toInt(input)).toBeNull();
  });
});

describe('toFloat', () => {
  it('parses comma decimals', () => {
    expect(toFloat('45,5 м²')).toBeCloseTo(45.5);
  });
  it.each(['0', 'abc', '', null])('returns null for non-positive/invalid %s', (input) => {
    expect(toFloat(input)).toBeNull();
  });
});

describe('absoluteUrl', () => {
  it('keeps absolute urls', () => {
    expect(absoluteUrl('https://y.com/a', 'https://x.com')).toBe('https://y.com/a');
  });
  it('joins relative urls', () => {
    expect(absoluteUrl('/a/b', 'https://x.com/')).toBe('https://x.com/a/b');
  });
  it('falls back to base when href missing', () => {
    expect(absoluteUrl(undefined, 'https://x.com')).toBe('https://x.com');
  });
});

describe('extractNextData', () => {
  it('parses embedded __NEXT_DATA__ JSON', () => {
    const html = '<script id="__NEXT_DATA__" type="application/json">{"a":1}</script>';
    expect(extractNextData(html)).toEqual({ a: 1 });
  });
  it('returns null without the script', () => {
    expect(extractNextData('<div>no data</div>')).toBeNull();
  });
  it('returns null on invalid JSON', () => {
    expect(extractNextData('<script id="__NEXT_DATA__">{oops</script>')).toBeNull();
  });
});

describe('deepFindOffers', () => {
  it('collects offer-shaped objects anywhere in the tree', () => {
    const tree = {
      props: {
        list: [{ id: 1, title: 'T', url: '/u' }, { foo: 'bar' }],
        nested: { deep: { id: 2, title: 'X', url: '/x' } },
      },
    };
    const offers = deepFindOffers(tree);
    expect(offers.map((o) => o.id).sort()).toEqual([1, 2]);
  });
  it('is bounded and safe on primitives', () => {
    expect(deepFindOffers(null)).toEqual([]);
    expect(deepFindOffers(42)).toEqual([]);
  });
});

describe('mapOffer', () => {
  const base = 'https://olx.ua';
  it('maps a rich offer', () => {
    const listing = mapOffer(
      {
        id: 5,
        title: ' Flat ',
        url: '/d/5',
        price: { value: 10000, currency: 'грн' },
        total_area: '45',
        location: { city: { name: 'Київ' }, district: { name: 'Центр' } },
        photos: [{ link: 'http://img/1.jpg' }],
        business: true,
      },
      base,
    );
    expect(listing).toMatchObject({
      id: '5',
      title: 'Flat',
      price: 10000,
      area: 45,
      city: 'Київ',
      district: 'Центр',
      url: 'https://olx.ua/d/5',
      imageUrl: 'http://img/1.jpg',
      isBusiness: true,
    });
  });

  it('defaults price/area to null and isBusiness to false', () => {
    const listing = mapOffer({ id: 'x', title: 'T', url: '/x' }, base);
    expect(listing).toMatchObject({ price: null, area: null, isBusiness: false, currency: 'грн' });
  });

  it('returns null when mapping throws', () => {
    const evil = {
      id: {
        toString() {
          throw new Error('boom');
        },
      },
      title: 'T',
      url: '/x',
    };
    expect(mapOffer(evil, base)).toBeNull();
  });
});

describe('parseCards', () => {
  const sel = {
    card: '[data-cy="l-card"]',
    title: 'h6',
    price: '[data-testid="ad-price"]',
    link: 'a[href]',
    image: 'img',
  };
  it('parses server-rendered cards', () => {
    const html =
      '<div data-cy="l-card"><a href="/item/12345">l</a><h6>Title</h6>' +
      '<span data-testid="ad-price">10 000 грн</span><img src="http://img"/></div>';
    const cards = parseCards(html, sel, 'https://olx.ua');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: '12345',
      title: 'Title',
      price: 10000,
      url: 'https://olx.ua/item/12345',
      imageUrl: 'http://img',
      isBusiness: false,
    });
  });
  it('skips cards without a link or title', () => {
    const html = '<div data-cy="l-card"><h6>NoLink</h6></div>';
    expect(parseCards(html, sel, 'https://olx.ua')).toEqual([]);
  });
});

describe('idFromHref', () => {
  it('extracts the numeric segment', () => {
    expect(idFromHref('/d/uk/obyavlenie/kvartira-12345.html')).toBe('12345');
  });
  it('falls back to the last segment', () => {
    expect(idFromHref('https://x.com/a/slug?q=1')).toBe('slug');
  });
});
