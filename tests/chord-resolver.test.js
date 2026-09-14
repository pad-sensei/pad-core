import { describe, it, expect } from 'vitest';

function makeInversion(rootMidi, intervals, inversion) {
  const notes = intervals.map(iv => rootMidi + iv);
  for (let i = 0; i < inversion; i++) notes[i] += 12;
  return notes.sort((a, b) => a - b);
}

function topGroup(results) {
  return results.filter(candidate => candidate.isTopRanked);
}

function registeredFourPlusNotePitchSets() {
  const seen = new Set();
  const out = [];
  for (const entry of CHORD_DETECT_DB) {
    const pcs = [...new Set((entry.pcs || []).map(pc => ((pc % 12) + 12) % 12))]
      .sort((a, b) => a - b);
    if (pcs.length < 4) continue;
    const key = pcs.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pcs);
  }
  return out;
}

describe('v1.8.1 chord resolution completeness', () => {
  it('resolves E G Bb C as C7/E and removes the partial Edim user-facing reading', () => {
    const notes = [64, 67, 70, 72];
    const raw = padDetectChord(notes);
    expect(raw.some(candidate => candidate.name === 'Edim')).toBe(true);

    const resolved = padResolveChordCandidates(notes);
    expect(resolved[0].name).toBe('C7 / E');
    expect(resolved[0].resolutionCompleteness).toBe('exact');
    expect(resolved.some(candidate => candidate.name === 'Edim')).toBe(false);
  });

  it('resolves E G B C as CMaj7/E while keeping Em(b6) only as a lower color reading', () => {
    const notes = [64, 67, 71, 72];
    const raw = padDetectChord(notes);
    expect(raw.some(candidate => candidate.name === 'Em(b6)')).toBe(true);

    const resolved = padResolveChordCandidates(notes);
    expect(resolved[0].name).toBe('CMaj7 / E');
    expect(resolved[0].resolutionCompleteness).toBe('exact');
    const lower = resolved.find(candidate => candidate.name === 'Em(b6)');
    expect(lower).toBeDefined();
    expect(lower.isTopRanked).toBe(false);
    expect(lower.resolutionSubsetPenalty).toBe(200);
    expect(lower.resolutionScore).toBeLessThan(resolved[0].resolutionScore);
  });

  it('keeps dominant seventh inversions complete across every transposition and inversion', () => {
    for (let root = 0; root < 12; root++) {
      for (let inversion = 0; inversion < 4; inversion++) {
        const notes = makeInversion(60 + root, [0, 4, 7, 10], inversion);
        const resolved = padResolveChordCandidates(notes, root);
        const expectedRoot = root % 12;
        expect(topGroup(resolved).some(candidate =>
          candidate.rootPC === expectedRoot && candidate.quality === '7' &&
          candidate.resolutionCompleteness === 'exact'
        )).toBe(true);
      }
    }
  });

  it('keeps major seventh inversions complete across every transposition and inversion', () => {
    for (let root = 0; root < 12; root++) {
      for (let inversion = 0; inversion < 4; inversion++) {
        const notes = makeInversion(60 + root, [0, 4, 7, 11], inversion);
        const resolved = padResolveChordCandidates(notes, root);
        const expectedRoot = root % 12;
        expect(topGroup(resolved).some(candidate =>
          candidate.rootPC === expectedRoot && candidate.quality === 'Maj7' &&
          candidate.resolutionCompleteness === 'exact'
        )).toBe(true);
      }
    }
  });

  it('keeps every registered exact 4+ note identity above incomplete triad subsets', () => {
    const pitchSets = registeredFourPlusNotePitchSets();
    const spellingKeys = [0, 2]; // flat-oriented and sharp-oriented spelling contexts
    const violations = [];
    let ruledCases = 0;

    for (const intervals of pitchSets) {
      for (let root = 0; root < 12; root++) {
        for (let inversion = 0; inversion < intervals.length; inversion++) {
          const notes = makeInversion(60 + root, intervals, inversion);
          for (const spellingKey of spellingKeys) {
            const resolved = padResolveChordCandidates(notes, spellingKey);
            const exactFourPlus = resolved.filter(candidate =>
              candidate.resolutionCompleteness === 'exact' &&
              candidate.resolutionChordCardinality >= 4
            );
            if (exactFourPlus.length === 0) continue;

            ruledCases++;
            const minimumExactScore = Math.min(...exactFourPlus.map(candidate => candidate.resolutionScore));
            const offendingTriads = resolved.filter(candidate =>
              candidate.resolutionChordCardinality === 3 &&
              candidate.resolutionCompleteness !== 'exact' &&
              candidate.resolutionUnexplainedPCS.length > 0 &&
              candidate.resolutionScore >= minimumExactScore
            );

            if (offendingTriads.length > 0) {
              violations.push({
                notes,
                spellingKey,
                exact: exactFourPlus.map(candidate => ({
                  name: candidate.name,
                  score: candidate.resolutionScore,
                })),
                partial: offendingTriads.map(candidate => ({
                  name: candidate.name,
                  score: candidate.resolutionScore,
                })),
              });
            }
          }
        }
      }
    }

    // Keep this property test broad enough that a future DB/test wiring regression
    // cannot silently reduce it to only the named C7/E and CMaj7/E fixtures.
    expect(ruledCases).toBeGreaterThan(1000);
    expect(violations).toEqual([]);
  }, 60000);

  it('retains complete m7 and major-6 aliases', () => {
    const notes = [57, 60, 64, 67]; // A C E G = Am7 = C6
    const resolved = padResolveChordCandidates(notes);
    expect(resolved.some(candidate => candidate.rootPC === 9 && candidate.quality === 'm7' && candidate.resolutionCompleteness === 'exact')).toBe(true);
    expect(resolved.some(candidate => candidate.rootPC === 0 && candidate.quality === '6' && candidate.resolutionCompleteness === 'exact')).toBe(true);
  });

  it('retains half-diminished and minor-6 aliases', () => {
    const notes = [59, 62, 65, 69]; // B D F A = Bm7(b5) = Dm6
    const resolved = padResolveChordCandidates(notes);
    expect(resolved.some(candidate => candidate.rootPC === 11 && candidate.quality === 'm7(b5)' && candidate.resolutionCompleteness === 'exact')).toBe(true);
    expect(resolved.some(candidate => candidate.rootPC === 2 && candidate.quality === 'm6' && candidate.resolutionCompleteness === 'exact')).toBe(true);
  });

  it('retains Dm(b6) below the complete BbMaj7/D reading', () => {
    const notes = [62, 65, 69, 70]; // D F A Bb
    const resolved = padResolveChordCandidates(notes, 10);
    expect(resolved[0].name).toBe('BbMaj7 / D');
    const lower = resolved.find(candidate => candidate.name === 'Dm(b6)');
    expect(lower).toBeDefined();
    expect(lower.isTopRanked).toBe(false);
    expect(lower.resolutionSubsetPenalty).toBe(200);
  });

  it('marks equal-score exact alternatives as one tied top group', () => {
    const notes = [60, 64, 67, 69];
    const fake = [
      { name: 'C6', rootPC: 0, score: 120, quality: '6', chordPCS: [0, 4, 7, 9] },
      { name: 'Am7 / C', rootPC: 9, score: 120, quality: 'm7', chordPCS: [0, 3, 7, 10] },
      { name: 'Cdim', rootPC: 0, score: 125, quality: 'dim', chordPCS: [0, 3, 6] },
    ];
    const resolved = padResolveChordCandidateList(notes, fake);
    expect(resolved).toHaveLength(2);
    expect(resolved.every(candidate => candidate.isTopRanked)).toBe(true);
    expect(resolved.every(candidate => candidate.topGroupSize === 2)).toBe(true);
    expect(resolved.every(candidate => candidate.resolutionRankGroup === 1)).toBe(true);
  });

  it('keeps raw detector observation transparency separate from resolution policy', () => {
    const notes = [64, 67, 70, 72];
    const raw = padDetectChord(notes);
    const edim = raw.find(candidate => candidate.name === 'Edim');
    expect(edim).toBeDefined();
    expect(edim.observedPCS).toEqual([0, 4, 7, 10]);

    const resolved = padResolveChordCandidateList(notes, raw);
    expect(resolved.some(candidate => candidate.name === 'Edim')).toBe(false);
    expect(resolved[0].observedPCS).toEqual([0, 4, 7, 10]);
  });
});
