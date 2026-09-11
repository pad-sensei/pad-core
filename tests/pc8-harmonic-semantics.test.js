import { describe, it, expect } from 'vitest';

describe('pc8 harmonic semantics: b6 / #5 / b13', () => {
  it('prefers BbMaj7/D over a D-minor lower-sixth reading', () => {
    const results = padDetectChord([62, 65, 69, 70], 10); // D F A Bb
    expect(results[0].name).toBe('BbMaj7 / D');
    const dmColor = results.find(r => r.name === 'Dm(b6)');
    expect(dmColor).toBeDefined();
    expect(dmColor.score).toBeLessThan(results[0].score);
    expect(results.every(r => !r.name.startsWith('Dm(b13)'))).toBe(true);
  });

  it('spells a major-triad lower sixth as b6, never addb13', () => {
    const results = padDetectChord([60, 64, 67, 68]); // C E G Ab
    expect(results[0].name).toBe('C(b6)');
    expect(results.every(r => !r.name.includes('addb13'))).toBe(true);
    expect(results[0].observedPCS).toEqual([0, 4, 7, 8]);
  });

  it('keeps a clean augmented triad structural #5', () => {
    const results = padDetectChord([60, 64, 68]); // C E G#
    expect(results[0].name).toBe('Caug');
  });

  it('uses b13 in flat-seventh context and keeps it ahead of augmented subsets', () => {
    const results = padDetectChord([60, 64, 67, 68, 70]); // C E G Ab Bb
    expect(results[0].name).toBe('C7(b13)');
    expect(results[0].observedPCS).toEqual([0, 4, 7, 8, 10]);
    const aug = results.find(r => r.name === 'Caug');
    if (aug) expect(aug.score).toBeLessThan(results[0].score);
  });

  it('keeps Gadd9/B ahead of Bm7(b13) without deleting the latter', () => {
    const results = padDetectChord([59, 67, 69, 74]); // B G A D
    expect(results[0].name).toBe('Gadd9 / B');
    const altered = results.find(r => r.name === 'Bm7(b13)');
    expect(altered).toBeDefined();
    expect(altered.score).toBeLessThan(results[0].score);
  });

  it('attaches the exact observation to every returned hybrid candidate', () => {
    const notes = [60, 62, 65, 70]; // C D F Bb; exercises b7-over-bass hybrid ranking
    const expected = [0, 2, 5, 10];
    const results = padDetectChord(notes);
    expect(results.length).toBeGreaterThan(0);
    for (const candidate of results) {
      expect(candidate.observedPCS).toEqual(expected);
      expect(candidate.observedPitchClasses).toEqual(expected);
      expect(candidate.observedBassPC).toBe(0);
    }
  });

  it('parses explicit b6 separately from seventh-chord b13', () => {
    expect(padParseChordName('C(b6)').displayName).toBe('C(b6)');
    expect(padParseChordName('C(b13)')).toBeNull();
    expect(padParseChordName('C7(b13)').displayName).toBe('C7(b13)');
  });
});
