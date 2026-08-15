import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const observed = require('../observed-structure.js');
const { padAnalyzeObservedShellUst } = observed;

function note(midi, row, col, id, positionConfidence = 'exact') {
  return {
    midi,
    mappedMidi: midi,
    rawNote: midi,
    row,
    col,
    physicalPadId: id,
    sourceId: 'push:' + id,
    deviceId: 'push-1',
    positionConfidence,
  };
}

const canonicalCm7Q4 = () => [
  note(60, 0, 0, 'shell-c'),
  note(63, 0, 3, 'shell-eb'),
  note(70, 2, 0, 'shell-bb'),
  note(77, 3, 2, 'upper-f'),
  note(82, 4, 2, 'upper-bb'),
  note(87, 5, 2, 'upper-eb'),
];

const cm7Shell = () => canonicalCm7Q4().slice(0, 3);

function analyzeCm7(notes) {
  return padAnalyzeObservedShellUst({
    chord: { rootPC: 0, quality: 'm7', name: 'Cm7' },
    notes,
  });
}

describe('v1.7 observed Shell / UST structured API', () => {
  it('classifies actual upper F-Bb-Eb over a lower Cm7 shell as Q4', () => {
    const result = analyzeCm7(canonicalCm7Q4());

    expect(result.shell).not.toBeNull();
    expect(result.shell.degrees).toEqual(['R', 'm3', 'b7']);
    expect(result.shell.notes.map(n => n.physicalPadId)).toEqual(['shell-c', 'shell-eb', 'shell-bb']);
    expect(result.shell.confidence).toBe('physical');

    expect(result.ust).not.toBeNull();
    expect(result.ust.kind).toBe('quartal');
    expect(result.ust.name).toBe('Q4');
    expect(result.ust.degrees).toEqual(['11', 'b7', 'm3']);
    expect(result.ust.notes.map(n => n.midi)).toEqual([77, 82, 87]);
    expect(result.ust.notes.map(n => n.physicalPadId)).toEqual(['upper-f', 'upper-bb', 'upper-eb']);
    expect(result.ust.confidence).toBe('physical');
  });

  it('keeps first-inversion Bb-Eb-F physically identified as Q4', () => {
    const result = analyzeCm7(cm7Shell().concat([
      note(82, 4, 2, 'upper-bb'),
      note(87, 5, 2, 'upper-eb'),
      note(89, 5, 4, 'upper-f'),
    ]));

    expect(result.ust).not.toBeNull();
    expect(result.ust.name).toBe('Q4');
    expect(result.ust.degrees).toEqual(['11', 'b7', 'm3']);
    expect(result.ust.notes.map(n => n.physicalPadId)).toEqual(['upper-f', 'upper-bb', 'upper-eb']);
    expect(result.ust.positionConfidence).toBe('exact');
  });

  it('keeps second-inversion Eb-F-Bb physically identified as Q4', () => {
    const result = analyzeCm7(cm7Shell().concat([
      note(87, 5, 2, 'upper-eb'),
      note(89, 5, 4, 'upper-f'),
      note(94, 6, 4, 'upper-bb'),
    ]));

    expect(result.ust).not.toBeNull();
    expect(result.ust.name).toBe('Q4');
    expect(result.ust.degrees).toEqual(['11', 'b7', 'm3']);
    expect(result.ust.notes.map(n => n.physicalPadId)).toEqual(['upper-f', 'upper-bb', 'upper-eb']);
  });

  it('still names an actual upper C-F-Bb physical structure Q1', () => {
    const result = analyzeCm7(cm7Shell().concat([
      note(84, 4, 4, 'upper-c'),
      note(89, 5, 4, 'upper-f'),
      note(94, 6, 4, 'upper-bb'),
    ]));

    expect(result.ust).not.toBeNull();
    expect(result.ust.name).toBe('Q1');
    expect(result.ust.degrees).toEqual(['R', '11', 'b7']);
    expect(result.ust.notes.map(n => n.physicalPadId)).toEqual(['upper-c', 'upper-f', 'upper-bb']);
  });

  it('never borrows the lower shell root to manufacture Q1', () => {
    const result = analyzeCm7(canonicalCm7Q4());

    expect(result.ust.name).toBe('Q4');
    expect(result.ust.notes.some(n => n.physicalPadId === 'shell-c')).toBe(false);
    expect(result.ust.notes.some(n => n.midi === 60)).toBe(false);
  });

  it('keeps duplicate pitch classes as distinct source notes across shell and UST', () => {
    const result = analyzeCm7(canonicalCm7Q4());

    expect(result.shell.notes.find(n => n.degree === 'm3').midi).toBe(63);
    expect(result.ust.notes.find(n => n.degree === 'm3').midi).toBe(87);
    expect(result.shell.notes.find(n => n.degree === 'b7').midi).toBe(70);
    expect(result.ust.notes.find(n => n.degree === 'b7').midi).toBe(82);
  });

  it('supports a rootless shell when chord context is established externally', () => {
    const notes = canonicalCm7Q4().filter(n => n.physicalPadId !== 'shell-c');
    const result = analyzeCm7(notes);

    expect(result.shell.degrees).toEqual(['m3', 'b7']);
    expect(result.ust.name).toBe('Q4');
    expect(result.ust.degrees).toEqual(['11', 'b7', 'm3']);
  });

  it('does not infer a physical Q4 from the same pitches when exact pad geometry is not compact', () => {
    const notes = canonicalCm7Q4();
    const upperEb = notes.find(n => n.physicalPadId === 'upper-eb');
    upperEb.row = 4;
    upperEb.col = 7;

    const result = analyzeCm7(notes);

    expect(result.shell).not.toBeNull();
    expect(result.ust).toBeNull();
    expect(result.positionEvidence).toBe('exact');
  });

  it('keeps a lower-confidence register fallback for generic MIDI without absolute position', () => {
    const notes = canonicalCm7Q4().map(n => ({
      midi: n.midi,
      rawNote: n.midi,
      mappedMidi: n.midi,
      sourceId: 'generic:' + n.midi,
      positionConfidence: 'none',
    }));
    const result = analyzeCm7(notes);

    expect(result.shell.confidence).toBe('register');
    expect(result.ust.name).toBe('Q4');
    expect(result.ust.confidence).toBe('register');
    expect(result.ust.positionConfidence).toBe('none');
  });

  it('does not promote an inverted generic MIDI voicing to physical certainty', () => {
    const notes = [60, 63, 70, 82, 87, 89].map(midi => ({
      midi,
      rawNote: midi,
      mappedMidi: midi,
      sourceId: 'generic:' + midi,
      positionConfidence: 'none',
    }));
    const result = analyzeCm7(notes);

    expect(result.shell.confidence).toBe('register');
    expect(result.ust).toBeNull();
  });

  it('does not hide partial position evidence by silently falling back to generic MIDI', () => {
    const notes = canonicalCm7Q4();
    notes.find(n => n.physicalPadId === 'upper-eb').positionConfidence = 'none';
    notes.find(n => n.physicalPadId === 'upper-eb').row = null;
    notes.find(n => n.physicalPadId === 'upper-eb').col = null;

    const result = analyzeCm7(notes);

    expect(result.ust).toBeNull();
  });

  it('never returns a Shell/UST note that is absent from source input', () => {
    const input = canonicalCm7Q4();
    const sourceIds = new Set(input.map(n => n.sourceId));
    const result = analyzeCm7(input);

    for (const layer of [result.shell, result.ust]) {
      for (const n of layer.notes) expect(sourceIds.has(n.sourceId)).toBe(true);
    }
  });
});
