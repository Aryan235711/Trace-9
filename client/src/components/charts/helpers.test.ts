import { toDate, sortLogsDesc, getLastNDays, getAreaChartDomains } from './helpers';

describe('chart helpers', () => {
  test('toDate handles Date and string inputs', () => {
    const d1 = new Date('2025-01-02');
    const d2 = toDate(d1);
    expect(d2 instanceof Date).toBe(true);
    expect(d2.getTime()).toBe(d1.getTime());

    const d3 = toDate('2025-01-03');
    expect(d3 instanceof Date).toBe(true);
    expect(d3.getFullYear()).toBe(2025);
  });

  test('sortLogsDesc sorts newest first and handles mixed types', () => {
    const logs = [
      { date: '2025-01-02' },
      { date: new Date('2025-01-04') },
      { date: '2025-01-01' },
      { date: new Date('2025-01-03') },
    ];
    const sorted = sortLogsDesc(logs);
    expect(sorted[0].date instanceof Date || typeof sorted[0].date === 'string').toBeTruthy();
    // Check order by converting to timestamps
    const times = sorted.map(l => toDate(l.date).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i-1]).toBeGreaterThanOrEqual(times[i]);
    }
  });

  test('getLastNDays returns at most n items and works on empty arrays', () => {
    const logs = [
      { date: '2025-01-05' },
      { date: '2025-01-04' },
      { date: '2025-01-03' },
    ];
    const last2 = getLastNDays(logs, 2);
    expect(last2.length).toBe(2);

    const empty = getLastNDays([], 7);
    expect(Array.isArray(empty)).toBe(true);
    expect(empty.length).toBe(0);
  });

  describe('getAreaChartDomains', () => {
    test('returns defaults for empty logs', () => {
      const domains = getAreaChartDomains([]);
      expect(domains.sleepDomain).toEqual([0, 9]);
      expect(domains.hrvDomain).toEqual([0, 100]);
    });

    test('expands sleep domain based on observed values and caps at 14', () => {
      // observed max 12 -> upper should be ceil(12+1)=13
      const d1 = getAreaChartDomains([{ date: '2025-01-01', sleep: 12 }]);
      expect(d1.sleepDomain).toEqual([0, 13]);

      // observed max 13.5 -> ceil(13.5+1)=15 -> cap at 14
      const d2 = getAreaChartDomains([{ date: '2025-01-01', sleep: 13.5 } as any]);
      expect(d2.sleepDomain).toEqual([0, 14]);
    });

    test('hrv domain rounds up to nearest 10 and allows >100', () => {
      const d1 = getAreaChartDomains([{ date: '2025-01-01', hrv: 115 }]);
      expect(d1.hrvDomain).toEqual([0, 120]);

      // values below 100 should still result in minimum 100
      const d2 = getAreaChartDomains([{ date: '2025-01-01', hrv: 87 }]);
      expect(d2.hrvDomain).toEqual([0, 100]);
    });

    test('ignores null/undefined numeric values', () => {
      const d = getAreaChartDomains([
        { date: '2025-01-01', sleep: null, hrv: undefined } as any,
      ]);
      expect(d.sleepDomain).toEqual([0, 9]);
      expect(d.hrvDomain).toEqual([0, 100]);
    });
  });
});
