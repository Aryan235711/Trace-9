import { getComposedChartDomains } from '../../client/src/components/charts/helpers';

describe('client composed chart helpers (imported into server tests)', () => {
  test('returns sensible defaults for empty logs', () => {
    const d = getComposedChartDomains([] as any);
    expect(d.rhrDomain[0]).toBe(0);
    expect(d.rhrDomain[1]).toBeGreaterThanOrEqual(100);
    expect(d.hrvDomain).toEqual([0, 100]);
  });

  test('computes upper bounds based on observed values', () => {
    const d = getComposedChartDomains([{ date: '2025-01-01', rhr: 85, hrv: 78 } as any]);
    // rhrUpper = ceil(85+10)=95 -> max(100) => 100
    expect(d.rhrDomain[1]).toBeGreaterThanOrEqual(100);
    // hrvUpper rounding would be 80, but min enforced is 100
    expect(d.hrvDomain[1]).toBeGreaterThanOrEqual(100);
  });
  // Removed duplicate server-side composed helpers tests — client-side tests run under `client/`
});
