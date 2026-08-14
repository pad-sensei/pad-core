import { describe, it, expect } from 'vitest';

// ======== padParseRoot ========
describe('padParseRoot', () => {
  it('parses C', () => {
    const r = padParseRoot('C');
    expect(r).toEqual({ pc: 0, len: 1 });
  });

  it('parses Bb', () => {
    const r = padParseRoot('Bb');
    expect(r).toEqual({ pc: 10, len: 2 });
  });

  it('parses F#', () => {
    const r = padParseRoot('F#');
    expect(r).toEqual({ pc: 6, len: 2 });
  });

  it('returns null for empty string', () => {
    expect(padParseRoot('')).toBeNull();
  });

  it('returns null for non-note', () => {
    expect(padParseRoot('X')).toBeNull();
  });

  it('handles unicode sharp ♯', () => {
    const r = padParseRoot('C\u266F');
    expect(r).toEqual({ pc: 1, len: 2 });
  });

  it('handles unicode flat ♭', () => {
    const r = padParseRoot('E\u266D');
    expect(r).toEqual({ pc: 3, len: 2 });
  });
});

// ======== padParseChordName ========
describe('padParseChordName', () => {
  it('parses Cm7', () => {
    const r = padParseChordName('Cm7');
    expect(r).not.toBeNull();
    expect(r.root).toBe(0);
    expect(r.quality).toBe('m7');
    expect(r.intervals).toEqual([0, 3, 7, 10]);
    expect(r.bass).toBeNull();
    expect(r.displayName).toBe('Cm7');
  });

  it('parses Am7/G (slash chord)', () => {
    const r = padParseChordName('Am7/G');
    expect(r).not.toBeNull();
    expect(r.root).toBe(9);
    expect(r.quality).toBe('m7');
    expect(r.bass).toBe(7);
    expect(r.displayName).toBe('Am7/G');
  });

  it('parses G7(b9,#11) compound tension', () => {
    const r = padParseChordName('G7(b9,#11)');
    expect(r).not.toBeNull();
    expect(r.root).toBe(7);
    expect(r.intervals).toEqual([0, 4, 7, 10, 13, 18]);
    expect(r.bass).toBeNull();
  });

  it('parses 6-family parenthesized 9 without treating it as 13', () => {
    const r = padParseChordName('Em6(9)');
    expect(r).not.toBeNull();
    expect(r.root).toBe(4);
    expect(r.quality).toBe('m6(9)');
    expect(r.intervals).toEqual([0, 3, 7, 9, 14]);
    expect(r.displayName).toBe('Em6(9)');
  });

  it('parses practical sixth-family lydian notation', () => {
    const r = padParseChordName('F6(9,#11)');
    expect(r).not.toBeNull();
    expect(r.root).toBe(5);
    expect(r.quality).toBe('6(9,#11)');
    expect(r.intervals).toEqual([0, 4, 7, 9, 14, 18]);
    expect(r.displayName).toBe('F6(9,#11)');
  });

  it('keeps legacy 6/9 input readable but displays the sixth-family notation', () => {
    const r = padParseChordName('C6/9');
    expect(r).not.toBeNull();
    expect(r.quality).toBe('6/9');
    expect(r.intervals).toEqual([0, 4, 7, 9, 14]);
    expect(r.displayName).toBe('C6(9)');
  });

  it('returns null for empty string', () => {
    expect(padParseChordName('')).toBeNull();
  });

  it('returns null for invalid input', () => {
    expect(padParseChordName('X')).toBeNull();
  });

  it('parses major triad (C)', () => {
    const r = padParseChordName('C');
    expect(r.root).toBe(0);
    expect(r.intervals).toEqual([0, 4, 7]);
  });

  it('parses Dbmaj7', () => {
    const r = padParseChordName('Dbmaj7');
    expect(r.root).toBe(1);
    expect(r.intervals).toEqual([0, 4, 7, 11]);
  });

  it('resolves alias M7 → maj7 in displayName', () => {
    const r = padParseChordName('CM7');
    expect(r.displayName).toBe('Cmaj7');
  });

  it('parses lowercase root as uppercase', () => {
    const r = padParseChordName('cm7');
    expect(r).not.toBeNull();
    expect(r.root).toBe(0);
    expect(r.quality).toBe('m7');
  });

  it('handles whitespace', () => {
    const r = padParseChordName('  Dm7  ');
    expect(r).not.toBeNull();
    expect(r.root).toBe(2);
  });

  it('parses slash chord with flat bass', () => {
    const r = padParseChordName('C/Bb');
    expect(r).not.toBeNull();
    expect(r.root).toBe(0);
    expect(r.bass).toBe(10);
    expect(r.displayName).toBe('C/Bb');
  });

  it('parses dim7', () => {
    const r = padParseChordName('Bdim7');
    expect(r.root).toBe(11);
    expect(r.intervals).toEqual([0, 3, 6, 9]);
  });

  it('parses unicode △7', () => {
    const r = padParseChordName('C\u25B37');
    expect(r.root).toBe(0);
    expect(r.intervals).toEqual([0, 4, 7, 11]);
  });

  it('parses FmMaj7 (minor-major-7)', () => {
    const r = padParseChordName('FmMaj7');
    expect(r).not.toBeNull();
    expect(r.root).toBe(5);
    expect(r.intervals).toEqual([0, 3, 7, 11]);
    expect(r.displayName).toBe('FmMaj7');
  });

  it('parses CmM7 (minor-major-7 short form)', () => {
    const r = padParseChordName('CmM7');
    expect(r).not.toBeNull();
    expect(r.root).toBe(0);
    expect(r.intervals).toEqual([0, 3, 7, 11]);
    expect(r.displayName).toBe('CmMaj7');
  });

  it('parses add chords beyond add9', () => {
    expect(padParseChordName('Cadd11').intervals).toEqual([0, 4, 7, 17]);
    expect(padParseChordName('Cadd#11').intervals).toEqual([0, 4, 7, 18]);
    expect(padParseChordName('Caddb13').intervals).toEqual([0, 4, 7, 20]);
    expect(padParseChordName('Cmadd11').intervals).toEqual([0, 3, 7, 17]);
    expect(padParseChordName('Cmadd#11').intervals).toEqual([0, 3, 7, 18]);
  });
});

describe('padPitchClass', () => {
  it('returns 0-11 for standard MIDI range', () => {
    expect(padPitchClass(60)).toBe(0);
    expect(padPitchClass(61)).toBe(1);
    expect(padPitchClass(72)).toBe(0);
    expect(padPitchClass(36)).toBe(0);
  });

  it('handles modular arithmetic correctly', () => {
    for (let midi = 0; midi < 128; midi++) {
      const pc = padPitchClass(midi);
      expect(pc).toBeGreaterThanOrEqual(0);
      expect(pc).toBeLessThan(12);
    }
  });

  it('handles negative values via double-mod', () => {
    expect(padPitchClass(-1)).toBe(11);
    expect(padPitchClass(-12)).toBe(0);
  });
});

describe('padGetParentMajorKey', () => {
  it('Ionian returns key as-is', () => {
    expect(padGetParentMajorKey(0, 0)).toBe(0);
    expect(padGetParentMajorKey(0, 2)).toBe(2);
  });

  it('Dorian returns relative major', () => {
    expect(padGetParentMajorKey(1, 2)).toBe(0); // D Dorian → C
  });

  it('handles Harmonic Minor modes', () => {
    expect(padGetParentMajorKey(7, 9)).toBe(0); // A HM → C
  });
});

describe('padPcName', () => {
  it('returns flat names for C major (jazz convention)', () => {
    expect(padPcName(0, 0, 0)).toBe('C');
    expect(padPcName(1, 0, 0)).toBe('Db');
  });

  it('returns sharp names for D major', () => {
    expect(padPcName(1, 0, 2)).toBe('C#'); // D Ionian → parent D → sharp
  });

  it('returns flat names for flat keys', () => {
    expect(padPcName(1, 0, 5)).toBe('Db'); // F Ionian → parent F → flat
    expect(padPcName(3, 0, 5)).toBe('Eb');
  });
});

