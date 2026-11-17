import { buildSchedule, MAX_SCHEDULED, type ScheduleItem } from '../schedule';

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
