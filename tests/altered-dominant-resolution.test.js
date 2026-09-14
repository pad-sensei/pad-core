import { describe, it, expect } from 'vitest';

function topNames(notes, spellingKey = 10) {
  return padResolveChordCandidates(notes, spellingKey)
    .filter(candidate => candidate.isTopRanked)
    .map(candidate => candidate.name);
}

describe('v1.8.1 altered-dominant resolution', () => {
  it('keeps Bb7(b9,b13) above the bII minor-6 slash alias', () => {
    // Screenshot fixture: Bb1 Ab2 D3 Gb3 B3.
    // Relative to Bb: R, b7, 3, b13, b9. The upper B-D-Gb is Bm,
    // but that upper structure must not replace the dominant parent chord.
    const notes = [34, 44, 50, 54, 59];
    const resolved = padResolveChordCandidates(notes, 10);

    expect(resolved[0].name).toBe('Bb7(b9,b13)');
    expect(resolved[0].rootPC).toBe(10);
    expect(resolved[0].isTopRanked).toBe(true);
    expect(topNames(notes, 10)).toContain('Bb7(b9,b13)');

    const slash = resolved.find(candidate => candidate.name === 'Bm6 / Bb' || candidate.name === 'Bm6 / A#');
    if (slash) expect(slash.resolutionScore).toBeLessThan(resolved[0].resolutionScore);
  });

  it('keeps the reduced Bb7(b13) dominant shell above slash/hybrid readings', () => {
    // Bb1 Ab2 D3 Gb3 = R, b7, 3, b13 with the natural fifth omitted.
    const notes = [34, 44, 50, 54];
    const resolved = padResolveChordCandidates(notes, 10);

    expect(resolved[0].name).toBe('Bb7(b13)');
    expect(resolved[0].rootPC).toBe(10);
    expect(resolved[0].isTopRanked).toBe(true);
    expect(resolved[0].quality).toBe('7');
    expect(resolved[0].tensionLabels).toContain('b13');
  });

  it('keeps the winning altered dominant structured as a dominant-7 context for UST consumers', () => {
    const notes = [34, 44, 50, 54, 59];
    const resolved = padResolveChordCandidates(notes, 10);
    const top = resolved[0];

    expect(top.name).toBe('Bb7(b9,b13)');
    expect(top.quality).toBe('7');
    expect(top.chordPCS).toEqual(expect.arrayContaining([0, 1, 4, 8, 10]));
    expect(top.observedBassPC).toBe(10);
  });
});
