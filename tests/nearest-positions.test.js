import { describe, it, expect } from 'vitest';

// Helpers: [[pitch, serial], ...] <-> [{pitch, serial}]
const B = (pairs) => pairs.map(([pitch, serial]) => ({ pitch, serial }));
const pairsOf = (r) => r.bindings.map((b) => [b.pitch, b.serial]);
const serialsOf = (r) => r.bindings.map((b) => b.serial);

// HPS4 "Cm7-Fm7 8th Note" (hps4_cm7_f7_8th / keys_ep)
const CM7_SEED = B([[60, 72], [63, 78], [67, 85], [70, 88]]);
const FM7_PITCHES = [60, 63, 65, 68];
const FM7_EXPECTED = [[60, 72], [63, 78], [65, 80], [68, 86]];

describe('layout helpers (push-fourths-chromatic-v1)', () => {
  it('serial = 36 + row*8 + col, pitch = 36 + 5*row + col', () => {
    expect(padSerialToRowCol(36)).toEqual({ row: 0, col: 0 });
    expect(padSerialToRowCol(99)).toEqual({ row: 7, col: 7 });
    expect(padSerialToRowCol(72)).toEqual({ row: 4, col: 4 });
    expect(padRowColToSerial(6, 4)).toBe(88);
    expect(padPitchAtSerial(72)).toBe(60);
    expect(padPitchAtSerial(88)).toBe(70);
    expect(padPitchAtSerial(99)).toBe(36 + 35 + 7);
  });

  it('rejects serials outside the board', () => {
    expect(padSerialToRowCol(35)).toBeNull();
    expect(padSerialToRowCol(100)).toBeNull();
    expect(padSerialToRowCol(72.5)).toBeNull();
    expect(padPitchAtSerial(200)).toBeNull();
  });

  it('octaveShift moves the pitch base only; serial does not change', () => {
    expect(padPitchAtSerial(72, { octaveShift: 1 })).toBe(72);
    expect(padPitchAtSerial(72, { octaveShift: -1 })).toBe(48);
    expect(padSerialToRowCol(72, { octaveShift: 1 })).toEqual({ row: 4, col: 4 });
  });

  it('the seed pitches map to the pads the HPS4 material specifies', () => {
    expect(CM7_SEED.map((b) => padPitchAtSerial(b.serial))).toEqual([60, 63, 67, 70]);
    expect(FM7_EXPECTED.map(([, s]) => padPitchAtSerial(s))).toEqual(FM7_PITCHES);
  });
});

describe('padChooseNearestPositions: HPS4 Cm7 -> Fm7 (acceptance)', () => {
  it('matches the specified Fm7 exactly: {60->72, 63->78, 65->80, 68->86}', () => {
    const r = padChooseNearestPositions(CM7_SEED, FM7_PITCHES);
    expect(r.ok).toBe(true);
    expect(pairsOf(r)).toEqual(FM7_EXPECTED);
  });

  it('reports the metrics the design note computed (moved 0, distance 2)', () => {
    const r = padChooseNearestPositions(CM7_SEED, FM7_PITCHES);
    expect(r.metrics.movedCommon).toBe(0);
    expect(r.metrics.distance).toBe(2);
    expect(r.metrics.area).toBe(9);
    expect(r.metrics.tieCount).toBe(1);
  });

  it('returns row/col consistent with serial and pitch', () => {
    const r = padChooseNearestPositions(CM7_SEED, FM7_PITCHES);
    for (const b of r.bindings) {
      expect(padRowColToSerial(b.row, b.col)).toBe(b.serial);
      expect(padPitchAtSerial(b.serial)).toBe(b.pitch);
    }
  });

  it('does not use the compact-only answer when it differs (compact Cm7 is [72,75,82,88])', () => {
    // The seed is a human decision; Fm7 follows from it, not from compact alone.
    const compact = padFindCompactPositions([60, 63, 67, 70], 8, 8, 36, 5).map((p) => 36 + p.row * 8 + p.col);
    expect(compact).toEqual([72, 75, 82, 88]);
    expect(serialsOf(padChooseNearestPositions(CM7_SEED, FM7_PITCHES))).toEqual([72, 78, 80, 86]);
  });
});

