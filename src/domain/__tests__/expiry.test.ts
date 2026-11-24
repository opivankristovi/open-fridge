import {
  daysInHouse,
  daysLeft,
  daysOpen,
  describeDaysLeft,
  effectiveExpiry,
  expiryStatus,
  notificationTriggers,
  parseLocalDate,
  type ExpiryInput,
} from '../expiry';
import { CATEGORIES, categoryFromOff, type CategoryKey } from '../categories';
import { SHELF_BASE, shelfDefaults } from '../shelfLife';
import {
  defaultLocation,
  kindLabel,
  LOCATION_KINDS,
  locationLabel,
  sortLocations,
} from '../locations';
import { setLanguage } from '../../i18n/strings';

beforeAll(() => setLanguage('nl'));

const now = new Date(2026, 10, 17, 10, 0); // 17 nov 2026, 10:00 local

function item(p: Partial<ExpiryInput> = {}): ExpiryInput {
  const added_at = p.added_at ?? new Date(2026, 10, 15, 12, 0).toISOString();
  return {
    added_at,
    stored_at: added_at, // never moved
    expiry_date: null,
    opened_at: null,
    opened_shelf_days: null,
    fresh_shelf_days: null,
    ...p,
  };
}

describe('parseLocalDate', () => {
  it('is local midnight, not off by one', () => {
    const d = parseLocalDate('2026-11-17');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(17);
    expect(d.getHours()).toBe(0);
  });
});

describe('effectiveExpiry', () => {
  it('printed only', () => {
    const e = effectiveExpiry(item({ expiry_date: '2026-11-20' }))!;
    expect(e.rule).toBe('printed');
    expect(e.date).toEqual(new Date(2026, 10, 20));
  });
  it('fresh only', () => {
    const e = effectiveExpiry(item({ fresh_shelf_days: 5 }))!;
    expect(e.rule).toBe('fresh');
    expect(e.date).toEqual(new Date(2026, 10, 20));
  });
  it('opened earlier than printed -> opened', () => {
    const e = effectiveExpiry(
      item({
        expiry_date: '2026-11-30',
        opened_at: new Date(2026, 10, 16, 9, 0).toISOString(),
        opened_shelf_days: 2,
      }),
    )!;
    expect(e.rule).toBe('opened');
    expect(e.date).toEqual(new Date(2026, 10, 18));
  });
  it('printed earlier than opened -> printed', () => {
    const e = effectiveExpiry(
      item({
        expiry_date: '2026-11-17',
        opened_at: new Date(2026, 10, 16, 9, 0).toISOString(),
        opened_shelf_days: 5,
      }),
    )!;
    expect(e.rule).toBe('printed');
  });
  it('tie -> printed', () => {
    const e = effectiveExpiry(
      item({
        expiry_date: '2026-11-18',
        opened_at: new Date(2026, 10, 16, 9, 0).toISOString(),
        opened_shelf_days: 2,
      }),
    )!;
    expect(e.rule).toBe('printed');
  });
  it('fresh ignored when a printed date exists', () => {
    const e = effectiveExpiry(item({ expiry_date: '2026-12-31', fresh_shelf_days: 1 }))!;
    expect(e.rule).toBe('printed');
    expect(e.date).toEqual(new Date(2026, 11, 31));
  });
  it('opened without opened_shelf_days is ignored', () => {
    expect(
      effectiveExpiry(item({ opened_at: new Date(2026, 10, 16).toISOString() })),
    ).toBeNull();
  });
  it('opened with null days keeps the printed date leading', () => {
    const e = effectiveExpiry(
      item({
        expiry_date: '2026-12-01',
        opened_at: new Date(2026, 10, 16).toISOString(),
        opened_shelf_days: null,
      }),
    )!;
    expect(e.rule).toBe('printed');
    expect(e.date).toEqual(new Date(2026, 11, 1));
  });
  it('opened with null days keeps the fresh rule leading', () => {
    const e = effectiveExpiry(
      item({
        fresh_shelf_days: 5,
        opened_at: new Date(2026, 10, 16).toISOString(),
        opened_shelf_days: null,
      }),
    )!;
    expect(e.rule).toBe('fresh');
    expect(e.date).toEqual(new Date(2026, 10, 20));
  });
  it('opened with null days and no other rule -> no expiry', () => {
    expect(
      effectiveExpiry(item({ opened_at: new Date(2026, 10, 16).toISOString(), opened_shelf_days: null })),
    ).toBeNull();
  });
  it('nothing -> null / onbekend', () => {
    expect(effectiveExpiry(item())).toBeNull();
    expect(daysLeft(item(), now)).toBeNull();
    expect(expiryStatus(item(), 2, now)).toBe('onbekend');
  });
});

