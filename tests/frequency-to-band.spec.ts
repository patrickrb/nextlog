import { test, expect } from '@playwright/test';
import { frequencyToBand } from '@/lib/adif';

// Pure-function tests for the ADIF-import frequency→band fallback. These guard
// the interop gap where an imported QSO whose <band> field was absent but which
// carried a <freq> on a band the mapper didn't know (60M, 4M, 1.25M, the LF/MF
// bands, 13CM) was stored as 'OTHER' — invisible to band filters and charts.

test.describe('frequencyToBand', () => {
  test('maps the classic HF bands', () => {
    expect(frequencyToBand(1.840)).toBe('160M');
    expect(frequencyToBand(3.573)).toBe('80M');
    expect(frequencyToBand(7.074)).toBe('40M');
    expect(frequencyToBand(10.136)).toBe('30M');
    expect(frequencyToBand(14.074)).toBe('20M');
    expect(frequencyToBand(18.100)).toBe('17M');
    expect(frequencyToBand(21.074)).toBe('15M');
    expect(frequencyToBand(24.915)).toBe('12M');
    expect(frequencyToBand(28.074)).toBe('10M');
  });

  test('maps 60M — the band the importer previously missed', () => {
    // WSJT-X FT8 watering hole on 60M in the US channelised sub-band.
    expect(frequencyToBand(5.3574)).toBe('60M');
    expect(frequencyToBand(5.107)).toBe('60M');
  });

  test('maps the LF/MF digital bands', () => {
    expect(frequencyToBand(0.1360)).toBe('2200M');
    expect(frequencyToBand(0.4742)).toBe('630M');
  });

  test('maps the VHF/UHF bands', () => {
    expect(frequencyToBand(50.313)).toBe('6M');
    expect(frequencyToBand(70.154)).toBe('4M');
    expect(frequencyToBand(144.174)).toBe('2M');
    expect(frequencyToBand(222.100)).toBe('1.25M');
    expect(frequencyToBand(432.100)).toBe('70CM');
    expect(frequencyToBand(1296.100)).toBe('23CM');
  });

  test('maps the microwave bands the app charts', () => {
    expect(frequencyToBand(915.0)).toBe('33CM');
    expect(frequencyToBand(2320.0)).toBe('13CM');
  });

  test('falls back to OTHER for out-of-band frequencies', () => {
    expect(frequencyToBand(4.5)).toBe('OTHER');
    expect(frequencyToBand(100.0)).toBe('OTHER');
  });
});
