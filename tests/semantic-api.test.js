import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const observed = require('../observed-structure.js');
Object.assign(globalThis, observed);
const { PadSenseiTheory } = require('../semantic-api.js');

const sorted = values => [...values].sort((a, b) => a - b);
const pitchClasses = values => sorted(new Set(values.map(value => ((value % 12) + 12) % 12)));

function exactSource(midi, row, col, id) {
  return {
    midi,
    mappedMidi: midi,
    rawNote: 36 + row * 8 + col,
    row,
    col,
    physicalPadId: id,
    sourceId: `push:${id}`,
    deviceId: 'push-3',
    positionConfidence: 'exact',
  };
}

describe('minimal semantic public API v0', () => {
  it('freezes one small semantic-only namespace', () => {
    expect(Object.keys(PadSenseiTheory).sort()).toEqual([
      'analyzeObservedShellUst',
      'applyTension',
      'detectChord',
      'dim7AvailableTensionPCs',
      'findParentScales',
      'parseChord',
      'pcName',
      'pitchClass',
      'version',
    ]);
    expect(Object.isFrozen(PadSenseiTheory)).toBe(true);
    expect(PadSenseiTheory.version).toBe('0');
  });

  it('preserves the explicit-pitch contract through the public API', () => {
    const c7 = [0, 4, 7, 10];
    const with11 = PadSenseiTheory.applyTension(c7, { add: [5] });
    expect(pitchClasses(with11)).toEqual([0, 4, 5, 7, 10]);
    expect(pitchClasses(with11)).not.toContain(2);

    // padApplyTension is allowed to preserve compound register (11 => 17,
    // 13 => 21). The public semantic invariant is the performed pitch-class
    // set: no unnamed extension is fabricated.
    const with13 = PadSenseiTheory.applyTension(c7, { add: [9] });
    expect(pitchClasses(with13)).toEqual([0, 4, 7, 9, 10]);
    expect(pitchClasses(with13)).not.toContain(2);
    expect(pitchClasses(with13)).not.toContain(5);

    expect(PadSenseiTheory.dim7AvailableTensionPCs([0, 3, 6, 9])).toEqual([2, 5, 8, 11]);
  });

  it('preserves actual physical source identity for canonical Cm7 Q4', () => {
    const notes = [
      exactSource(60, 0, 0, 'shell-c'),
      exactSource(63, 0, 3, 'shell-eb'),
      exactSource(70, 2, 0, 'shell-bb'),
      exactSource(77, 3, 2, 'upper-f'),
      exactSource(82, 4, 2, 'upper-bb'),
      exactSource(87, 5, 2, 'upper-eb'),
    ];

    const result = PadSenseiTheory.analyzeObservedShellUst({
      chord: { rootPC: 0, quality: 'm7', name: 'Cm7' },
      notes,
    });

    expect(result.ust.name).toBe('Q4');
    expect(result.ust.degrees).toEqual(['11', 'b7', 'm3']);
    expect(result.ust.confidence).toBe('physical');
    expect(result.ust.notes.map(n => n.physicalPadId)).toEqual(['upper-f', 'upper-bb', 'upper-eb']);
    expect(result.ust.notes.some(n => n.physicalPadId === 'shell-c')).toBe(false);
  });

  it('loads as a classic-script namespace without changing legacy files into modules', () => {
    const context = vm.createContext({ console });
    for (const relative of ['../data.js', '../theory.js', '../observed-structure.js', '../semantic-api.js']) {
      const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
      vm.runInContext(source, context, { filename: relative });
    }

    expect(context.PadSenseiTheory).toBeTruthy();
    expect(context.PadSenseiTheory.version).toBe('0');
    expect(typeof context.PadSenseiTheory.parseChord).toBe('function');
    expect(typeof context.PadSenseiTheory.analyzeObservedShellUst).toBe('function');

    const with11 = context.PadSenseiTheory.applyTension([0, 4, 7, 10], { add: [5] });
    expect(pitchClasses(Array.from(with11))).toEqual([0, 4, 5, 7, 10]);
  });
});