describe('effectiveExpiry after a move (stored_at)', () => {
  const moved = new Date(2026, 10, 16, 18, 0).toISOString(); // moved 16 nov, item added 15 nov
  it('fresh clock starts at stored_at', () => {
    const e = effectiveExpiry(item({ stored_at: moved, fresh_shelf_days: 5 }))!;
    expect(e.rule).toBe('fresh');
    expect(e.date).toEqual(new Date(2026, 10, 21));
  });
  it('opened clock = max(opened_at, stored_at): opened before the move restarts at the move', () => {
    const e = effectiveExpiry(
      item({
        stored_at: moved,
        opened_at: new Date(2026, 10, 15, 13, 0).toISOString(),
        opened_shelf_days: 3,
      }),
    )!;
    expect(e.rule).toBe('opened');
    expect(e.date).toEqual(new Date(2026, 10, 19));
  });
  it('opened after the move counts from opened_at', () => {
    const e = effectiveExpiry(
      item({
        stored_at: moved,
        opened_at: new Date(2026, 10, 17, 8, 0).toISOString(),
        opened_shelf_days: 3,
      }),
    )!;
    expect(e.date).toEqual(new Date(2026, 10, 20));
  });
  it('printed date is unaffected', () => {
    const e = effectiveExpiry(item({ stored_at: moved, expiry_date: '2026-11-18' }))!;
    expect(e.rule).toBe('printed');
    expect(e.date).toEqual(new Date(2026, 10, 18));
  });
  it('daysInHouse still counts from added_at', () => {
    expect(daysInHouse(item({ stored_at: moved }), now)).toBe(2);
  });
});

describe('expiryStatus boundaries', () => {
  const warn = 2;
  const withDaysLeft = (n: number) =>
    item({ expiry_date: `2026-11-${String(17 + n).padStart(2, '0')}` });
  it('daysLeft = warnDays -> bijna', () => {
    expect(daysLeft(withDaysLeft(2), now)).toBe(2);
    expect(expiryStatus(withDaysLeft(2), warn, now)).toBe('bijna');
  });
  it('warnDays + 1 -> ok', () => {
    expect(expiryStatus(withDaysLeft(3), warn, now)).toBe('ok');
  });
  it('0 -> bijna', () => {
    expect(expiryStatus(withDaysLeft(0), warn, now)).toBe('bijna');
  });
  it('-1 -> verlopen', () => {
    expect(expiryStatus(withDaysLeft(-1), warn, now)).toBe('verlopen');
  });
});

describe('calendar days', () => {
  it('item added at 23:30 yesterday counts as 1 day in fridge', () => {
    const i = item({ added_at: new Date(2026, 10, 16, 23, 30).toISOString() });
    expect(daysInHouse(i, now)).toBe(1);
  });
  it('fresh expiry counts from the calendar day of adding', () => {
    const i = item({
      added_at: new Date(2026, 10, 16, 23, 30).toISOString(),
      fresh_shelf_days: 1,
    });
    // expires 17 nov (today), even though only 10.5h passed
    expect(daysLeft(i, now)).toBe(0);
  });
  it('daysOpen', () => {
    expect(daysOpen(item(), now)).toBeNull();
    expect(
      daysOpen(item({ opened_at: new Date(2026, 10, 15, 23, 59).toISOString() }), now),
    ).toBe(2);
  });
});

describe('describeDaysLeft', () => {
  it('formats Dutch strings', () => {
    expect(describeDaysLeft(0)).toBe('vandaag laatste dag');
    expect(describeDaysLeft(1)).toBe('nog 1 dag');
    expect(describeDaysLeft(4)).toBe('nog 4 dagen');
    expect(describeDaysLeft(-1)).toBe('1 dag over datum');
    expect(describeDaysLeft(-3)).toBe('3 dagen over datum');
  });
  it('follows the active language', () => {
    const dutch = describeDaysLeft(2);
    setLanguage('en');
    try {
      expect(describeDaysLeft(2)).not.toBe(dutch);
    } finally {
      setLanguage('nl');
    }
  });
});

