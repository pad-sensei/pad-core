# Module boundaries v0

This is a compact companion to `ARCHITECTURE_BROWSER_MODULES.md`.

## `theory`

May depend on: canonical theory data and structured evidence supplied by callers.

Target boundary: must not depend on DOM, SVG, WebAudio, Web MIDI, Push protocol, application state, or product-specific grid layout.

Representative API surface:

```js
parseChord(name)
detectChord(notes, options)
nameChord(result, options)
classifyDegrees(notes, chord)
availableTensions(chord, context)
analyzeObservedShellUst({ chord, notes })
analyzeHarmony(sourceNotes, context)
```

The v1.7 concrete API is `padAnalyzeObservedShellUst({ chord, notes })`. It returns structured layers rather than one formatted string and preserves only actually supplied source notes:

```js
{
  chord: { rootPC, quality, name },
  notes: [
    {
      midi, pc, degree,
      sourceId, deviceId, rawNote, mappedMidi,
      row, col, physicalPadId,
      positionConfidence: 'exact|reconstructed|none'
    }
  ],
  shell: {
    notes: [...],
    degrees: [...],
    confidence: 'physical|register',
    positionConfidence: 'exact|reconstructed|none'
  } | null,
  ust: {
    kind: 'quartal',
    name: 'Q4',
    notes: [...],
    degrees: [...],
    confidence: 'physical|register',
    positionConfidence: 'exact|reconstructed|none'
  } | null,
  positionEvidence: 'exact|reconstructed|none'
}
```

`sourceId` / physical metadata are evidence, not permission for theory to invent notes. A returned Shell/UST source must exist in the observed input.

### Transitional v1.7 exception

`observed-structure.js` currently validates fourths-grid consistency and compact geometry directly so the v1.7 correctness fix can use real physical evidence without waiting for the broader modularization. That is deliberate transitional coupling, not the final ownership model.

The migration target is to move generic grid-consistency / compact-position mechanics into `pad-layout`, while keeping the semantic partition/classification contract and result shape stable.

## `pad-layout`

May depend on: theory types/results.

Owns: grid geometry, physical position, compact pad placement, voicing placement, and generic validation that a claimed physical coordinate system agrees with mapped MIDI.

Representative API:

```js
midiAt(row, col, layout)
positionsForMidi(midi, layout)
findCompactPositions(notes, layout)
validatePositionEvidence(sourceNotes, layout)
partitionByPhysicalCluster(sourceNotes, options)
```

`pad-layout` may describe where notes are. It must not decide what chord, Shell, UST, tension, or harmonic meaning those notes have.

## `pad-render`

May depend on: `theory`, `pad-layout`.

Owns: render state and SVG/string helpers. It does not own chord detection or manufacture missing theory pitches.

## `audio-web`

May depend on: theory output data, but theory never depends on it.

Owns only audition/playback.

## `embed`

May depend on all browser-facing modules. Owns DOM/Web Components and progressive enhancement for static sites. It is a consumer of theory; it must not redefine musical meaning.

## Native parity

Native consumers may not create new theory tables by hand. They consume generated artifacts and/or shared fixtures from canonical theory definitions, with CI making drift visible.

The v1.7 DOJO bridge is an intermediate step: its native detector now has explicit-pitch parity tests and pins the same pad-core SHA, but shared generated tables/golden vectors remain a follow-up task.