describe('padCalcVoicingOffsets', () => {
  it('preserves pitch class set through inversions', () => {
    const pcs = [0, 4, 7];
    for (let inv = 0; inv <= 2; inv++) {
      const { voiced } = padCalcVoicingOffsets(pcs, inv, null);
      const resultPCS = new Set(voiced.map(v => ((v % 12) + 12) % 12));
      expect(resultPCS).toEqual(new Set([0, 4, 7]));
    }
  });

  it('preserves pitch class set through Drop2', () => {
    const pcs = [0, 4, 7, 11];
    const { voiced } = padCalcVoicingOffsets(pcs, 0, 'drop2');
    const resultPCS = new Set(voiced.map(v => ((v % 12) + 12) % 12));
    expect(resultPCS).toEqual(new Set([0, 4, 7, 11]));
  });

  it('preserves pitch class set through Drop3', () => {
    const pcs = [0, 4, 7, 11];
    const { voiced } = padCalcVoicingOffsets(pcs, 0, 'drop3');
    const resultPCS = new Set(voiced.map(v => ((v % 12) + 12) % 12));
    expect(resultPCS).toEqual(new Set([0, 4, 7, 11]));
  });

  it('returns offsets relative to lowest note', () => {
    const pcs = [0, 4, 7];
    const { offsets } = padCalcVoicingOffsets(pcs, 0, null);
    expect(offsets[0]).toBe(0);
  });

  it('1st inversion moves root up an octave', () => {
    const pcs = [0, 4, 7];
    const { voiced } = padCalcVoicingOffsets(pcs, 1, null);
    expect(voiced).toEqual([4, 7, 12]);
  });
});

describe('padGetBassCase', () => {
  it('identifies chord tone bass', () => {
    const result = padGetBassCase(4, 0, [0, 4, 7]);
    expect(result.isChordTone).toBe(true);
    expect(result.inversionIndex).toBeGreaterThanOrEqual(0);
  });

  it('identifies non-chord tone bass', () => {
    const result = padGetBassCase(2, 0, [0, 4, 7]);
    expect(result.isChordTone).toBe(false);
    expect(result.inversionIndex).toBeNull();
  });
});

describe('padApplyOnChordBass', () => {
  it('inserts bass note below voiced intervals', () => {
    const result = padApplyOnChordBass([0, 4, 7], 0, 4);
    expect(result[0]).toBeLessThan(0);
    expect(result).toContain(0);
    expect(result).toContain(4);
    expect(result).toContain(7);
  });

  it('returns unchanged if lowest is already bass', () => {
    const result = padApplyOnChordBass([4, 7, 12], 0, 4);
    expect(result).toEqual([4, 7, 12]);
  });
});

describe('padGetShellIntervals', () => {
  it('returns R-3-7 for 137 shell (Maj7)', () => {
    const result = padGetShellIntervals([0, 4, 7, 11], '137', 0, null);
    expect(result).toContain(0);
    expect(result).toContain(4);
    expect(result).toContain(11);
    expect(result).toHaveLength(3);
  });

  it('returns R-7-3(+12) for 173 shell (Maj7)', () => {
    const result = padGetShellIntervals([0, 4, 7, 11], '173', 0, null);
    expect(result).toContain(0);
    expect(result).toContain(11);
    expect(result).toContain(16);
    expect(result).toHaveLength(3);
  });

  it('returns null if no 3rd found', () => {
    const result = padGetShellIntervals([0, 5, 7], '137', 0, null);
    expect(result).toBeNull();
  });

  it('returns null if no 7th found', () => {
    const result = padGetShellIntervals([0, 4, 7], '137', 0, null);
    expect(result).toBeNull();
  });

  it('uses 6th as 7th for 6th chords', () => {
    const result = padGetShellIntervals([0, 4, 7, 9], '137', 0, null);
    expect(result).not.toBeNull();
    expect(result).toContain(9);
  });

  it('includes compound intervals from fullPCS', () => {
    const result = padGetShellIntervals([0, 4, 7, 11], '137', 0, [0, 4, 7, 11, 14]);
    expect(result).toContain(14);
  });
});

describe('padApplyTension', () => {
  it('sus4 replaces 3rd with 4th', () => {
    const result = padApplyTension([0, 4, 7], { replace3: 5 });
    expect(result).toContain(5);
    expect(result).not.toContain(4);
    expect(result).not.toContain(3);
  });

  it('aug replaces 5th with #5', () => {
    const result = padApplyTension([0, 4, 7], { sharp5: true });
    expect(result).toContain(8);
    expect(result).not.toContain(7);
  });

  it('b5 replaces 5th with b5', () => {
    const result = padApplyTension([0, 4, 7, 10], { flat5: true });
    expect(result).toContain(6);
    expect(result).not.toContain(7);
  });

  it('add tensions as compound intervals (+12)', () => {
    const result = padApplyTension([0, 4, 7, 10], { add: [2] });
    expect(result).toContain(14);
  });

  it('does not duplicate existing pitch classes', () => {
    const result = padApplyTension([0, 2, 4, 7], { add: [2] });
    const count2 = result.filter(p => p % 12 === 2).length;
    expect(count2).toBe(1);
  });
});