describe('notificationTriggers', () => {
  it('returns warn then expiry, ascending, at notifyHour', () => {
    const t = notificationTriggers(item({ expiry_date: '2026-11-22' }), 2, 8, now);
    expect(t.map((x) => x.kind)).toEqual(['warn', 'expiry']);
    expect(t[0].date).toEqual(new Date(2026, 10, 20, 8, 0));
    expect(t[1].date).toEqual(new Date(2026, 10, 22, 8, 0));
  });
  it('drops past triggers', () => {
    const t = notificationTriggers(item({ expiry_date: '2026-11-18' }), 2, 8, now);
    expect(t).toHaveLength(1);
    expect(t[0].kind).toBe('expiry');
    // today's 08:00 is past
    expect(notificationTriggers(item({ expiry_date: '2026-11-17' }), 0, 8, now)).toEqual([]);
  });
  it('warnDays 0 -> only expiry', () => {
    const t = notificationTriggers(item({ expiry_date: '2026-11-22' }), 0, 9, now);
    expect(t).toHaveLength(1);
    expect(t[0].kind).toBe('expiry');
  });
  it('no expiry -> empty', () => {
    expect(notificationTriggers(item(), 2, 8, now)).toEqual([]);
  });
});

describe('categories', () => {
  it('categoryFromOff maps tags', () => {
    expect(categoryFromOff(['en:dairies'])).toBe('zuivel');
    expect(categoryFromOff(['en:meats'])).toBe('vlees');
    expect(categoryFromOff(['en:fishes'])).toBe('vis');
    expect(categoryFromOff(['en:fruits'])).toBe('fruit');
    expect(categoryFromOff(['en:vegetables'])).toBe('groenten');
    expect(categoryFromOff(['en:sauces'])).toBe('sauzen');
    expect(categoryFromOff(['en:beverages'])).toBe('dranken');
    expect(categoryFromOff(['en:unknown'])).toBe('overig');
    expect(categoryFromOff([])).toBe('overig');
  });
  it('cheese beats dairy', () => {
    expect(categoryFromOff(['en:dairies', 'en:cheeses'])).toBe('kaas');
  });
  it('categoryFromOff maps the new categories', () => {
    const cases: [string, CategoryKey][] = [
      ['en:canned-foods', 'conserven'],
      ['en:canned-vegetables', 'conserven'],
      ['en:canned-fish', 'conserven'],
      ['en:jams', 'conserven'],
      ['en:pickles', 'conserven'],
      ['en:meals', 'maaltijden'],
      ['en:prepared-meals', 'maaltijden'],
      ['en:frozen-ready-meals', 'maaltijden'],
      ['en:pizzas', 'maaltijden'],
      ['en:breads', 'brood'],
      ['en:viennoiseries', 'brood'],
      ['en:cakes', 'brood'],
      ['en:pastries', 'brood'],
      ['en:pastas', 'droogwaren'],
      ['en:rices', 'droogwaren'],
      ['en:flours', 'droogwaren'],
      ['en:breakfast-cereals', 'droogwaren'],
      ['en:dried-products', 'droogwaren'],
      ['en:legumes-and-their-products', 'droogwaren'],
      ['en:snacks', 'snacks'],
      ['en:sweet-snacks', 'snacks'],
      ['en:salty-snacks', 'snacks'],
      ['en:chocolates', 'snacks'],
      ['en:confectioneries', 'snacks'],
      ['en:biscuits', 'snacks'],
      ['en:ice-creams', 'snacks'],
    ];
    for (const [tag, cat] of cases) expect([tag, categoryFromOff([tag])]).toEqual([tag, cat]);
  });
  it('categoryFromOff precedence', () => {
    expect(categoryFromOff(['en:canned-fish', 'en:fishes'])).toBe('conserven');
    expect(categoryFromOff(['en:pizzas', 'en:cheeses'])).toBe('kaas');
    expect(categoryFromOff(['en:meals', 'en:meats'])).toBe('maaltijden');
    expect(categoryFromOff(['en:dairies', 'en:ice-creams'])).toBe('zuivel');
    expect(categoryFromOff(['en:cakes', 'en:snacks'])).toBe('brood');
    expect(categoryFromOff(['en:pastas', 'en:snacks'])).toBe('droogwaren');
    expect(categoryFromOff(['en:snacks', 'en:fruits'])).toBe('snacks');
  });
  it('canOpen', () => {
    expect(CATEGORIES.restjes.canOpen).toBe(false);
    expect(CATEGORIES.kaas.canOpen).toBe(true);
    expect(CATEGORIES.snacks.canOpen).toBe(true);
  });
  it('every kind has a shelf entry for every category', () => {
    for (const kind of LOCATION_KINDS) {
      for (const cat of Object.keys(CATEGORIES) as CategoryKey[]) {
        expect(SHELF_BASE[kind][cat].fresh).toBeGreaterThan(0);
      }
    }
  });
});