describe('padChooseNearestPositions: rule order', () => {
  it('rule 1: a common pitch stays even when moving it would shorten the hand movement', () => {
    // Without rule 1 the result would move pitch 62 from serial 77 to 74 (distance 7 vs 11).
    const prev = B([[62, 77], [69, 87], [68, 83]]);
    const r = padChooseNearestPositions(prev, [37, 62, 69]);
    expect(r.ok).toBe(true);
    expect(pairsOf(r)).toEqual([[37, 37], [62, 77], [69, 87]]);
    expect(r.metrics.movedCommon).toBe(0);
    expect(r.metrics.distance).toBe(11);
  });

  it('every common pitch keeps its serial across many random chord pairs', () => {
    let seed = 12345;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    for (let it = 0; it < 300; it++) {
      const prevMap = new Map();
      while (prevMap.size < 3) {
        const row = rnd(8), col = rnd(8);
        prevMap.set(36 + 5 * row + col, padRowColToSerial(row, col));
      }
      const prev = [...prevMap].map(([pitch, serial]) => ({ pitch, serial }));
      const next = new Set([...prevMap.keys()].slice(0, 2));
      while (next.size < 4) next.add(36 + rnd(40));
      const r = padChooseNearestPositions(prev, [...next]);
      expect(r.ok).toBe(true);
      for (const b of r.bindings) {
        if (prevMap.has(b.pitch)) expect(b.serial).toBe(prevMap.get(b.pitch));
      }
      expect(r.metrics.movedCommon).toBe(0);
    }
  });

  it('rule 2: hand movement decides before the bounding rectangle', () => {
    // The smallest-area choice would be [37,45,69] (area 5) but costs distance 18.
    const prev = B([[52, 58], [72, 93], [74, 95]]);
    const r = padChooseNearestPositions(prev, [37, 42, 57]);
    expect(serialsOf(r)).toEqual([37, 42, 69]);
    expect(r.metrics.distance).toBe(14);
    expect(r.metrics.area).toBe(30);
  });

  it('distance is board Manhattan, not semitones or serial difference', () => {
    // Pitch 68 sits on serial 83 (row5,col7) or 86 (row6,col2). From serial 84
    // (row6,col0) serial 83 is numerically nearer (1 vs 2) but 8 steps away on
    // the board; serial 86 is 2 steps away.
    const prev = B([[66, 84]]);
    const r = padChooseNearestPositions(prev, [68]);
    expect(serialsOf(r)).toEqual([86]);
    expect(r.metrics.distance).toBe(2);
  });

  it('rule 3: with equal movement, the smaller longer side (maxDim) wins', () => {
    // Movement ties at 6 between a 2x3 form (maxDim 3, area 6) and a form with maxDim 8.
    const prev = B([[65, 80], [56, 68], [57, 69]]);
    const r = padChooseNearestPositions(prev, [61, 63, 68]);
    expect(serialsOf(r)).toEqual([76, 78, 86]);
    expect(r.metrics.distance).toBe(6);
    expect(r.metrics.area).toBe(6);
    expect(r.metrics.tieCount).toBe(1);
  });

  it('rule 3: with equal movement and equal maxDim, the smaller area wins', () => {
    // Three forms tie at distance 11: (maxDim 6, area 30), (7, 35), (6, 24).
    const prev = B([[62, 77], [58, 70], [42, 42]]);
    const r = padChooseNearestPositions(prev, [49, 66, 72]);
    expect(serialsOf(r)).toEqual([55, 84, 93]);
    expect(r.metrics.distance).toBe(11);
    expect(r.metrics.area).toBe(24);
  });

  it('rule 3: maxDim is compared before area (reviewer case)', () => {
    // maxDim first -> [52,81,88,93] (6x6, area 36); area first would pick [49,81,88,93] (7x5, area 35).
    const prev = B([[70, 88], [66, 81], [68, 86], [75, 96]]);
    const r = padChooseNearestPositions(prev, [46, 66, 70, 72]);
    expect(serialsOf(r)).toEqual([52, 81, 88, 93]);
    expect(r.metrics.rowSpan).toBe(6);
    expect(r.metrics.colSpan).toBe(6);
    expect(r.metrics.area).toBe(36);
    expect(r.metrics.tieCount).toBe(1);
  });

  it('rule 4: a complete tie is broken by ascending serial', () => {
    // Pitch 54 / 67 from this origin: two forms tie on every rule above.
    const prev = B([[64, 79], [36, 36]]);
    const r = padChooseNearestPositions(prev, [54, 67]);
    expect(r.ok).toBe(true);
    expect(serialsOf(r)).toEqual([63, 82]);
    expect(r.metrics.tieCount).toBe(2);
  });

  it('rule 4: remaining ties are broken by ascending serial, independent of input order', () => {
    const prev = B([[64, 79], [36, 36]]);
    const a = padChooseNearestPositions(prev, [54, 67]);
    const b = padChooseNearestPositions(prev, [67, 54]);
    expect(serialsOf(a)).toEqual(serialsOf(b));
    expect(serialsOf(a)).toEqual([63, 82]);
  });
});

