# Module boundaries v0

This is a compact companion to `ARCHITECTURE_BROWSER_MODULES.md`.

## `theory`

May depend on: canonical theory data only.

Must not depend on: DOM, SVG, WebAudio, Web MIDI, Push, application state, grid layout.

Representative API surface:

```js
parseChord(name)
detectChord(notes, options)
nameChord(result, options)
classifyDegrees(notes, chord)
availableTensions(chord, context)
detectShell(sourceNotes, context)
detectUpperStructure(sourceNotes, context)
analyzeHarmony(sourceNotes, context)
```

`analyzeHarmony` should return structured layers, not one formatted string:

```js
{
  chord: { ... },
  shell: { notes: [...], degrees: [...], confidence: 'exact|register|pitch' },
  ust: { kind: 'quartal', q: 4, notes: [...], degrees: [...], confidence: 'exact|register|pitch' },
  sourceNotes: [...]
}
```

## `pad-layout`

May depend on: theory types/results.

Owns: grid geometry, physical position, compact pad placement, voicing placement.

Representative API:

```js
midiAt(row, col, layout)
positionsForMidi(midi, layout)
findCompactPositions(notes, layout)
partitionByPhysicalCluster(sourceNotes, options)
```

## `pad-render`

May depend on: `theory`, `pad-layout`.

Owns: render state and SVG/string helpers. It does not own chord detection.

## `audio-web`

May depend on: theory output data, but theory never depends on it.

Owns only audition/playback.

## `embed`

May depend on all browser-facing modules. Owns DOM/Web Components and progressive enhancement for static sites.

## Native parity

Native consumers may not create new theory tables by hand. They consume generated artifacts and shared fixtures from the canonical theory definitions.
