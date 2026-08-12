import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSemanticEsm } from '../tools/build-semantic-esm.mjs';

const pitchClasses = (values) => [...new Set(values.map((value) => ((value % 12) + 12) % 12))]
  .sort((a, b) => a - b);

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

describe('generated semantic ESM feasibility', () => {
  it('is deterministic and manifest-driven', async () => {
    const first = await buildSemanticEsm();
    const second = await buildSemanticEsm();

    expect(first.code).toBe(second.code);
    expect(first.manifest.classicSourceLoadOrder).toEqual([
      'data.js',
      'theory.js',
      'observed-structure.js',
      'semantic-api.js',
    ]);

    for (const symbol of first.manifest.symbols) {
      expect(first.code).toContain(`export const ${symbol.public} = PadSenseiTheory.${symbol.public};`);
    }
    expect(first.code).not.toContain('render.js');
    expect(first.code).not.toContain('module.exports');
  });

  it('imports without global pollution and preserves v1.7 semantics', async () => {
    const { code, manifest } = await buildSemanticEsm();
    const dir = await mkdtemp(join(tmpdir(), 'pad-core-semantic-esm-'));
    const file = join(dir, 'pad-sensei-theory.mjs');
    await writeFile(file, code, 'utf8');

    const hadGlobal = Object.prototype.hasOwnProperty.call(globalThis, 'PadSenseiTheory');
    const previousGlobal = globalThis.PadSenseiTheory;
    const sentinel = Object.freeze({ sentinel: true });
    globalThis.PadSenseiTheory = sentinel;

    try {
      const moduleUrl = `${pathToFileURL(file).href}?test=${Date.now()}`;
      const esm = await import(moduleUrl);

      expect(globalThis.PadSenseiTheory).toBe(sentinel);
      const expectedExports = ['PadSenseiTheory', ...manifest.symbols.map((symbol) => symbol.public)].sort();
      expect(Object.keys(esm).sort()).toEqual(expectedExports);
      expect(Object.isFrozen(esm.PadSenseiTheory)).toBe(true);
      expect(esm.version).toBe('0');
      expect(esm.parseChord).toBe(esm.PadSenseiTheory.parseChord);

      const with11 = esm.applyTension([0, 4, 7, 10], { add: [5] });
      expect(pitchClasses(with11)).toEqual([0, 4, 5, 7, 10]);
      expect(pitchClasses(with11)).not.toContain(2);

      const with13 = esm.applyTension([0, 4, 7, 10], { add: [9] });
      expect(pitchClasses(with13)).toEqual([0, 4, 7, 9, 10]);
      expect(pitchClasses(with13)).not.toContain(2);
      expect(pitchClasses(with13)).not.toContain(5);

      expect(esm.dim7AvailableTensionPCs([0, 3, 6, 9])).toEqual([2, 5, 8, 11]);

      const notes = [
        exactSource(60, 0, 0, 'shell-c'),
        exactSource(63, 0, 3, 'shell-eb'),
        exactSource(70, 2, 0, 'shell-bb'),
        exactSource(77, 3, 2, 'upper-f'),
        exactSource(82, 4, 2, 'upper-bb'),
        exactSource(87, 5, 2, 'upper-eb'),
      ];
      const result = esm.analyzeObservedShellUst({
        chord: { rootPC: 0, quality: 'm7', name: 'Cm7' },
        notes,
      });
      expect(result.ust.name).toBe('Q4');
      expect(result.ust.notes.map((note) => note.physicalPadId)).toEqual(['upper-f', 'upper-bb', 'upper-eb']);
    } finally {
      if (hadGlobal) globalThis.PadSenseiTheory = previousGlobal;
      else delete globalThis.PadSenseiTheory;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