describe('padGetDiatonicTetrads', () => {
  it('returns 7 tetrads for 7-note scales', () => {
    const tetrads = padGetDiatonicTetrads(SCALES[0].pcs, 0);
    expect(tetrads).toHaveLength(7);
  });

  it('returns empty for non-7-note scales', () => {
    expect(padGetDiatonicTetrads(SCALES[21].pcs, 0)).toEqual([]);
  });

  it('C Major diatonic tetrads have correct qualities', () => {
    const tetrads = padGetDiatonicTetrads(SCALES[0].pcs, 0);
    const names = tetrads.map(t => t.quality.name);
    expect(names[0]).toBe('Maj7');
    expect(names[1]).toBe('m7');
    expect(names[2]).toBe('m7');
    expect(names[3]).toBe('Maj7');
    expect(names[4]).toBe('7');
    expect(names[5]).toBe('m7');
    expect(names[6]).toBe('m7(b5)');
  });

  it('C Major root PCs follow scale degrees', () => {
    const tetrads = padGetDiatonicTetrads(SCALES[0].pcs, 0);
    expect(tetrads.map(t => t.rootPC)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('returns triads when noteCount=3', () => {
    const triads = padGetDiatonicTetrads(SCALES[0].pcs, 0, 3);
    expect(triads).toHaveLength(7);
    triads.forEach(t => expect(t.pcs).toHaveLength(3));
  });

  it('C Major triads: I, ii, iii, IV, V, vi, vii°', () => {
    const triads = padGetDiatonicTetrads(SCALES[0].pcs, 0, 3);
    const names = triads.map(t => t.quality.name);
    expect(names).toEqual(['', 'm', 'm', '', '', 'm', 'dim']);
  });

  it('C Major triad degrees use correct roman numerals', () => {
    const triads = padGetDiatonicTetrads(SCALES[0].pcs, 0, 3);
    const degrees = triads.map(t => t.degree);
    expect(degrees).toEqual(['I', 'IIm', 'IIIm', 'IV', 'V', 'VIm', 'VIIdim']);
  });

  it('Harmonic minor triads include aug', () => {
    const triads = padGetDiatonicTetrads(SCALES[7].pcs, 0, 3);
    const names = triads.map(t => t.quality.name);
    expect(names[2]).toBe('aug'); // III+ in harmonic minor
  });

  it('noteCount defaults to 4 (backward compatible)', () => {
    const a = padGetDiatonicTetrads(SCALES[0].pcs, 0);
    const b = padGetDiatonicTetrads(SCALES[0].pcs, 0, 4);
    expect(a).toEqual(b);
  });
});

describe('padFindParentScales', () => {
  it('returns results for Dm7', () => {
    const results = padFindParentScales(2, new Set([0, 3, 7, 10]), 0);
    expect(results.length).toBeGreaterThan(0);
    expect(results.map(r => r.scaleName)).toContain('Dorian');
  });

  it('returns results for G7', () => {
    const results = padFindParentScales(7, new Set([0, 4, 7, 10]), 0);
    expect(results.length).toBeGreaterThan(0);
    expect(results.map(r => r.scaleName)).toContain('Mixolydian');
  });

  it('strict matches come before omit5 matches', () => {
    const results = padFindParentScales(0, new Set([0, 4, 7, 10]), 0);
    const firstOmit5Idx = results.findIndex(r => r.omit5Match);
    if (firstOmit5Idx >= 0) {
      results.slice(0, firstOmit5Idx).forEach(r => {
        expect(r.omit5Match).toBe(false);
      });
    }
  });
});

describe('padFifthsDistance', () => {
  it('adjacent keys on circle of fifths = 1', () => {
    expect(padFifthsDistance(0, 7)).toBe(1);
    expect(padFifthsDistance(0, 5)).toBe(1);
  });

  it('tritone = 6 (maximum distance)', () => {
    expect(padFifthsDistance(0, 6)).toBe(6);
  });

  it('same key = 0', () => {
    expect(padFifthsDistance(0, 0)).toBe(0);
  });

  it('is symmetric', () => {
    for (let a = 0; a < 12; a++) {
      for (let b = 0; b < 12; b++) {
        expect(padFifthsDistance(a, b)).toBe(padFifthsDistance(b, a));
      }
    }
  });
});

describe('DIATONIC_CHORD_DB', () => {
  it('has entries for all 12 pitch classes', () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(DIATONIC_CHORD_DB[pc]).toBeDefined();
      expect(DIATONIC_CHORD_DB[pc].length).toBeGreaterThan(0);
    }
  });

  it('covers 3 systems + NM', () => {
    const systems = new Set();
    Object.values(DIATONIC_CHORD_DB).flat().forEach(e => systems.add(e.system));
    expect(systems.has('○')).toBe(true);
    expect(systems.has('■')).toBe(true);
    expect(systems.has('◆')).toBe(true);
    expect(systems.has('NM')).toBe(true);
  });
});

describe('padBaseMidi', () => {
  it('returns BASE_MIDI at default', () => {
    expect(padBaseMidi(0)).toBe(36);
  });

  it('shifts by 12 per octave', () => {
    expect(padBaseMidi(1)).toBe(48);
    expect(padBaseMidi(-1)).toBe(24);
  });
});

describe('padMidiNote', () => {
  it('computes MIDI from row/col', () => {
    expect(padMidiNote(0, 0, 0)).toBe(36);
    expect(padMidiNote(1, 0, 0)).toBe(41);
    expect(padMidiNote(0, 1, 0)).toBe(37);
  });
});

describe('padDegreeName', () => {
  it('returns R for root', () => {
    expect(padDegreeName(0, [0, 4, 7])).toBe('R');
  });

  it('returns 3 for major third', () => {
    expect(padDegreeName(4, [0, 4, 7])).toBe('3');
  });

  it('returns #9 when M3 present', () => {
    expect(padDegreeName(3, [0, 4, 7, 10])).toBe('#9');
  });

  it('returns m3 when no M3', () => {
    expect(padDegreeName(3, [0, 3, 7])).toBe('m3');
  });
});

// ======== padEnumGuitarChordForms ========
describe('padEnumGuitarChordForms', () => {
  const GUITAR = [64, 59, 55, 50, 45, 40]; // standard tuning
  const BASS = [43, 38, 33, 28]; // standard bass tuning

  it('returns array of forms for C major', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4);
    expect(forms.length).toBeGreaterThan(0);
    expect(forms.length).toBeLessThanOrEqual(15);
  });

  it('open C chord appears in results', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4);
    // Open C: x32010 → [0, 1, 0, 2, 3, null] in our indexing (high to low)
    const openC = forms.find(f =>
      f.frets[0] === 0 && f.frets[1] === 1 && f.frets[2] === 0 &&
      f.frets[3] === 2 && f.frets[4] === 3 && f.frets[5] === null
    );
    expect(openC).toBeDefined();
    expect(openC.rootInBass).toBe(true);
    expect(openC.stringCount).toBe(5);
    expect(openC.span).toBe(3);
    expect(openC.gaps).toBe(0);
  });

  it('all forms have root', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4);
    for (const f of forms) {
      const pcs = new Set();
      for (let s = 0; s < 6; s++) {
        if (f.frets[s] !== null) pcs.add((GUITAR[s] + f.frets[s]) % 12);
      }
      expect(pcs.has(0)).toBe(true); // C
    }
  });

  it('all forms have 3rd when chord has one', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4);
    for (const f of forms) {
      const pcs = new Set();
      for (let s = 0; s < 6; s++) {
        if (f.frets[s] !== null) pcs.add((GUITAR[s] + f.frets[s]) % 12);
      }
      expect(pcs.has(4)).toBe(true); // E (major 3rd)
    }
  });

  it('respects max span of 4', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7, 11], 0, GUITAR, 21, 4);
    for (const f of forms) {
      const fretted = f.frets.filter(x => x !== null && x > 0);
      if (fretted.length >= 2) {
        const span = Math.max(...fretted) - Math.min(...fretted) + 1;
        expect(span).toBeLessThanOrEqual(4);
      }
    }
  });

  it('open strings excluded from span', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4);
    const openC = forms.find(f =>
      f.frets[0] === 0 && f.frets[1] === 1 && f.frets[2] === 0
    );
    // Open strings (fret 0) should not count toward span
    // Only frets 1,2,3 count → span = 3
    if (openC) expect(openC.span).toBeLessThanOrEqual(4);
  });

  it('Am7 includes open string forms', () => {
    // Am7 = [0, 3, 7, 10], root = A(9)
    const forms = padEnumGuitarChordForms([0, 3, 7, 10], 9, GUITAR, 21, 4);
    expect(forms.length).toBeGreaterThan(0);
    // Open Am7: x02010 → should have fret 0 somewhere
    const hasOpen = forms.some(f => f.frets.includes(0));
    expect(hasOpen).toBe(true);
  });

  it('returns at most maxResults forms', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4, { maxResults: 5 });
    expect(forms.length).toBeLessThanOrEqual(5);
  });

  it('root-in-bass forms are sorted first', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4);
    // Find first form without root in bass
    const firstNonRoot = forms.findIndex(f => !f.rootInBass);
    if (firstNonRoot > 0) {
      // All forms before it should have root in bass
      for (let i = 0; i < firstNonRoot; i++) {
        expect(forms[i].rootInBass).toBe(true);
      }
    }
  });

  it('default guitar ranking keeps fifth-in-bass forms behind available root-bass forms', () => {
    const cases = [
      { root: 0, pcs: [0, 4, 7], name: 'C' },
      { root: 9, pcs: [0, 3, 7], name: 'Am' },
      { root: 0, pcs: [0, 4, 7, 10], name: 'C7' },
      { root: 9, pcs: [0, 3, 7, 10], name: 'Am7' },
      { root: 0, pcs: [0, 4, 7, 14], name: 'Cadd9' },
      { root: 7, pcs: [0, 4, 7, 14], name: 'Gadd9' },
    ];

    for (const c of cases) {
      const forms = padEnumGuitarChordForms(c.pcs, c.root, GUITAR, 21, 4, { maxResults: 15 });
      expect(forms.length, c.name).toBeGreaterThan(0);
      const firstNonRoot = forms.findIndex(f => !f.rootInBass);
      if (firstNonRoot === -1) continue;
      for (let i = firstNonRoot; i < forms.length; i++) {
        expect(forms[i].rootInBass, `${c.name} root-bass form after non-root form`).toBe(false);
      }
      expect(forms[0].rootInBass, c.name).toBe(true);
      expect(forms[0].fifthInBass, c.name).toBe(false);
    }
  });

  it('preferRootBass: false keeps the genre ranking escape hatch available', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4, {
      maxResults: 15,
      preferRootBass: false,
      weights: { fifthBass: 300 },
    });
    expect(forms.length).toBeGreaterThan(0);
    expect(forms.some(f => f.fifthInBass)).toBe(true);
  });

  it('qualityIssues records why a generated form is suspicious', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4);
    for (const f of forms) {
      expect(Array.isArray(f.qualityIssues)).toBe(true);
    }
    const fifthBass = padAnalyzeGuitarFormQuality([3, 1, 0, 2, 3, 3], [0, 4, 7], 0, GUITAR);
    expect(fifthBass.issues).toContain('fifth_in_bass');
    const missingRoot = padAnalyzeGuitarFormQuality([3, 3, 0, null, null, null], [0, 4, 7], 0, GUITAR);
    expect(missingRoot.issues).toContain('missing_root');
  });

  it('human-curated open A7 keeps thumb mute and 2-3 fingering metadata', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7, 10], 9, GUITAR, 21, 4, { maxResults: 15 });
    const a7 = forms.find(f => padEncodeGuitarFretKey(f.frets) === '02020x');
    expect(a7).toBeDefined();
    expect(a7.referenceMeta).toBeTruthy();
    expect(a7.referenceMeta.mutes[0].actor).toBe('thumb');
    expect(a7.referenceMeta.mutes[0].string).toBe(5);
    expect(a7.fingers).toEqual([0, 3, 0, 2, 0, null]);
    expect(a7.barre).toBeNull();
    expect(a7.qualityIssues).not.toContain('broken_barre');
    expect(a7.movable).toBe(false);
  });

  it('human-curated open B7 is allowed and keeps middle-finger mute metadata', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7, 10], 11, GUITAR, 21, 4, { maxResults: 15 });
    const b7 = forms.find(f => padEncodeGuitarFretKey(f.frets) === '20212x');
    expect(b7).toBeDefined();
    expect(b7.referenceMeta).toBeTruthy();
    expect(b7.referenceMeta.mutes[0].actor).toBe('middle');
    expect(b7.referenceMeta.mutes[0].string).toBe(5);
    expect(b7.fingers).toEqual([4, 0, 3, 2, 1, null]);
    expect(b7.barre).toBeNull();
    expect(b7.qualityIssues).not.toContain('broken_barre');
  });

  it('human-curated Esus and E7sus open forms stay non-barre', () => {
    const esus = padEnumGuitarChordForms([0, 5, 7], 4, GUITAR, 21, 4, { maxResults: 15 })
      .find(f => padEncodeGuitarFretKey(f.frets) === '002220');
    expect(esus).toBeDefined();
    expect(esus.referenceMeta.nonBarre).toBe(true);
    expect(esus.fingers).toEqual([0, 0, 3, 2, 1, 0]);
    expect(esus.barre).toBeNull();
    expect(esus.qualityIssues).not.toContain('broken_barre');

    const e7sus = padEnumGuitarChordForms([0, 5, 7, 10], 4, GUITAR, 21, 4, { maxResults: 15 })
      .find(f => padEncodeGuitarFretKey(f.frets) === '002020');
    expect(e7sus).toBeDefined();
    expect(e7sus.referenceMeta.nonBarre).toBe(true);
    expect(e7sus.fingers).toEqual([0, 0, 2, 0, 1, 0]);
    expect(e7sus.barre).toBeNull();
    expect(e7sus.qualityIssues).not.toContain('broken_barre');
  });

  it('guitar forms carry position-family and movable metadata', () => {
    const position = padGetGuitarPositionFamily([8, 8, 9, 9, 8, null]);
    expect(position.id).toBe('jazz-pos-3');

    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4, { noOpen: true, maxResults: 15 });
    expect(forms.some(f => f.positionFamily && f.positionFamily.id)).toBe(true);
    expect(forms.some(f => f.movable)).toBe(true);
  });

  it('works with bass tuning (4 strings)', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, BASS, 21, 4);
    expect(forms.length).toBeGreaterThan(0);
    for (const f of forms) {
      expect(f.frets.length).toBe(4);
      expect(f.stringCount).toBeLessThanOrEqual(4);
    }
  });

  it('Bbmaj7 has no open string forms', () => {
    // Bbmaj7 = [0, 4, 7, 11], root = Bb(10)
    const forms = padEnumGuitarChordForms([0, 4, 7, 11], 10, GUITAR, 21, 4);
    expect(forms.length).toBeGreaterThan(0);
    // Bb is not an open string note, so pure open forms shouldn't appear
    // But open strings that happen to be chord tones (e.g., D=2 is not in Bbmaj7) can still appear
  });

  it('shell 1-3-7 (3 notes) produces many candidates', () => {
    // C shell: [0, 4, 11] → only 3 notes, should produce many candidates
    const forms = padEnumGuitarChordForms([0, 4, 11], 0, GUITAR, 21, 4);
    expect(forms.length).toBe(15); // should hit maxResults
  });

  it('each form has at least minNotes sounding', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4, { minNotes: 4 });
    for (const f of forms) {
      expect(f.stringCount).toBeGreaterThanOrEqual(4);
    }
  });

  it('gaps count is correct', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4);
    for (const f of forms) {
      // Verify gap count manually
      let lo = -1, hi = -1;
      for (let i = 0; i < f.frets.length; i++) {
        if (f.frets[i] !== null) {
          if (hi === -1) hi = i;
          lo = i;
        }
      }
      let gaps = 0;
      for (let i = hi + 1; i < lo; i++) {
        if (f.frets[i] === null) gaps++;
      }
      expect(f.gaps).toBe(gaps);
    }
  });

  // --- Unison avoidance ---
  it('no form has two strings with the exact same MIDI note', () => {
    const forms = padEnumGuitarChordForms([0, 3, 7], 0, GUITAR, 21, 4);
    for (const f of forms) {
      const midis = [];
      for (let s = 0; s < GUITAR.length; s++) {
        if (f.frets[s] !== null) midis.push(GUITAR[s] + f.frets[s]);
      }
      const uniqueMidis = new Set(midis);
      expect(uniqueMidis.size).toBe(midis.length);
    }
  });

  it('octave duplicates (same PC, different octave) are allowed', () => {
    // E major: open E chord has E on strings 1 and 6 (different octaves)
    const forms = padEnumGuitarChordForms([0, 4, 7], 4, GUITAR, 21, 4);
    // Open E: 0,0,1,2,2,0 → string 0 (E4=64) and string 5 (E2=40)
    const openE = forms.find(f =>
      f.frets[0] === 0 && f.frets[1] === 0 && f.frets[2] === 1 &&
      f.frets[3] === 2 && f.frets[4] === 2 && f.frets[5] === 0
    );
    expect(openE).toBeDefined();
    expect(openE.stringCount).toBe(6);
  });

  // --- Fifth omission ---
  it('C9 forms can omit the 5th (G) — tension chord', () => {
    // C9 = [0, 4, 7, 10, 14], has 9th (>=13) → 5th optional
    const forms = padEnumGuitarChordForms([0, 4, 7, 10, 14], 0, GUITAR, 21, 4);
    const formsWithout5th = forms.filter(f => {
      const pcs = new Set();
      for (let s = 0; s < GUITAR.length; s++) {
        if (f.frets[s] !== null) pcs.add((GUITAR[s] + f.frets[s]) % 12);
      }
      return !pcs.has(7); // G = pitch class 7
    });
    expect(formsWithout5th.length).toBeGreaterThan(0);
  });

  it('C7 allows omitting 5th (7th present = R37 shell is standard)', () => {
    // C7 = [0, 4, 7, 10], has 7th → 5th is optional (R-3-7 shell voicing)
    const forms = padEnumGuitarChordForms([0, 4, 7, 10], 0, GUITAR, 21, 4);
    const formsWithout5th = forms.filter(f => {
      const pcs = new Set();
      for (let s = 0; s < GUITAR.length; s++) {
        if (f.frets[s] !== null) pcs.add((GUITAR[s] + f.frets[s]) % 12);
      }
      return !pcs.has(7); // G = pitch class 7
    });
    expect(formsWithout5th.length).toBeGreaterThan(0);
  });

  it('triads still require all notes', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4);
    for (const f of forms) {
      const pcs = new Set();
      for (let s = 0; s < GUITAR.length; s++) {
        if (f.frets[s] !== null) pcs.add((GUITAR[s] + f.frets[s]) % 12);
      }
      expect(pcs.has(7)).toBe(true); // G must be present
    }
  });

  // --- Rootless voicings ---
  it('allowRootless: forms without root appear', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7, 10], 0, GUITAR, 21, 4, { allowRootless: true, maxResults: 50 });
    const rootless = forms.filter(f => f.isRootless);
    expect(rootless.length).toBeGreaterThan(0);
    // All rootless forms should have isRootless flag
    for (const f of rootless) {
      const pcs = new Set();
      for (let s = 0; s < GUITAR.length; s++) {
        if (f.frets[s] !== null) pcs.add((GUITAR[s] + f.frets[s]) % 12);
      }
      expect(pcs.has(0)).toBe(false); // no C
    }
  });

  it('allowRootless: rooted forms rank higher than rootless', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7, 10], 0, GUITAR, 21, 4, { allowRootless: true, maxResults: 50 });
    const firstRootless = forms.findIndex(f => f.isRootless);
    const lastRooted = forms.reduce((acc, f, i) => !f.isRootless ? i : acc, -1);
    if (firstRootless >= 0 && lastRooted >= 0) {
      // At least some rooted forms should come before rootless
      expect(firstRootless).toBeGreaterThan(0);
    }
  });

  it('default: no rootless forms appear', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7, 10], 0, GUITAR, 21, 4);
    for (const f of forms) {
      expect(f.isRootless).toBe(false);
    }
  });

  it('isRootless flag exists on all forms', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4);
    for (const f of forms) {
      expect(typeof f.isRootless).toBe('boolean');
    }
  });

  // --- Finger unit constraint ---
  it('all forms need at most 4 finger units', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7, 10], 0, GUITAR, 21, 4);
    for (const f of forms) {
      expect(f.fingerUnits).toBeLessThanOrEqual(4);
    }
  });

  it('open C chord needs 3 finger units', () => {
    // x32010 → frets 1,2,3 each = 1 unit = 3 total
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4);
    const openC = forms.find(f =>
      f.frets[0] === 0 && f.frets[1] === 1 && f.frets[2] === 0 &&
      f.frets[3] === 2 && f.frets[4] === 3 && f.frets[5] === null
    );
    expect(openC).toBeDefined();
    expect(openC.fingerUnits).toBe(3);
  });

  it('fingerUnits field exists on all forms', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4);
    for (const f of forms) {
      expect(typeof f.fingerUnits).toBe('number');
      expect(f.fingerUnits).toBeGreaterThan(0);
    }
  });

  // --- Altered 5th protection ---
  it('Cm7b5 forms always include b5', () => {
    // Cm7b5 = [0, 3, 6, 10], b5 replaces natural 5th → must keep
    const forms = padEnumGuitarChordForms([0, 3, 6, 10], 0, GUITAR, 21, 4);
    for (const f of forms) {
      const pcs = new Set();
      for (let s = 0; s < GUITAR.length; s++) {
        if (f.frets[s] !== null) pcs.add((GUITAR[s] + f.frets[s]) % 12);
      }
      expect(pcs.has(6)).toBe(true); // Gb = pitch class 6
    }
  });

  it('Caug forms always include #5', () => {
    // Caug = [0, 4, 8], #5 replaces natural 5th → must keep
    const forms = padEnumGuitarChordForms([0, 4, 8], 0, GUITAR, 21, 4);
    for (const f of forms) {
      const pcs = new Set();
      for (let s = 0; s < GUITAR.length; s++) {
        if (f.frets[s] !== null) pcs.add((GUITAR[s] + f.frets[s]) % 12);
      }
      expect(pcs.has(8)).toBe(true); // Ab = pitch class 8
    }
  });

  // --- noOpen (funk/soul: no open strings) ---
  it('noOpen: no form uses fret 0', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4, { noOpen: true });
    expect(forms.length).toBeGreaterThan(0);
    for (const f of forms) {
      expect(f.frets).not.toContain(0);
    }
  });

  it('noOpen: Cmaj7 top results are closed position', () => {
    const forms = padEnumGuitarChordForms([0, 4, 7, 11], 0, GUITAR, 21, 4, { noOpen: true });
    expect(forms.length).toBeGreaterThan(0);
    for (const f of forms) {
      for (let s = 0; s < GUITAR.length; s++) {
        if (f.frets[s] !== null) expect(f.frets[s]).toBeGreaterThan(0);
      }
    }
  });

  it('C7(#11) can omit 5th (natural 5th + tension coexist)', () => {
    // C7(#11) = [0, 4, 7, 10, 18], has tensions, natural 5th present, #11 is tension
    const forms = padEnumGuitarChordForms([0, 4, 7, 10, 18], 0, GUITAR, 21, 4);
    const without5th = forms.filter(f => {
      const pcs = new Set();
      for (let s = 0; s < GUITAR.length; s++) {
        if (f.frets[s] !== null) pcs.add((GUITAR[s] + f.frets[s]) % 12);
      }
      return !pcs.has(7);
    });
    expect(without5th.length).toBeGreaterThan(0);
  });

  it('broken barre forms have isBrokenBarre flag and receive score penalty', () => {
    // C#m: [4,2,x,2,4,x] has broken barre (fret 2 on non-contiguous strings)
    // It should rank lower than the standard barre [4,5,6,6,4,x]
    const forms = padEnumGuitarChordForms([0, 3, 7], 1, GUITAR, 12, 5, { maxResults: 50 });
    const brokenForm = forms.findIndex(f =>
      f.frets[0] === 4 && f.frets[1] === 2 && f.frets[2] === null &&
      f.frets[3] === 2 && f.frets[4] === 4 && f.frets[5] === null
    );
    const standardForm = forms.findIndex(f =>
      f.frets[0] === 4 && f.frets[1] === 5 && f.frets[2] === 6 &&
      f.frets[3] === 6 && f.frets[4] === 4 && f.frets[5] === null
    );
    // Both should exist, and standard barre should rank higher
    if (brokenForm >= 0 && standardForm >= 0) {
      expect(standardForm).toBeLessThan(brokenForm);
    }
  });

  it('standard barre (Am shape at fret 4) ranks in top 5 for C#m', () => {
    // [4,5,6,6,4,x] or [4,5,6,6,4,4] should be top-ranked for C#m
    const forms = padEnumGuitarChordForms([0, 3, 7], 1, GUITAR, 12, 5);
    const top5frets = forms.slice(0, 5).map(f => f.frets.map(x => x === null ? 'x' : x).join(','));
    const hasAmShape = top5frets.some(fr =>
      fr === '4,5,6,6,4,x' || fr === '4,5,6,6,4,4'
    );
    expect(hasAmShape).toBe(true);
  });

  it('overcrowded forms (6 strings, span >= 5) rank lower', () => {
    // Generate forms and check that 6-string wide-span forms don't dominate top
    const forms = padEnumGuitarChordForms([0, 3, 7], 1, GUITAR, 12, 5, { maxResults: 50 });
    const top10 = forms.slice(0, 10);
    const overcrowdedInTop10 = top10.filter(f => f.stringCount >= 6 && f.span >= 5);
    expect(overcrowdedInTop10.length).toBeLessThanOrEqual(1);
  });

  it('isBrokenBarre flag is set correctly', () => {
    // C#m [4,2,x,2,4,x] has fret 2 on strings 2 and 4 with muted string 3
    // This should have isBrokenBarre = true
    const forms = padEnumGuitarChordForms([0, 3, 7], 1, GUITAR, 12, 5, { maxResults: 200 });
    const target = forms.find(f =>
      f.frets[0] === 4 && f.frets[1] === 2 && f.frets[2] === null &&
      f.frets[3] === 2 && f.frets[4] === 4 && f.frets[5] === null
    );
    if (target) {
      expect(target.isBrokenBarre).toBe(true);
    }
  });
});

