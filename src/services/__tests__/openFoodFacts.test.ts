import { parseOffResponse } from '../openFoodFacts';
import { setLanguage } from '../../i18n/strings';

beforeAll(() => setLanguage('nl'));

describe('parseOffResponse', () => {
  it('maps a found product (nl name, first brand, https image, category)', () => {
    const r = parseOffResponse({
      status: 1,
      product: {
        product_name: 'Whole milk',
        product_name_nl: 'Volle melk',
        brands: 'Campina, Friesche Vlag',
        image_front_url: 'https://images.example.com/front.jpg',
        image_front_small_url: 'https://images.example.com/small.jpg',
        categories_tags: ['en:dairies', 'en:milks'],
      },
    });
    expect(r).toEqual({
      name: 'Volle melk',
      brand: 'Campina',
      image_url: 'https://images.example.com/front.jpg',
      category: 'zuivel',
    });
  });

  it('falls back to product_name and the small image', () => {
    const r = parseOffResponse({
      status: 1,
      product: {
        product_name: 'Gouda',
        image_front_small_url: 'https://images.example.com/small.jpg',
        categories_tags: ['en:cheeses', 'en:dairies'],
      },
    });
    expect(r?.name).toBe('Gouda');
    expect(r?.brand).toBeNull();
    expect(r?.image_url).toBe('https://images.example.com/small.jpg');
    expect(r?.category).toBe('kaas');
  });

  it('drops non-https images', () => {
    const r = parseOffResponse({
      status: 1,
      product: { product_name: 'X', image_front_url: 'http://insecure.example.com/a.jpg' },
    });
    expect(r?.image_url).toBeNull();
    expect(r?.category).toBe('overig');
  });

  it('returns null when not found', () => {
    expect(parseOffResponse({ status: 0, status_verbose: 'product not found' })).toBeNull();
    expect(parseOffResponse(null)).toBeNull();
    expect(parseOffResponse({ status: 1 })).toBeNull();
  });
});