describe('shelfDefaults per kind', () => {
  it('returns the built-in table per kind', () => {
    expect(shelfDefaults('fridge', 'vlees')).toEqual({ fresh: 2, opened: 3 });
    expect(shelfDefaults('fridge', 'sauzen')).toEqual({ fresh: 5, opened: null });
    expect(shelfDefaults('fridge', 'restjes')).toEqual({ fresh: 3, opened: null });
    expect(shelfDefaults('freezer', 'vlees')).toEqual({ fresh: 120, opened: 90 });
    expect(shelfDefaults('freezer', 'sauzen')).toEqual({ fresh: 90, opened: 90 });
    expect(shelfDefaults('pantry', 'conserven')).toEqual({ fresh: 365, opened: 1 });
    expect(shelfDefaults('cellar', 'groenten')).toEqual({ fresh: 14, opened: 3 });
    expect(shelfDefaults('storage_room', 'snacks')).toEqual({ fresh: 30, opened: 14 });
    expect(shelfDefaults('other', 'droogwaren')).toEqual({ fresh: 365, opened: 180 });
    expect(shelfDefaults('fridge', 'droogwaren')).toEqual({ fresh: 90, opened: 30 });
  });
  it('applies overrides only to their own kind', () => {
    const o = { fridge: { vlees: { fresh: 3 } } };
    expect(shelfDefaults('fridge', 'vlees', o)).toEqual({ fresh: 3, opened: 3 });
    expect(shelfDefaults('freezer', 'vlees', o)).toEqual({ fresh: 120, opened: 90 });
    expect(shelfDefaults('fridge', 'vlees', { fridge: { vlees: { opened: 6 } } })).toEqual({
      fresh: 2,
      opened: 6,
    });
  });
  it('explicit null override differs from absent / undefined', () => {
    expect(shelfDefaults('fridge', 'vlees', { fridge: { vlees: { opened: null } } })).toEqual({
      fresh: 2,
      opened: null,
    });
    expect(shelfDefaults('fridge', 'vlees', { fridge: { vlees: { opened: undefined } } })).toEqual({
      fresh: 2,
      opened: 3,
    });
    expect(shelfDefaults('fridge', 'vlees', { fridge: { vlees: {} } })).toEqual({ fresh: 2, opened: 3 });
    expect(shelfDefaults('fridge', 'vlees', { fridge: {} })).toEqual({ fresh: 2, opened: 3 });
    expect(shelfDefaults('fridge', 'vlees', {})).toEqual({ fresh: 2, opened: 3 });
    expect(shelfDefaults('fridge', 'vlees', null)).toEqual({ fresh: 2, opened: 3 });
    expect(shelfDefaults('fridge', 'sauzen', { fridge: { sauzen: { opened: 7 } } })).toEqual({
      fresh: 5,
      opened: 7,
    });
  });
});

describe('locations', () => {
  it('locationLabel: name, else kind label', () => {
    expect(locationLabel({ name: 'Garage', kind: 'fridge' })).toBe('Garage');
    expect(locationLabel({ name: null, kind: 'freezer' })).toBe('Diepvries');
    expect(locationLabel({ name: null, kind: 'fridge' })).toBe(kindLabel('fridge'));
    expect(locationLabel({ name: '   ', kind: 'cellar' })).toBe('Kelder');
    expect(locationLabel({ name: '  Kelder 2 ', kind: 'cellar' })).toBe('Kelder 2');
  });
  const L = (id: string, kind: (typeof LOCATION_KINDS)[number], day: number) => ({
    id,
    kind,
    created_at: new Date(2026, 0, day).toISOString(),
  });
  it('sortLocations: by kind order then age, without mutating', () => {
    const input = [L('a', 'pantry', 1), L('b', 'freezer', 5), L('c', 'fridge', 9), L('d', 'fridge', 2)];
    const out = sortLocations(input);
    expect(out.map((l) => l.id)).toEqual(['d', 'c', 'b', 'a']);
    expect(input.map((l) => l.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('defaultLocation: oldest fridge, else oldest', () => {
    expect(defaultLocation([L('a', 'pantry', 1), L('c', 'fridge', 9), L('d', 'fridge', 2)])?.id).toBe('d');
    expect(defaultLocation([L('a', 'freezer', 5), L('b', 'pantry', 1)])?.id).toBe('b');
    expect(defaultLocation([L('a', 'pantry', 1)])?.id).toBe('a');
    expect(defaultLocation([])).toBeNull();
  });
});