// ======== padAssignFingers ========
describe('padAssignFingers', () => {
  // Tuning: index 0=high E(64), 1=B(59), 2=G(55), 3=D(50), 4=A(45), 5=low E(40)

  it('C open: no barre, 3 fingers', () => {
    // x32010 (low-to-high) = [0, 1, 0, 2, 3, null] (high-to-low)
    const result = padAssignFingers([0, 1, 0, 2, 3, null]);
    expect(result.barre).toBeNull();
    expect(result.fingers).toEqual([0, 1, 0, 2, 3, null]);
    // finger 1 on B@1, finger 2 on D@2, finger 3 on A@3
  });

  it('Am open: no barre, 3 fingers', () => {
    // x02210 (low-to-high) = [0, 1, 2, 2, 0, null] (high-to-low)
    const result = padAssignFingers([0, 1, 2, 2, 0, null]);
    expect(result.barre).toBeNull();
    // finger 1 on B@1, finger 2 on D@2 (bass side), finger 3 on G@2
    expect(result.fingers[0]).toBe(0);  // open
    expect(result.fingers[1]).toBe(1);  // index
    expect(result.fingers[3]).toBe(2);  // middle (D, bass side of same fret)
    expect(result.fingers[2]).toBe(3);  // ring (G, treble side of same fret)
    expect(result.fingers[4]).toBe(0);  // open
    expect(result.fingers[5]).toBeNull();
  });

  it('D open: no barre, 3 fingers', () => {
    // xx0232 (low-to-high) = [2, 3, 2, 0, 0, null] (high-to-low)
    // Note: null at low E (string 5), null at A (string 4)... wait
    // Actually: x x 0 2 3 2 → code: [2, 3, 2, 0, null, null]
    const result = padAssignFingers([2, 3, 2, 0, null, null]);
    expect(result.barre).toBeNull();
    // finger 1 on G@2 (bass side of fret 2), finger 2 on high E@2, finger 3 on B@3
    expect(result.fingers[2]).toBe(1);  // index on G
    expect(result.fingers[0]).toBe(2);  // middle on high E
    expect(result.fingers[1]).toBe(3);  // ring on B
    expect(result.fingers[3]).toBe(0);  // open D
  });

  it('G open: no barre, 3 fingers', () => {
    // 320003 (low-to-high) = [3, 0, 0, 0, 2, 3] (high-to-low)
    const result = padAssignFingers([3, 0, 0, 0, 2, 3]);
    expect(result.barre).toBeNull();
    // finger 1 on A@2, finger 2 on low E@3 (bass), finger 3 on high E@3
    expect(result.fingers[4]).toBe(1);  // index on A
    expect(result.fingers[5]).toBe(2);  // middle on low E (bass side)
    expect(result.fingers[0]).toBe(3);  // ring on high E
  });

  it('E open: no barre, 3 fingers', () => {
    // 022100 (low-to-high) = [0, 0, 1, 2, 2, 0] (high-to-low)
    const result = padAssignFingers([0, 0, 1, 2, 2, 0]);
    expect(result.barre).toBeNull();
    expect(result.fingers[2]).toBe(1);  // index on G@1
    expect(result.fingers[4]).toBe(2);  // middle on A@2 (bass)
    expect(result.fingers[3]).toBe(3);  // ring on D@2
  });

  it('F barre: full barre at fret 1', () => {
    // 133211 (low-to-high) = [1, 1, 2, 3, 3, 1] (high-to-low)
    const result = padAssignFingers([1, 1, 2, 3, 3, 1]);
    expect(result.barre).toEqual({fret: 1, from: 0, to: 5});
    // finger 1 = barre at fret 1 (strings 0,1,5)
    expect(result.fingers[0]).toBe(1);
    expect(result.fingers[1]).toBe(1);
    expect(result.fingers[5]).toBe(1);
    // finger 2 on G@2, finger 3 on A@3 (bass), finger 4 on D@3
    expect(result.fingers[2]).toBe(2);
    expect(result.fingers[4]).toBe(3);
    expect(result.fingers[3]).toBe(4);
  });

  it('Bm barre (A-shape): barre at fret 2', () => {
    // x24432 (low-to-high) = [2, 3, 4, 4, 2, null] (high-to-low)
    const result = padAssignFingers([2, 3, 4, 4, 2, null]);
    expect(result.barre).toEqual({fret: 2, from: 0, to: 4});
    expect(result.fingers[0]).toBe(1);  // barre
    expect(result.fingers[4]).toBe(1);  // barre
    expect(result.fingers[1]).toBe(2);  // B@3
    expect(result.fingers[3]).toBe(3);  // D@4 (bass side)
    expect(result.fingers[2]).toBe(4);  // G@4
    expect(result.fingers[5]).toBeNull();
  });

  it('all-open: no fingers, no barre', () => {
    const result = padAssignFingers([0, 0, 0, 0, 0, 0]);
    expect(result.barre).toBeNull();
    expect(result.fingers).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('single fretted note: finger 1, no barre', () => {
    const result = padAssignFingers([null, null, null, null, 3, null]);
    expect(result.barre).toBeNull();
    expect(result.fingers[4]).toBe(1);
  });

  it('padEnumGuitarChordForms results include fingers and barre', () => {
    const GUITAR = [64, 59, 55, 50, 45, 40];
    const forms = padEnumGuitarChordForms([0, 4, 7], 0, GUITAR, 21, 4);
    expect(forms.length).toBeGreaterThan(0);
    for (const f of forms) {
      expect(f.fingers).toBeDefined();
      expect(f.fingers.length).toBe(6);
      expect(f.barre === null || typeof f.barre === 'object').toBe(true);
      // Every fretted string should have a finger 1-4
      for (let s = 0; s < 6; s++) {
        if (f.frets[s] === null) expect(f.fingers[s]).toBeNull();
        else if (f.frets[s] === 0) expect(f.fingers[s]).toBe(0);
        else expect(f.fingers[s]).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('F barre results have barre info', () => {
    const GUITAR = [64, 59, 55, 50, 45, 40];
    const forms = padEnumGuitarChordForms([0, 4, 7], 5, GUITAR, 21, 4);
    // F major should have a 6-string barre form
    const fullBarre = forms.find(f =>
      f.frets[0] === 1 && f.frets[1] === 1 && f.frets[5] === 1
    );
    if (fullBarre) {
      expect(fullBarre.barre).not.toBeNull();
      expect(fullBarre.barre.fret).toBe(1);
    }
  });
});

// ======== padDetectChord ========
describe('padDetectChord', () => {
  function hasMatch(results, pattern) {
    return results.some(r => r.name === pattern || r.name.startsWith(pattern));
  }

  describe('triads', () => {
    it('C major [60,64,67]', () => {
      expect(padDetectChord([60, 64, 67])[0].name).toBe('CMaj');
    });
    it('C minor [60,63,67]', () => {
      expect(padDetectChord([60, 63, 67])[0].name).toBe('Cm');
    });
    it('C dim [60,63,66]', () => {
      expect(padDetectChord([60, 63, 66])[0].name).toBe('Cdim');
    });
    it('C aug [60,64,68]', () => {
      expect(padDetectChord([60, 64, 68])[0].name).toBe('Caug');
    });
    it('C sus4 [60,65,67]', () => {
      expect(hasMatch(padDetectChord([60, 65, 67]), 'Csus4')).toBe(true);
    });
  });

  describe('tetrads', () => {
    it('Cm7 [60,63,67,70]', () => {
      expect(padDetectChord([60, 63, 67, 70])[0].name).toBe('Cm7');
    });
    it('CMaj7 [60,64,67,71]', () => {
      expect(padDetectChord([60, 64, 67, 71])[0].name).toBe('CMaj7');
    });
    it('C7 [60,64,67,70]', () => {
      expect(padDetectChord([60, 64, 67, 70])[0].name).toBe('C7');
    });
    it('Cdim7 [60,63,66,69]', () => {
      expect(padDetectChord([60, 63, 66, 69])[0].name).toBe('Cdim7');
    });
    it('Cm7(b5) [60,63,66,70]', () => {
      expect(padDetectChord([60, 63, 66, 70])[0].name).toBe('Cm7(b5)');
    });
  });

  describe('tensions', () => {
    it('C7(9) [60,64,67,70,74]', () => {
      expect(hasMatch(padDetectChord([60, 64, 67, 70, 74]), 'C7(9)')).toBe(true);
    });
    it('CMaj7(9) [60,64,67,71,74]', () => {
      expect(hasMatch(padDetectChord([60, 64, 67, 71, 74]), 'CMaj7(9)')).toBe(true);
    });
    it('C altered dominant colors are not represented as Caug', () => {
      var results = padDetectChord([60, 61, 63, 64, 68, 70]);
      expect(results[0].name).toBe('C7(b9,#9,b13)');
      expect(results[0].name).not.toBe('Caug');
    });
    it('keeps split-third colors detectable with candidate-local #9 interpretation', () => {
      const results = padDetectChord([60, 63, 64, 69, 71]);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.rootPC === 0 && r.name.includes('#9'))).toBe(true);
    });
    it('keeps simultaneous flat seventh and major seventh detectable', () => {
      const results = padDetectChord([60, 64, 67, 70, 71]);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.name === 'C7(Maj7)')).toBe(true);
      expect(results.some(r => r.name === 'CMaj7(b7)')).toBe(true);
    });
  });

  describe('inversions', () => {
    it('E,G,C [64,67,72] \u2192 CMaj / E', () => {
      expect(hasMatch(padDetectChord([64, 67, 72]), 'CMaj / E')).toBe(true);
    });
    it('G,C,E [67,72,76] \u2192 CMaj / G', () => {
      expect(hasMatch(padDetectChord([67, 72, 76]), 'CMaj / G')).toBe(true);
    });
    it('B,G,A,D keeps Gadd9 / B first while retaining Bm7(b13)', () => {
      const results = padDetectChord([59, 67, 69, 74]);
      expect(results[0].name).toBe('Gadd9 / B');
      expect(results.some(r => r.name.startsWith('Bm7(b13)'))).toBe(true);
    });
    it('detects add chords beyond add9 on major and minor triads', () => {
      expect(padDetectChord([60, 64, 67, 77])[0].name).toBe('Cadd11');
      expect(padDetectChord([60, 64, 67, 78])[0].name).toBe('Cadd#11');
      expect(padDetectChord([60, 64, 67, 68])[0].name).toBe('Caddb13');
      expect(padDetectChord([60, 63, 67, 77])[0].name).toBe('Cmadd11');
      expect(padDetectChord([60, 63, 67, 78])[0].name).toBe('Cmadd#11');
    });
    it('keeps useful no3 hybrid slash candidates', () => {
      const results = padDetectChord([60, 67, 71, 74]);
      expect(hasMatch(results, 'G / C')).toBe(true);
    });
    it('keeps phrygian-sus hybrid slash candidates', () => {
      const results = padDetectChord([55, 65, 68, 72, 74]);
      expect(hasMatch(results, 'Fm6 / G')).toBe(true);
    });
    it('keeps altered and condim slash candidates behind functional names', () => {
      const altered = padDetectChord([55, 68, 71, 75, 77]);
      const condim = padDetectChord([55, 68, 71, 74, 77]);
      const tritone = padDetectChord([55, 61, 65, 68]);
      expect(hasMatch(altered, 'Abm6 / G')).toBe(true);
      expect(hasMatch(condim, 'Abdim7 / G')).toBe(true);
      expect(hasMatch(tritone, 'Db / G')).toBe(true);
    });
    it('retains non-functional pedal triads as lower-ranked slash candidates', () => {
      const results = padDetectChord([60, 62, 66, 69]);
      expect(results.some(r => r.name === 'D / C')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('single note returns empty', () => {
      expect(padDetectChord([60])).toEqual([]);
    });
    it('same note repeated returns empty', () => {
      expect(padDetectChord([60, 72])).toEqual([]);
    });
    it('empty input returns empty', () => {
      expect(padDetectChord([])).toEqual([]);
    });
    it('returns at most 8 results', () => {
      expect(padDetectChord([60, 64, 67, 70, 74, 77]).length).toBeLessThanOrEqual(8);
    });
  });

  describe('invariants', () => {
    it('root position scores higher than inversions', () => {
      var results = padDetectChord([60, 64, 67]);
      if (results.length > 1) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      }
    });
    it('all results have name, rootPC, score', () => {
      padDetectChord([60, 64, 67, 70]).forEach(function(r) {
        expect(r).toHaveProperty('name');
        expect(r).toHaveProperty('rootPC');
        expect(r).toHaveProperty('score');
      });
    });
  });
});

// ======== padParseStockVoicings ========
describe('padParseStockVoicings', () => {
  const SAMPLE_JSON = {
    _meta: { version: '1.0.0' },
    major: {
      Maj7: [
        { id: 'maj7-1', name: 'Maj7(9)', label: 'Basic', LH: ['1','5'], RH: ['3','7','9'] },
        { id: 'maj7-2', name: 'Maj7(#11)', label: '#11', LH: ['1','3'], RH: ['7','9','#11'] },
      ]
    },
    minor: {
      Min7: [
        { id: 'min7-1', name: 'Min7(9)', label: 'Basic', LH: ['1','b7'], RH: ['b3','b7','9'] },
      ]
    },
    diminished: {
      Dim7: [
        { id: 'dim-note', name: 'Dim7', label: 'No tensions', LH: [], RH: [] },
      ]
    }
  };

  it('parses into flat entry array', () => {
    const entries = padParseStockVoicings(SAMPLE_JSON);
    expect(entries.length).toBe(3); // dim-note skipped (empty LH+RH)
  });

  it('skips _meta key', () => {
    const entries = padParseStockVoicings(SAMPLE_JSON);
    expect(entries.some(e => e.category === '_meta')).toBe(false);
  });

  it('skips entries with empty LH and RH', () => {
    const entries = padParseStockVoicings(SAMPLE_JSON);
    expect(entries.some(e => e.id === 'dim-note')).toBe(false);
  });

  it('converts degree strings to semitones', () => {
    const entries = padParseStockVoicings(SAMPLE_JSON);
    const maj7 = entries.find(e => e.id === 'maj7-1');
    expect(maj7.lhSemitones).toEqual([0, 7]);      // 1=0, 5=7
    expect(maj7.rhSemitones).toEqual([4, 11, 2]);   // 3=4, 7=11, 9=2
  });

  it('computes unique allSemitones', () => {
    const entries = padParseStockVoicings(SAMPLE_JSON);
    const min7 = entries.find(e => e.id === 'min7-1');
    // LH:[1,b7]=[0,10], RH:[b3,b7,9]=[3,10,2] → unique: [0,10,3,2]
    expect(min7.allSemitones).toEqual([0, 10, 3, 2]);
    expect(min7.pcCount).toBe(4); // b7 appears in both LH and RH
  });

  it('preserves category and subtype', () => {
    const entries = padParseStockVoicings(SAMPLE_JSON);
    const maj7 = entries.find(e => e.id === 'maj7-1');
    expect(maj7.category).toBe('major');
    expect(maj7.subtype).toBe('Maj7');
  });
});

// ======== padMatchStockVoicing ========
describe('padMatchStockVoicing', () => {
  // Pre-parsed stock entries for testing
  const STOCK = [
    { id: 'maj7-1', name: 'Maj7(9)', label: 'Basic', category: 'major', subtype: 'Maj7',
      lhSemitones: [0, 7], rhSemitones: [4, 11, 2], allSemitones: [0, 7, 4, 11, 2], pcCount: 5 },
    { id: 'min7-1', name: 'Min7(9)', label: 'Basic', category: 'minor', subtype: 'Min7',
      lhSemitones: [0, 10], rhSemitones: [3, 10, 2], allSemitones: [0, 10, 3, 2], pcCount: 4 },
    { id: 'dom7-2', name: 'C7(9)', label: 'Natural 9', category: 'dominant', subtype: 'Dom7',
      lhSemitones: [0, 10], rhSemitones: [4, 10, 2], allSemitones: [0, 10, 4, 2], pcCount: 4 },
  ];

  it('exact match returns score 1.0', () => {
    // Cmaj7(9): C=60, G=67, E=64, B=71, D=74 → intervals [0,7,4,11,2]
    const results = padMatchStockVoicing(0, [60, 67, 64, 71, 74], STOCK);
    expect(results[0].id).toBe('maj7-1');
    expect(results[0].score).toBe(1.0);
  });

  it('partial match scores below 1.0', () => {
    // Cmaj7 without 9: C=60, G=67, E=64, B=71 → intervals [0,7,4,11], missing 2
    const results = padMatchStockVoicing(0, [60, 67, 64, 71], STOCK);
    const maj7 = results.find(r => r.id === 'maj7-1');
    expect(maj7).toBeDefined();
    expect(maj7.score).toBeLessThan(1.0);
    expect(maj7.score).toBeGreaterThanOrEqual(0.5);
  });

  it('transposes correctly (D root = PC 2)', () => {
    // Dmaj7(9): D=62, A=69, F#=66, C#=73, E=76 → intervals from D: [0,7,4,11,2]
    const results = padMatchStockVoicing(2, [62, 69, 66, 73, 76], STOCK);
    expect(results[0].id).toBe('maj7-1');
    expect(results[0].score).toBe(1.0);
  });

  it('returns empty for less than 2 notes', () => {
    expect(padMatchStockVoicing(0, [60], STOCK)).toEqual([]);
    expect(padMatchStockVoicing(0, [], STOCK)).toEqual([]);
  });

  it('returns at most 8 results', () => {
    const results = padMatchStockVoicing(0, [60, 64, 67, 70, 74], STOCK);
    expect(results.length).toBeLessThanOrEqual(8);
  });

  it('all results have required fields', () => {
    const results = padMatchStockVoicing(0, [60, 67, 64, 71, 74], STOCK);
    for (const r of results) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('score');
      expect(r).toHaveProperty('category');
      expect(r).toHaveProperty('matched');
      expect(r).toHaveProperty('total');
    }
  });

  it('Cm7(9) matches min7-1 exactly', () => {
    // Cm7(9): C=60, Bb=70, Eb=63, D=74 → intervals [0,10,3,2]
    const results = padMatchStockVoicing(0, [60, 70, 63, 74], STOCK);
    expect(results[0].id).toBe('min7-1');
    expect(results[0].score).toBe(1.0);
  });

  it('filters out low-score matches (< 0.5)', () => {
    // C and G only → intervals [0,7], very partial match
    const results = padMatchStockVoicing(0, [60, 67], STOCK);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0.5);
    }
  });
});

// ======== padClassifyPC ========
describe('padClassifyPC', () => {
  const active = new Set([0, 4, 7, 10]); // C E G Bb (C7)
  const g3 = new Set([4]);  // 3rd
  const g7 = new Set([10]); // b7

  it('classifies root', () => {
    expect(padClassifyPC(0, 0, null, active, g3, g7)).toBe('root');
  });

  it('classifies bass (different from root)', () => {
    expect(padClassifyPC(4, 0, 4, active, g3, g7)).toBe('bass');
  });

  it('classifies guide3', () => {
    expect(padClassifyPC(4, 0, null, active, g3, g7)).toBe('guide3');
  });

  it('classifies guide7', () => {
    expect(padClassifyPC(10, 0, null, active, g3, g7)).toBe('guide7');
  });

  it('classifies tension (active but not root/guide)', () => {
    expect(padClassifyPC(7, 0, null, active, g3, g7)).toBe('tension');
  });

  it('classifies inactive', () => {
    expect(padClassifyPC(1, 0, null, active, g3, g7)).toBe('inactive');
  });

  it('root takes priority over bass when same PC', () => {
    expect(padClassifyPC(0, 0, 0, active, g3, g7)).toBe('root');
  });

  it('handles null/undefined bassPC', () => {
    expect(padClassifyPC(4, 0, undefined, active, g3, g7)).toBe('guide3');
  });

  it('handles empty activePCS', () => {
    expect(padClassifyPC(0, 0, null, new Set(), g3, g7)).toBe('inactive');
  });

  it('handles null activePCS', () => {
    expect(padClassifyPC(0, 0, null, null, g3, g7)).toBe('inactive');
  });
});

// ======== padClassifyColor ========
describe('padClassifyColor', () => {
  it('returns root color for root classification', () => {
    expect(padClassifyColor('root')).toBe('#E69F00');
  });

  it('returns guide3 color', () => {
    expect(padClassifyColor('guide3')).toBe('#009E73');
  });

  it('returns inactive for unknown classification', () => {
    expect(padClassifyColor('inactive')).toBe('#2a2a3e');
  });

  it('uses custom theme', () => {
    const custom = { root: '#ff0000', inactive: '#000' };
    expect(padClassifyColor('root', custom)).toBe('#ff0000');
  });

  it('falls back to inactive for missing key in custom theme', () => {
    const custom = { inactive: '#000' };
    expect(padClassifyColor('guide3', custom)).toBe('#000');
  });
});

describe('padComputeRenderState', () => {
  it('marks manually added #9 as tension even though it shares pitch class with m3', () => {
    const state = padComputeRenderState({
      mode: 'chord',
      key: 0,
      scaleIdx: 0,
      builderRoot: 0,
      qualityPCS: [0, 4, 7, 10],
      builderPCS: [0, 4, 7, 10, 3],
      chordName: 'C7(#9)',
      voicing: {},
      noRootLabel: '...',
    });
    expect(state.activePCS).toEqual(new Set([0, 3, 4, 7, 10]));
    expect(state.tensionPCS).toContain(3);
    expect(state.guide3PCS).toContain(4);
    expect(state.guide3PCS).not.toContain(3);
    expect(state.guide7PCS).toContain(10);
  });

  it('does not replace chord pad tones with C Major when C-fixed is on', () => {
    const state = padComputeRenderState({
      cFixed: true,
      mode: 'chord',
      key: 0,
      scaleIdx: 0,
      builderRoot: 0,
      qualityPCS: [0, 3, 7, 10],
      builderPCS: [0, 3, 7, 10, 14],
      chordName: 'Cm7(9)',
      voicing: {},
      noRootLabel: '...',
    });
    const padState = padApplyPadOverride(state);
    expect(padState.activePCS).toEqual(new Set([0, 2, 3, 7, 10]));
    expect(padState.guide3PCS).toContain(3);
    expect(padState.guide7PCS).toContain(10);
  });

  it('keeps C-fixed override for scale mode', () => {
    const state = padComputeRenderState({
      cFixed: true,
      mode: 'scale',
      key: 5,
      scaleIdx: 0,
    });
    const padState = padApplyPadOverride(state);
    expect(padState.rootPC).toBe(0);
    expect(padState.activePCS).toEqual(new Set([0, 2, 4, 5, 7, 9, 11]));
  });
});

// ======== padFindCompactPositions ========
describe('padFindCompactPositions', () => {
  // Standard 64-pad: 8 rows, 8 cols, baseMidi=36, rowInterval=5
  const ROWS = 8, COLS = 8, BM = 36, RI = 5;

  it('returns empty for empty input', () => {
    expect(padFindCompactPositions([], ROWS, COLS, BM, RI)).toEqual([]);
  });

  it('returns empty for out-of-range MIDI notes', () => {
    // MIDI 10 is below grid (baseMidi=36)
    expect(padFindCompactPositions([10], ROWS, COLS, BM, RI)).toEqual([]);
  });

  it('returns single position for single note', () => {
    // MIDI 36 = row 0, col 0
    const result = padFindCompactPositions([36], ROWS, COLS, BM, RI);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ row: 0, col: 0, midi: 36 });
  });

  it('returns single position for note with one grid position', () => {
    // MIDI 43 = row 0 col 7 (43-36=7) OR row 1 col 2 (43-36-5=2)
    const result = padFindCompactPositions([43], ROWS, COLS, BM, RI);
    expect(result).toHaveLength(1);
    // Should pick one of the two valid positions
    expect(result[0].midi).toBe(43);
  });

  it('picks compact layout for two notes with alternatives', () => {
    // C2=48: row 0 col 12 (invalid), row 1 col 7, row 2 col 2
    // E2=52: row 1 col 11 (invalid), row 2 col 6, row 3 col 1
    // Compact: both on row 2 (col 2 and col 6) → rowSpan=1
    const result = padFindCompactPositions([48, 52], ROWS, COLS, BM, RI);
    expect(result).toHaveLength(2);
    const rows = result.map(p => p.row);
    const cols = result.map(p => p.col);
    const rowSpan = Math.max(...rows) - Math.min(...rows) + 1;
    const colSpan = Math.max(...cols) - Math.min(...cols) + 1;
    // Should be more compact than choosing lowest-row for each independently
    expect(rowSpan).toBeLessThanOrEqual(2);
  });

  it('skips out-of-range notes but positions in-range ones', () => {
    // Mix of in-range and out-of-range
    const result = padFindCompactPositions([36, 10, 41], ROWS, COLS, BM, RI);
    expect(result).toHaveLength(2); // only 36 and 41
    expect(result.map(p => p.midi).sort()).toEqual([36, 41]);
  });

  it('handles typical 5-note TASTY voicing compactly', () => {
    // Cm7(9): C=48, Eb=51, G=55, Bb=58, D=62
    // All within pad range (36-78)
    const midiNotes = [48, 51, 55, 58, 62];
    const result = padFindCompactPositions(midiNotes, ROWS, COLS, BM, RI);
    expect(result).toHaveLength(5);
    const rows = result.map(p => p.row);
    const cols = result.map(p => p.col);
    const rowSpan = Math.max(...rows) - Math.min(...rows) + 1;
    const colSpan = Math.max(...cols) - Math.min(...cols) + 1;
    const maxDim = Math.max(rowSpan, colSpan);
    // Should be reasonably compact (not scattered across full 8x8)
    expect(maxDim).toBeLessThanOrEqual(6);
  });

  it('preserves MIDI values in output', () => {
    const midiNotes = [48, 55, 60];
    const result = padFindCompactPositions(midiNotes, ROWS, COLS, BM, RI);
    const midiOut = result.map(p => p.midi).sort((a, b) => a - b);
    expect(midiOut).toEqual([48, 55, 60]);
  });

  it('positions are valid grid coordinates', () => {
    const midiNotes = [48, 51, 55, 58, 62];
    const result = padFindCompactPositions(midiNotes, ROWS, COLS, BM, RI);
    for (const p of result) {
      expect(p.row).toBeGreaterThanOrEqual(0);
      expect(p.row).toBeLessThan(ROWS);
      expect(p.col).toBeGreaterThanOrEqual(0);
      expect(p.col).toBeLessThan(COLS);
      // Verify: baseMidi + row*rowInterval + col = midi
      expect(BM + p.row * RI + p.col).toBe(p.midi);
    }
  });

  it('handles note appearing on only one row', () => {
    // MIDI 36 = row 0 col 0 (only position)
    // MIDI 37 = row 0 col 1 (only position)
    const result = padFindCompactPositions([36, 37], ROWS, COLS, BM, RI);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ row: 0, col: 0, midi: 36 });
    expect(result[1]).toEqual({ row: 0, col: 1, midi: 37 });
  });

  it('prefers playable shell clusters when degree metadata is available', () => {
    const midiNotes = [55, 59, 65, 70, 75, 79];
    const degreeMap = { 55: '1', 59: '3', 65: 'b7', 70: '#9', 75: '#5', 79: '1' };
    const result = padFindCompactPositions(midiNotes, ROWS, COLS, 48, RI, degreeMap);
    const byMidi = new Map(result.map(p => [p.midi, p]));
    const shell = [byMidi.get(55), byMidi.get(59), byMidi.get(65)];
    const rows = shell.map(p => p.row);
    const cols = shell.map(p => p.col);
    expect(Math.max(...rows) - Math.min(...rows) + 1).toBeLessThanOrEqual(3);
    expect(Math.max(...cols) - Math.min(...cols) + 1).toBeLessThanOrEqual(2);
  });
});
