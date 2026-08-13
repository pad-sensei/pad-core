import { describe, it, expect } from 'vitest';

const pcSet = (intervals) => [...new Set(intervals.map(iv => ((iv % 12) + 12) % 12))].sort((a, b) => a - b);
const tensionByLabel = (label) => TENSION_ROWS.flat().find(t => t && t.label === label);
const fakeButton = (tension) => {
  const classes = new Set();
  return {
    _tension: tension,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    classes,
  };
};

describe('v1.7 explicit-pitch contract', () => {
  it('single Builder 11 adds 11 only, while compound (9,11) adds exactly both', () => {
    expect(tensionByLabel('11').mods.add).toEqual([5]);
    expect(pcSet(padApplyTension([0, 4, 7, 10], tensionByLabel('11').mods)))
      .toEqual([0, 4, 5, 7, 10]);
    expect(pcSet(padApplyTension([0, 4, 7, 10], tensionByLabel('(9)\n(11)').mods)))
      .toEqual([0, 2, 4, 5, 7, 10]);
  });

  it('single explicit 11/13 spellings never complete missing lower extensions', () => {
    const cases = [
      ['C7(11)', [0, 4, 5, 7, 10]],
      ['C11', [0, 4, 5, 7, 10]],
      ['C7(13)', [0, 4, 7, 9, 10]],
      ['C13', [0, 4, 7, 9, 10]],
      ['Cm7(11)', [0, 3, 5, 7, 10]],
      ['Cm7(13)', [0, 3, 7, 9, 10]],
      ['Cmaj7(11)', [0, 4, 5, 7, 11]],
      ['Cmaj7(13)', [0, 4, 7, 9, 11]],
    ];
    for (const [name, expected] of cases) {
      const parsed = padParseChordName(name);
      expect(parsed, name).not.toBeNull();
      expect(pcSet(parsed.intervals), name).toEqual(expected);
    }
  });

  it('compound parser adds exactly the named extension pitch classes', () => {
    const cases = [
      ['C7(9,11)', [0, 2, 4, 5, 7, 10]],
      ['C7(9,13)', [0, 2, 4, 7, 9, 10]],
      ['C7(11,13)', [0, 4, 5, 7, 9, 10]],
      ['C7(b9,#11,13)', [0, 1, 4, 6, 7, 9, 10]],
      ['Cm7(9,11,13)', [0, 2, 3, 5, 7, 9, 10]],
      ['Cmaj7(9,#11,13)', [0, 2, 4, 6, 7, 9, 11]],
      ['C7(b11,b13)', [0, 4, 7, 8, 10]],
      ['C7sus4(b11,b13)', [0, 4, 5, 7, 8, 10]],
    ];
    for (const [name, expected] of cases) {
      const parsed = padParseChordName(name);
      expect(parsed, name).not.toBeNull();
      expect(pcSet(parsed.intervals), name).toEqual(expected);
    }
  });

  it('Builder and parser retain the exact explicitly selected dim7 extension registers', () => {
    const base = [0, 3, 6, 9];
    const single11 = padApplyTension(base, tensionByLabel('11').mods);
    const compound911 = padApplyTension(base, tensionByLabel('(9)\n(11)').mods);
    const compound913 = padApplyTension(base, tensionByLabel('(9,13)').mods);
    const compound1113 = padApplyTension(base, tensionByLabel('(11)\n(13)').mods);

    expect(single11).toEqual([0, 3, 6, 9, 17]);
    expect(padParseChordName('Cdim7(11)').intervals).toEqual(single11);

    expect(compound911).toEqual([0, 3, 6, 9, 14, 17]);
    expect(padParseChordName('Cdim7(9,11)').intervals).toEqual(compound911);

    expect(compound913).toEqual([0, 3, 6, 9, 14, 21]);
    expect(padParseChordName('Cdim7(9,13)').intervals).toEqual(compound913);

    expect(compound1113).toEqual([0, 3, 6, 9, 17, 21]);
    expect(padParseChordName('Cdim7(11,13)').intervals).toEqual(compound1113);
  });

  it('dim7 explicit 13 does not create a new pitch class, while register duplication may survive parsing', () => {
    const base = [0, 3, 6, 9];
    const builder = padApplyTension(base, tensionByLabel('13').mods);
    const parsed = padParseChordName('Cdim7(13)');

    expect(pcSet(builder)).toEqual(base);
    expect(pcSet(parsed.intervals)).toEqual(base);
    expect(parsed.intervals).toContain(21); // explicit upper A is voicing/register information, not a new pc
  });

  it('keeps an explicitly constructed dim7 13 in the compound register without making it available', () => {
    const base = [0, 3, 6, 9];
    const constructed = padApplyTension(base, tensionByLabel('13').mods);

    expect(constructed).toEqual([0, 3, 6, 9, 21]);
    expect(pcSet(constructed)).toEqual(base);
    expect(padGetBuilderChordName(0, { name: 'dim7', pcs: base }, tensionByLabel('13'), null, 0, 0))
      .toBe('Cdim7(13)');
  });

  it('builds a structured payload with exact constructed intervals and explicit register intent', () => {
    const base = [0, 3, 6, 9];
    expect(padBuildChordPayload(base, tensionByLabel('11'))).toMatchObject({
      tensionLabels: ['11'], chordPCS: [0, 3, 5, 6, 9],
      chordIntervals: [0, 3, 6, 9, 17], tensionPCS: [5], tensionIntervals: [17],
      register: { explicit: true, intervals: [] }, explicitIntent: true,
    });
    expect(padBuildChordPayload(base, tensionByLabel('(9)\n(11)'))).toMatchObject({
      tensionLabels: ['9', '11'], chordIntervals: [0, 3, 6, 9, 14, 17],
      tensionPCS: [2, 5], tensionIntervals: [14, 17],
    });
    expect(padBuildChordPayload(base, tensionByLabel('(11)\n(13)'))).toMatchObject({
      tensionLabels: ['11', '13'], chordPCS: [0, 3, 5, 6, 9],
      chordIntervals: [0, 3, 6, 9, 17, 21], tensionPCS: [5, 9], tensionIntervals: [17, 21],
      register: { explicit: true, intervals: [21] }, explicitIntent: true,
    });
  });

  it('marks null or undefined Builder tension as non-explicit, matching MIDI detection', () => {
    const base = [0, 3, 6, 9];
    for (const tension of [null, undefined]) {
      expect(padBuildChordPayload(base, tension)).toMatchObject({
        tensionLabels: [], chordPCS: base, chordIntervals: base,
        tensionPCS: [], tensionIntervals: [],
        register: { explicit: false, intervals: [] }, explicitIntent: false,
      });
    }
  });

  it('uses the structured tension labels supplied by every Builder definition', () => {
    const expected = {
      '6(9)': ['6', '9'],
      '6(9,#11)': ['6', '9', '#11'],
      '(11)\n(13)': ['11', '13'],
      '(9,13)': ['9', '13'],
      b13: ['b13'],
    };
    for (const tension of TENSION_ROWS.flat().filter(Boolean)) {
      expect(Array.isArray(tension.tensionLabels), tension.label).toBe(true);
      expect(tension.tensionLabels.length, tension.label).toBeGreaterThan(0);
      expect(tension.tensionLabels.every(label => /^(?:[a-z#b]*\d+|aug)$/.test(label)), tension.label).toBe(true);
      expect(padBuildChordPayload([0, 4, 7, 10], tension).tensionLabels)
        .toEqual(tension.tensionLabels);
    }
    for (const [label, labels] of Object.entries(expected)) {
      expect(tensionByLabel(label).tensionLabels).toEqual(labels);
    }
  });

  it('keeps structured dim7 construction root-invariant before root transposition', () => {
    for (let root = 0; root < 12; root++) {
      const payload = padBuildChordPayload([0, 3, 6, 9], tensionByLabel('(11)\n(13)'));
      const transpose = (pc) => (root + pc) % 12;
      expect(payload.chordIntervals).toEqual([0, 3, 6, 9, 17, 21]);
      expect(payload.chordPCS.map(transpose).sort((a, b) => a - b))
        .toEqual([0, 3, 5, 6, 9].map(transpose).sort((a, b) => a - b));
      expect(payload.register.intervals).toEqual([21]);
    }
  });

  it('marks every explicit natural-13 Builder label with register intent, but not 6 labels', () => {
    const hasNatural13 = (label) => /(^|[,(\n])13(?=$|[,)\n])/.test(label);
    for (const tension of TENSION_ROWS.flat().filter(Boolean)) {
      const hasRegister13 = (tension.mods.registerAdd || []).includes(9);
      expect(hasRegister13, tension.label).toBe(hasNatural13(tension.label));
    }
  });

  it('preserves existing non-dim 13 voicings and only adds a register where an explicit 13 duplicates one', () => {
    expect(padApplyTension([0, 4, 7, 10], tensionByLabel('13').mods))
      .toEqual([0, 4, 7, 10, 21]);
    expect(padApplyTension([0, 4, 7, 9], tensionByLabel('13').mods))
      .toEqual([0, 4, 7, 9, 21]);
    expect(padApplyTension([0, 4, 7, 9], tensionByLabel('6').mods))
      .toEqual([0, 4, 7, 9]);
  });

  it('derives dim7 available pitch classes only as a whole step above each chord tone', () => {
    expect(padGetDim7AvailableTensionPCs([0, 3, 6, 9])).toEqual([2, 5, 8, 11]);
    expect(padGetDim7AvailableTensionPCs([12, 15, 18, 21])).toEqual([2, 5, 8, 11]);
  });

  it('shows only legal dim7 additions and hides unavailable or pitch-class no-op tensions', () => {
    const labels = ['9', '11', '(11)\n(13)', 'b13', 'b9', '#9', '13'];
    const buttons = labels.map(label => fakeButton(tensionByLabel(label)));
    const byLabel = new Map(buttons.map(btn => [btn._tension.label, btn]));

    padUpdateTensionVisibility(buttons, { name: 'dim7', pcs: [0, 3, 6, 9] }, padApplyTension);

    expect(byLabel.get('9').classes.has('quality-hidden')).toBe(false);
    expect(byLabel.get('11').classes.has('quality-hidden')).toBe(false);
    expect(byLabel.get('(11)\n(13)').classes.has('quality-hidden')).toBe(false);
    expect(byLabel.get('b13').classes.has('quality-hidden')).toBe(false);
    expect(byLabel.get('b9').classes.has('quality-hidden')).toBe(true);
    expect(byLabel.get('#9').classes.has('quality-hidden')).toBe(true);
    expect(byLabel.get('13').classes.has('quality-hidden')).toBe(true);
  });

  it('detector never labels absent 9 when only 11 was played', () => {
    const names = padDetectChord([60, 64, 67, 70, 77]).map(c => c.name);
    expect(names.some(name => /^C7\(11\)/.test(name))).toBe(true);
    expect(names.some(name => /^C7\([^)]*9[^)]*11/.test(name))).toBe(false);
  });

  it('detector never labels absent 9/11 when only 13 was played', () => {
    const names = padDetectChord([60, 64, 67, 70, 81]).map(c => c.name);
    expect(names.some(name => /^C7\(13\)/.test(name))).toBe(true);
    expect(names.some(name => /^C7\([^)]*(9|11)[^)]*13/.test(name))).toBe(false);
  });

  it('possibility data cannot become active/rendered pitch state', () => {
    const active = new Set([0, 3, 6, 9]);
    const available = padGetDim7AvailableTensionPCs([...active]);
    for (const pc of available) {
      expect(padClassifyPC(pc, 0, null, active, new Set([3]), new Set([9]))).toBe('inactive');
    }
  });

  it('keeps dim7 diminished seventh distinct from an explicit upper 13 in degree naming', () => {
    expect(padDegreeName(9, [0, 3, 6, 9])).toBe('bb7');
    expect(padDegreeName(21, [0, 3, 6, 9, 17, 21])).toBe('13');
  });

  it('keeps abstract altered shorthand out of concrete performed-pitch parsing', () => {
    expect(PAD_ABSTRACT_CHORD_SHORTHANDS.has('7alt')).toBe(true);
    expect(PAD_QUALITY_INTERVALS['7alt']).toBeUndefined();
    expect(padParseChordName('C7alt')).toBeNull();
    expect(padGenerateCandidates('C7a').some(c => c.quality === '7alt')).toBe(false);
  });
});

describe('dim7 v1.7 availability and performed-pitch detection', () => {
  const sorted = (values) => [...values].sort((a, b) => a - b);
  const mod12 = (value) => ((value % 12) + 12) % 12;
  const dim7Midi = (root, additions = []) => [0, 3, 6, 9, ...additions].map(iv => 48 + root + iv);
  const dim7Candidate = (notes, root, suffix) => padDetectChord(notes)
    .find(candidate => candidate.rootPC === root && candidate.name.endsWith(suffix));

  it('derives available pcs from every dim7 tone under all roots and rotations', () => {
    for (let root = 0; root < 12; root++) {
      const tones = [0, 3, 6, 9].map(iv => mod12(root + iv));
      const expected = sorted(tones.map(pc => mod12(pc + 2)));
      const excluded = [1, 4, 7, 10].map(iv => mod12(root + iv));
      for (let rotation = 0; rotation < tones.length; rotation++) {
        const rotated = tones.slice(rotation).concat(tones.slice(0, rotation));
        const available = padGetDim7AvailableTensionPCs(rotated);
        expect(available).toEqual(expected);
        expect(available.every(pc => !tones.includes(pc))).toBe(true);
        expect(excluded.every(pc => !available.includes(pc))).toBe(true);
      }
    }
  });

  it('names actual dim7 additions from the shared availability set without fabricating 13 from MIDI duplication', () => {
    for (let root = 0; root < 12; root++) {
      expect(dim7Candidate(dim7Midi(root, [2]), root, 'dim7(9)')).toBeTruthy();
      expect(dim7Candidate(dim7Midi(root, [5]), root, 'dim7(11)')).toBeTruthy();
      expect(dim7Candidate(dim7Midi(root, [8]), root, 'dim7(b13)')).toBeTruthy();
      expect(dim7Candidate(dim7Midi(root, [11]), root, 'dim7(7)')).toBeTruthy();
      const compound = dim7Candidate(dim7Midi(root, [2, 5]), root, 'dim7(9,11)');
      expect(compound).toBeTruthy();
      expect(compound.tensionPCS).toEqual([2, 5]);
      expect(compound.tensionIntervals).toEqual([14, 17]);
      expect(compound.chordPCS).toEqual([0, 2, 3, 5, 6, 9]);
      expect(compound.chordIntervals).toEqual([0, 3, 6, 9, 14, 17]);
      expect(compound).toMatchObject({
        quality: 'dim7', tensionLabels: ['9', '11'],
        register: { explicit: false, intervals: [] }, explicitIntent: false,
      });

      const eleven = dim7Candidate(dim7Midi(root, [5]), root, 'dim7(11)');
      expect(eleven.chordIntervals).toEqual([0, 3, 6, 9, 17]);

      const duplicate = dim7Candidate(dim7Midi(root, [5, 21]), root, 'dim7(11)');
      expect(duplicate).toBeTruthy();
      expect(padDetectChord(dim7Midi(root, [5, 21]))
        .filter(candidate => candidate.rootPC === root)
        .some(candidate => /dim7\([^)]*13/.test(candidate.name))).toBe(false);
    }
    expect(padParseChordName('Cdim7(7)').intervals).toEqual([0, 3, 6, 9, 23]);
  });
});

describe('v1.7 explicit-extension data invariant', () => {
  const extensionPc = { b9: 1, '9': 2, '#9': 3, b11: 4, '11': 5, '#11': 6, b13: 8, '13': 9 };

  it('parenthesized concrete qualities add only extension pitch classes named in the spelling', () => {
    for (const [quality, intervals] of Object.entries(PAD_QUALITY_INTERVALS)) {
      if (quality.includes('(omit') || quality === 'm7(b5)') continue;
      const match = quality.match(/^(.*?)\(([^)]+)\)$/);
      if (!match) continue;
      const base = match[1];
      if (!Object.prototype.hasOwnProperty.call(PAD_QUALITY_INTERVALS, base)) continue;

      const tokens = match[2].split(',').map(s => s.trim()).filter(Boolean);
      const named = new Set(tokens.filter(t => extensionPc[t] !== undefined).map(t => extensionPc[t]));
      if (named.size === 0) continue;

      const basePcs = new Set(pcSet(PAD_QUALITY_INTERVALS[base]));
      const addedPcs = pcSet(intervals).filter(pc => !basePcs.has(pc));
      for (const pc of addedPcs) {
        expect(named.has(pc), `${quality} silently adds pitch class ${pc}`).toBe(true);
      }
    }
  });
});