describe('layout is fixed and range-checked', () => {
  it('padRowColToSerial returns null outside the board', () => {
    expect(padRowColToSerial(-1, 0)).toBeNull();
    expect(padRowColToSerial(8, 0)).toBeNull();
    expect(padRowColToSerial(0, 8)).toBeNull();
    expect(padRowColToSerial(0.5, 0)).toBeNull();
    expect(padRowColToSerial(7, 7)).toBe(99);
  });

  it('options.layout cannot replace the board', () => {
    const fake = { layout: { rows: 4, cols: 16, serialBase: 0, baseMidi: 0 } };
    expect(padNearestLayout(fake)).toEqual(padNearestLayout());
    expect(padSerialToRowCol(99, fake)).toEqual({ row: 7, col: 7 });
    expect(padChooseNearestPositions(CM7_SEED, FM7_PITCHES, fake)).toEqual(padChooseNearestPositions(CM7_SEED, FM7_PITCHES));
  });
});

describe('padChooseNearestPositions: determinism and purity', () => {
  it('same input gives the same output and does not mutate the inputs', () => {
    const prev = CM7_SEED.map((b) => ({ ...b }));
    const next = FM7_PITCHES.slice();
    const a = padChooseNearestPositions(prev, next);
    const b = padChooseNearestPositions(prev, next);
    expect(a).toEqual(b);
    expect(prev).toEqual(CM7_SEED);
    expect(next).toEqual(FM7_PITCHES);
  });

  it('input order of prev and next does not matter', () => {
    const a = padChooseNearestPositions(CM7_SEED, FM7_PITCHES);
    const b = padChooseNearestPositions(CM7_SEED.slice().reverse(), FM7_PITCHES.slice().reverse());
    expect(b).toEqual(a);
  });

  it('duplicate pitches collapse to one pad', () => {
    const r = padChooseNearestPositions(CM7_SEED, [60, 60, 63, 65, 68]);
    expect(pairsOf(r)).toEqual(FM7_EXPECTED);
  });
});

