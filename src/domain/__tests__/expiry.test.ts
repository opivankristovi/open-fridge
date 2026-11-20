import {
  daysInFridge,
  daysLeft,
  daysOpen,
  describeDaysLeft,
  effectiveExpiry,
  expiryStatus,
  notificationTriggers,
  parseLocalDate,
  type ExpiryInput,
} from '../expiry';
import { CATEGORIES, categoryFromOff, shelfDefaults } from '../categories';

const now = new Date(2026, 10, 17, 10, 0); // 17 nov 2026, 10:00 local

function item(p: Partial<ExpiryInput> = {}): ExpiryInput {
  return {
    added_at: new Date(2026, 10, 15, 12, 0).toISOString(),
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
    expect(daysInFridge(i, now)).toBe(1);
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
    expect(categoryFromOff(['en:snacks'])).toBe('overig');
    expect(categoryFromOff([])).toBe('overig');
  });
  it('cheese beats dairy', () => {
    expect(categoryFromOff(['en:dairies', 'en:cheeses'])).toBe('kaas');
  });
  it('shelfDefaults returns the new category defaults', () => {
    expect(shelfDefaults('vlees')).toEqual({ fresh: 2, opened: 3 });
    expect(shelfDefaults('sauzen')).toEqual({ fresh: 5, opened: null });
    expect(shelfDefaults('restjes')).toEqual({ fresh: 3, opened: null });
    expect(CATEGORIES.restjes.canOpen).toBe(false);
    expect(CATEGORIES.kaas.canOpen).toBe(true);
  });
  it('shelfDefaults applies overrides', () => {
    expect(shelfDefaults('vlees', { vlees: { fresh: 3 } })).toEqual({ fresh: 3, opened: 3 });
    expect(shelfDefaults('vlees', { vlees: { opened: 6 } })).toEqual({ fresh: 2, opened: 6 });
  });
  it('shelfDefaults: explicit null override differs from absent / undefined', () => {
    expect(shelfDefaults('vlees', { vlees: { opened: null } })).toEqual({ fresh: 2, opened: null });
    expect(shelfDefaults('vlees', { vlees: { opened: undefined } })).toEqual({ fresh: 2, opened: 3 });
    expect(shelfDefaults('vlees', { vlees: {} })).toEqual({ fresh: 2, opened: 3 });
    expect(shelfDefaults('vlees', {})).toEqual({ fresh: 2, opened: 3 });
    expect(shelfDefaults('vlees', null)).toEqual({ fresh: 2, opened: 3 });
    // null default overridden with a number
    expect(shelfDefaults('sauzen', { sauzen: { opened: 7 } })).toEqual({ fresh: 5, opened: 7 });
  });
});
