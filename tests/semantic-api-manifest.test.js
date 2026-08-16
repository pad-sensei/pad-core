import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('../semantic-api.manifest.json', import.meta.url), 'utf8'));
const observed = require('../observed-structure.js');
Object.assign(globalThis, observed);
const { PadSenseiTheory } = require('../semantic-api.js');

const sourceModules = {
  'theory.js': require('../theory.js'),
  'data.js': require('../data.js'),
  'observed-structure.js': observed,
};

describe('semantic API manifest', () => {
  it('matches the runtime namespace exactly', () => {
    const manifestKeys = manifest.symbols.map(symbol => symbol.public).sort();
    expect(manifestKeys).toEqual(Object.keys(PadSenseiTheory).sort());
    expect(new Set(manifestKeys).size).toBe(manifestKeys.length);
    expect(manifest.apiVersion).toBe(PadSenseiTheory.version);
  });

  it('resolves every declared implementation from its canonical source file', () => {
    for (const symbol of manifest.symbols) {
      if (symbol.kind === 'literal') {
        expect(PadSenseiTheory[symbol.public]).toBe(symbol.value);
        continue;
      }
      expect(symbol.kind).toBe('function');
      const sourceModule = sourceModules[symbol.sourceFile];
      expect(sourceModule, symbol.sourceFile).toBeTruthy();
      expect(typeof sourceModule[symbol.source], `${symbol.sourceFile}:${symbol.source}`).toBe('function');
      expect(PadSenseiTheory[symbol.public]).toBe(sourceModule[symbol.source]);
    }
  });

  it('keeps non-theory product layers outside the public boundary', () => {
    expect(manifest.layer).toBe('theory');
    expect(manifest.sourcePolicy).toBe('adapter-only');
    expect(manifest.excludedLayers).toEqual(['render', 'audio', 'midi', 'push', 'dom', 'application']);

    const forbidden = /(render|audio|midi|push|document|window|dom|application)/i;
    for (const symbol of manifest.symbols) {
      expect(symbol.layer === 'theory' || symbol.layer === 'metadata').toBe(true);
      expect(symbol.public).not.toMatch(forbidden);
      if (symbol.source) expect(symbol.source).not.toMatch(forbidden);
    }
  });
});
