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

  it('Builder and parser agree on pitch classes for the reported dim7 cases', () => {
    const base = [0, 3, 6, 9];
    const single11 = padApplyTension(base, tensionByLabel('11').mods);
    const compound911 = padApplyTension(base, tensionByLabel('(9)\n(11)').mods);

    expect(pcSet(single11)).toEqual([0, 3, 5, 6, 9]);
    expect(pcSet(padParseChordName('Cdim7(11)').intervals)).toEqual(pcSet(single11));

    expect(pcSet(compound911)).toEqual([0, 2, 3, 5, 6, 9]);
    expect(pcSet(padParseChordName('Cdim7(9,11)').intervals)).toEqual(pcSet(compound911));
  });

  it('dim7 explicit 13 does not create a new pitch class, while register duplication may survive parsing', () => {
    const base = [0, 3, 6, 9];
    const builder = padApplyTension(base, tensionByLabel('13').mods);
    const parsed = padParseChordName('Cdim7(13)');

    expect(pcSet(builder)).toEqual(base);
    expect(pcSet(parsed.intervals)).toEqual(base);
    expect(parsed.intervals).toContain(21); // explicit upper A is voicing/register information, not a new pc
  });

  it('derives dim7 available pitch classes only as a whole step above each chord tone', () => {
    expect(padGetDim7AvailableTensionPCs([0, 3, 6, 9])).toEqual([2, 5, 8, 11]);
    expect(padGetDim7AvailableTensionPCs([12, 15, 18, 21])).toEqual([2, 5, 8, 11]);
  });

  it('shows only legal dim7 additions and hides unavailable or pitch-class no-op tensions', () => {
    const labels = ['9', '11', 'b13', 'b9', '#9', '13'];
    const buttons = labels.map(label => fakeButton(tensionByLabel(label)));
    const byLabel = new Map(buttons.map(btn => [btn._tension.label, btn]));

    padUpdateTensionVisibility(buttons, { name: 'dim7', pcs: [0, 3, 6, 9] }, padApplyTension);

    expect(byLabel.get('9').classes.has('quality-hidden')).toBe(false);
    expect(byLabel.get('11').classes.has('quality-hidden')).toBe(false);
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

  it('keeps abstract altered shorthand out of concrete performed-pitch parsing', () => {
    expect(PAD_ABSTRACT_CHORD_SHORTHANDS.has('7alt')).toBe(true);
    expect(PAD_QUALITY_INTERVALS['7alt']).toBeUndefined();
    expect(padParseChordName('C7alt')).toBeNull();
    expect(padGenerateCandidates('C7a').some(c => c.quality === '7alt')).toBe(false);
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
