import {
  buildSchedule,
  entryId,
  MAX_SCHEDULED,
  parseEntryId,
  planResync,
  type ScheduledEntry,
  type ScheduleItem,
} from '../schedule';
import { setLanguage } from '../../i18n/strings';

beforeAll(() => setLanguage('nl'));

const now = new Date(2026, 10, 17, 10, 0); // 17 nov 2026, 10:00 local
const prefs = { warnDays: 2, notifyHour: 9 };

function item(id: string, name: string, p: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id,
    name,
    added_at: new Date(2026, 10, 15, 12, 0).toISOString(),
    expiry_date: null,
    opened_at: null,
    opened_shelf_days: null,
    fresh_shelf_days: null,
    ...p,
  };
}

describe('buildSchedule', () => {
  it('builds warn + expiry entries, sorted by date', () => {
    const out = buildSchedule(
      [
        item('b', 'Yoghurt', { expiry_date: '2026-11-25' }),
        item('a', 'Melk', { expiry_date: '2026-11-20' }),
      ],
      prefs,
      now,
    );
    expect(out.map((e) => [e.title, e.body, e.data.itemId])).toEqual([
      ['Bijna over datum', 'Melk: nog 2 dagen', 'a'],
      ['Laatste dag', 'Melk moet vandaag op of weg', 'a'],
      ['Bijna over datum', 'Yoghurt: nog 2 dagen', 'b'],
      ['Laatste dag', 'Yoghurt moet vandaag op of weg', 'b'],
    ]);
    expect(out[0].date).toEqual(new Date(2026, 10, 18, 9, 0));
    expect(out[1].date).toEqual(new Date(2026, 10, 20, 9, 0));
    expect(out[2].date).toEqual(new Date(2026, 10, 23, 9, 0));
  });

  it('excludes triggers in the past', () => {
    // expires tomorrow: the warn moment (2 days before) is already past, expiry is not
    const out = buildSchedule([item('a', 'Melk', { expiry_date: '2026-11-18' })], prefs, now);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Laatste dag');
    // expired already: nothing left to schedule
    expect(buildSchedule([item('c', 'Oud', { expiry_date: '2026-11-10' })], prefs, now)).toEqual([]);
  });

  it('skips items without an expiry', () => {
    expect(buildSchedule([item('a', 'Onbekend')], prefs, now)).toEqual([]);
  });

  it('omits warn entries when warnDays is 0', () => {
    const out = buildSchedule(
      [item('a', 'Melk', { expiry_date: '2026-11-20' })],
      { warnDays: 0, notifyHour: 9 },
      now,
    );
    expect(out.map((e) => e.title)).toEqual(['Laatste dag']);
  });

  it('caps the schedule at 400 entries, keeping the earliest', () => {
    const items = Array.from({ length: 300 }, (_, i) =>
      item(`i${i}`, `Item ${i}`, { expiry_date: `2027-${String((i % 12) + 1).padStart(2, '0')}-15` }),
    );
    const out = buildSchedule(items, prefs, now);
    expect(out).toHaveLength(MAX_SCHEDULED);
    const times = out.map((e) => e.date.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

function entry(itemId: string, date: Date, body = 'Melk: nog 2 dagen', kind: 'warn' | 'expiry' = 'warn'): ScheduledEntry {
  return { kind, date, title: 'Bijna over datum', body, data: { itemId } };
}

describe('entryId / parseEntryId', () => {
  const d = new Date(2026, 10, 20, 9, 0);

  it('is stable for the same input and differs when date or body changes', () => {
    expect(entryId(entry('a', d))).toBe(entryId(entry('a', new Date(d.getTime()))));
    expect(entryId(entry('a', d))).not.toBe(entryId(entry('a', new Date(2026, 10, 21, 9, 0))));
    expect(entryId(entry('a', d))).not.toBe(entryId(entry('a', d, 'Kaas: nog 2 dagen')));
  });

  it('round-trips through parseEntryId', () => {
    expect(parseEntryId(entryId(entry('a', d, 'x', 'expiry')))).toEqual({
      itemId: 'a',
      kind: 'expiry',
      time: d.getTime(),
    });
  });

  it('returns null for non-item or malformed ids', () => {
    expect(parseEntryId('abc')).toBeNull();
    expect(parseEntryId('3f2b8c1e-aaaa-bbbb-cccc-1234567890ab')).toBeNull();
    expect(parseEntryId('item:broken')).toBeNull();
  });
});

describe('planResync', () => {
  const d1 = new Date(2026, 10, 20, 9, 0);
  const d2 = new Date(2026, 10, 22, 9, 0);
  const inStock = new Set(['a']);

  it('does nothing when nothing changed', () => {
    const e = entry('a', d1);
    expect(planResync([entryId(e)], [e], inStock, now, false)).toEqual({ cancel: [], schedule: [] });
  });

  it('replaces an entry whose date changed', () => {
    const oldId = entryId(entry('a', d1));
    const next = entry('a', d2);
    expect(planResync([oldId], [next], inStock, now, false)).toEqual({ cancel: [oldId], schedule: [next] });
  });

  it('keeps a past-due pending id for an in-stock item', () => {
    const due = entryId(entry('a', new Date(2026, 10, 17, 9, 30)));
    expect(planResync([due], [], inStock, now, false).cancel).toEqual([]);
  });

  it('cancels a past-due id for an item no longer in stock', () => {
    const due = entryId(entry('gone', new Date(2026, 10, 17, 9, 30)));
    expect(planResync([due], [], inStock, now, false).cancel).toEqual([due]);
  });

  it('leaves non-managed ids untouched', () => {
    expect(planResync(['random-uuid', 'test'], [], inStock, now, false)).toEqual({ cancel: [], schedule: [] });
    expect(planResync(['random-uuid'], [], inStock, now, true).cancel).toEqual([]);
  });

  it('forceAll cancels all managed ids and schedules everything', () => {
    const e = entry('a', d1);
    const id = entryId(e);
    const other = entryId(entry('a', d2));
    expect(planResync([id, other, 'x'], [e], inStock, now, true)).toEqual({
      cancel: [id, other],
      schedule: [e],
    });
  });
});
