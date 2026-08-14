import { describe, it, expect } from 'vitest';

describe('v1.7 detection transparency', () => {
  function observedPCS(notes) {
    return Array.from(new Set(notes.map(note => ((note % 12) + 12) % 12))).sort((a, b) => a - b);
  }

  function expectExactObservation(notes, candidates) {
    const expected = observedPCS(notes);
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.observedPCS).toEqual(expected);
      expect(candidate.observedPitchClasses).toEqual(expected);
    }
  }

  it('keeps a played b9 visible on the C sixth-family candidate', () => {
    const notes = [60, 61, 64, 69, 74]; // C Db E A D
    const candidates = padDetectChord(notes);
    const sixth = candidates.find(candidate =>
      candidate.rootPC === 0 && candidate.name.startsWith('C6') && candidate.name.includes('b9')
    );
    expect(sixth).toBeTruthy();
    expect(sixth.tensionLabels).toContain('b9');
    expect(sixth.observedExtraLabels).toContain('b9');
    expect(sixth.name).toContain('(omit5)');
    expectExactObservation(notes, candidates);
  });

  it('does not return empty for split thirds and interprets b3 locally as #9 on major-third candidates', () => {
    const notes = [60, 63, 64, 69, 71]; // C Eb E A B
    const candidates = padDetectChord(notes);
    expect(candidates.some(candidate => candidate.rootPC === 0 && candidate.name.includes('#9'))).toBe(true);
    expectExactObservation(notes, candidates);
  });

  it('does not return empty for simultaneous b7 and Maj7', () => {
    const notes = [60, 64, 67, 70, 71]; // C E G Bb B
    const candidates = padDetectChord(notes);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some(candidate => candidate.rootPC === 0 &&
      (candidate.name.includes('b7') || candidate.name.includes('Maj7')))).toBe(true);
    expectExactObservation(notes, candidates);
  });

  it('retains Bm7(b13) behind the preferred Gadd9 / B reading', () => {
    const notes = [59, 67, 69, 74]; // B G A D
    const candidates = padDetectChord(notes);
    expect(candidates[0].name).toBe('Gadd9 / B');
    expect(candidates.some(candidate => candidate.name.startsWith('Bm7(b13)'))).toBe(true);
    expectExactObservation(notes, candidates);
  });

  it('retains non-functional slash/pedal candidates such as D / C', () => {
    const notes = [60, 62, 66, 69]; // C D F# A
    const candidates = padDetectChord(notes);
    expect(candidates.some(candidate => candidate.name === 'D / C')).toBe(true);
    expectExactObservation(notes, candidates);
  });

  it('retains the strongest dominant slash reading over an observed bass shell', () => {
    const notes = [48, 52, 55, 58, 59, 62, 65]; // C E G Bb B D F
    const candidates = padDetectChord(notes);
    const gDominantOverC = candidates.find(candidate =>
      candidate.rootPC === 7 && candidate.quality === '7' &&
      candidate.name.startsWith('G7') && candidate.name.includes(' / C')
    );
    expect(gDominantOverC).toBeTruthy();
    expect(gDominantOverC.observedPCS).toEqual([0, 2, 4, 5, 7, 10, 11]);
    expect(candidates.length).toBeLessThanOrEqual(8);
  });
});