describe('padChooseNearestPositions: cannot-place and invalid input', () => {
  it('reports unplaceable pitches and returns no bindings (never drops a note)', () => {
    const r = padChooseNearestPositions(CM7_SEED, [60, 63, 20, 100]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unplaceable');
    expect(r.unplaceablePitches).toEqual([20, 100]);
    expect(r.bindings).toEqual([]);
  });

  it('a pitch placeable only with a different octave window is reported, not moved', () => {
    const r = padChooseNearestPositions(CM7_SEED, [60, 79]);
    expect(r.ok).toBe(false);
    expect(r.unplaceablePitches).toEqual([79]);
  });

  it('the same pitch becomes placeable with the matching octave window', () => {
    // Base 36 reaches at most pitch 78; octaveShift +1 moves the base to 48 and reaches 90.
    const seed = B([[72, 72]]);
    const r = padChooseNearestPositions(seed, [72, 79], { octaveShift: 1 });
    expect(r.ok).toBe(true);
    expect(r.bindings.map((b) => b.pitch)).toEqual([72, 79]);
    for (const b of r.bindings) expect(padPitchAtSerial(b.serial, { octaveShift: 1 })).toBe(b.pitch);
  });

  it('requires an origin (a seed): no silent fallback to compact', () => {
    expect(padChooseNearestPositions(null, FM7_PITCHES).reason).toBe('no_origin');
    expect(padChooseNearestPositions([], FM7_PITCHES).reason).toBe('no_origin');
  });

  it('rejects an origin whose serial does not produce its pitch', () => {
    const bad = B([[60, 73]]);
    const r = padChooseNearestPositions(bad, [60]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid_origin');
    expect(r.bad).toEqual(bad);
  });

  it('rejects out-of-board origin serials, non-integer pitches and empty targets', () => {
    expect(padChooseNearestPositions(B([[60, 500]]), [60]).reason).toBe('invalid_origin');
    expect(padChooseNearestPositions(CM7_SEED, [60.5]).reason).toBe('invalid_pitch');
    expect(padChooseNearestPositions(CM7_SEED, []).reason).toBe('empty_pitches');
  });

  it('refuses an unbounded search with an explicit reason', () => {
    const many = [];
    for (let p = 40; p < 52; p++) many.push(p);
    expect(padChooseNearestPositions(CM7_SEED, many).reason).toBe('too_many_pitches');
  });

  it('applies the same cap to the previous chord (prev), so the matching cannot overflow', () => {
    const prev = [];
    for (let p = 40; p < 56; p++) {
      for (let row = 0; row < 8; row++) {
        const col = p - 36 - 5 * row;
        if (col >= 0 && col < 8) { prev.push({ pitch: p, serial: padRowColToSerial(row, col) }); break; }
      }
    }
    expect(prev.length).toBeGreaterThan(10);
    const r = padChooseNearestPositions(prev, [60]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('too_many_pitches');
    expect(r.bindings).toEqual([]);
  });

  it('a prev of exactly the maximum size still resolves', () => {
    const prev = [];
    for (let p = 40; p < 50; p++) {
      for (let row = 0; row < 8; row++) {
        const col = p - 36 - 5 * row;
        if (col >= 0 && col < 8) { prev.push({ pitch: p, serial: padRowColToSerial(row, col) }); break; }
      }
    }
    expect(prev).toHaveLength(10);
    expect(padChooseNearestPositions(prev, [60, 63]).ok).toBe(true);
  });
});

describe('padChooseNearestPositions: unequal note counts (open question)', () => {
  it('still resolves, fully matches the smaller side, and says so in metrics', () => {
    const shell = padChooseNearestPositions(CM7_SEED, [60, 63, 65]);
    expect(shell.ok).toBe(true);
    expect(shell.metrics.matched).toBe(3);
    expect(shell.metrics.unmatchedPrev).toBe(1);
    expect(shell.metrics.unmatchedNext).toBe(0);
    expect(pairsOf(shell).slice(0, 2)).toEqual([[60, 72], [63, 78]]);

    const bigger = padChooseNearestPositions(B([[60, 72], [63, 78]]), FM7_PITCHES);
    expect(bigger.ok).toBe(true);
    expect(bigger.metrics.unmatchedNext).toBe(2);
  });
});

describe('padResolveNearestSequence: seed and override', () => {
  const cm7 = { pitches: [60, 63, 67, 70], explicit: CM7_SEED };
  const fm7 = { pitches: FM7_PITCHES };
  const bb7 = { pitches: [58, 62, 65, 68] };

  it('derives Fm7 from the seed Cm7 (HPS4)', () => {
    const r = padResolveNearestSequence([cm7, fm7]);
    expect(r.ok).toBe(true);
    expect(r.results.map((x) => x.source)).toEqual(['seed', 'nearest']);
    expect(pairsOf(r.results[0])).toEqual([[60, 72], [63, 78], [67, 85], [70, 88]]);
    expect(pairsOf(r.results[1])).toEqual(FM7_EXPECTED);
  });

  it('an override wins for its chord and becomes the origin for what follows', () => {
    const override = B([[60, 72], [63, 78], [65, 80], [68, 83]]);
    const derived = padResolveNearestSequence([cm7, fm7, bb7]);
    const overridden = padResolveNearestSequence([cm7, { ...fm7, explicit: override }, bb7]);
    expect(derived.ok && overridden.ok).toBe(true);
    expect(overridden.results[1].source).toBe('override');
    expect(pairsOf(overridden.results[1])).toEqual([[60, 72], [63, 78], [65, 80], [68, 83]]);
    expect(serialsOf(derived.results[2])).toEqual([70, 77, 80, 86]);
    expect(serialsOf(overridden.results[2])).toEqual([70, 74, 80, 83]);
    // The step after an override equals deriving directly from the override.
    expect(serialsOf(overridden.results[2])).toEqual(serialsOf(padChooseNearestPositions(override, bb7.pitches)));
  });

  it('a later seed-free chord keeps following the last resolved step, not the first seed', () => {
    const r = padResolveNearestSequence([cm7, fm7, bb7, { pitches: [60, 63, 67, 70] }]);
    expect(r.ok).toBe(true);
    const back = r.results[3];
    expect(back.source).toBe('nearest');
    expect(serialsOf(back)).toEqual(serialsOf(padChooseNearestPositions(r.results[2].bindings, [60, 63, 67, 70])));
  });

  it('the cap also applies to a seed / override (explicit)', () => {
    const pitches = [];
    const explicit = [];
    for (let p = 40; p < 52; p++) {
      for (let row = 0; row < 8; row++) {
        const col = p - 36 - 5 * row;
        if (col >= 0 && col < 8) { pitches.push(p); explicit.push({ pitch: p, serial: padRowColToSerial(row, col) }); break; }
      }
    }
    const r = padResolveNearestSequence([{ pitches, explicit }]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('too_many_pitches');
    expect(r.failedAt).toBe(0);
  });

  it('requires a seed on the first step', () => {
    const r = padResolveNearestSequence([fm7]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('seed_required');
    expect(r.failedAt).toBe(0);
  });

  it('stops at the first failing step and guesses nothing after it', () => {
    const r = padResolveNearestSequence([cm7, { pitches: [60, 20] }, bb7]);
    expect(r.ok).toBe(false);
    expect(r.failedAt).toBe(1);
    expect(r.reason).toBe('unplaceable');
    expect(r.results).toHaveLength(2);
  });

  it('rejects an explicit form that does not cover exactly the chord pitches', () => {
    const missing = padResolveNearestSequence([{ pitches: [60, 63, 67, 70], explicit: B([[60, 72], [63, 78], [67, 85]]) }]);
    expect(missing.reason).toBe('explicit_pitch_mismatch');
    const wrongPad = padResolveNearestSequence([{ pitches: [60], explicit: B([[60, 73]]) }]);
    expect(wrongPad.reason).toBe('invalid_explicit');
  });

  it('an explicit step can place a common pitch on its other pad, and later steps follow it', () => {
    // Pitch 68 has two pads: serial 83 and serial 86.
    const r = padResolveNearestSequence([
      { pitches: [68], explicit: B([[68, 86]]) },
      { pitches: [68], explicit: B([[68, 83]]) },
      { pitches: [68, 70] },
    ]);
    expect(r.ok).toBe(true);
    expect(r.results[2].bindings.find((b) => b.pitch === 68).serial).toBe(83);
  });
});
