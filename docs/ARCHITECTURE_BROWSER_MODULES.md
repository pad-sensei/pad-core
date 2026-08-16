# Pad Sensei theory / browser module architecture

Status: design draft. This document does not change product behavior.

## Why this exists

Pad Sensei's musical-theory contract is authored and validated through 64 Pad Explorer, while `pad-core` is the implementation SSOT consumed by the ecosystem. The current repository is already described as the theory SSOT, but its delivery shape is still closer to a shared script directory than a reusable module platform.

That gap has already produced real drift:

- DOJO integrated `WebUI/pad-core` on 2026-07-02.
- On 2026-07-06, DOJO still needed native held-note chord detection for its C++/Push path, so a separate `Source/ChordDetector.cpp` was ported from 64PE.
- On 2026-07-12, DOJO's UST feature was implemented as a faithful copy of the 64PE UST subgraph into `WebUI/ust-detect.js`, explicitly leaving pad-core untouched.
- Later scale-training work used a safer pattern: C++ retained a native representation but a parity test read pad-core's scale data and failed on drift.

The problem was not only discipline. The architecture offered no first-class cross-runtime contract for native consumers and no small public modules for browser consumers. Copying was therefore the shortest implementation path.

## Product invariant

One musical fact must have one semantic source.

Consumers may render, teach, score, animate, or control hardware differently, but they must not redefine chord, scale, tension, Shell, UST, degree, or progression semantics.

A second invariant established for the v1.7 cycle also applies here:

> Never claim a note exists if it was not actually played/selected.

## Target shape

Keep `pad-core` as the repository during migration, but expose explicit browser-native package boundaries. Do not create a large framework dependency.

### 1. Theory kernel — headless and pure

Logical module: `@pad-sensei/theory`

Owns musical meaning only:

- note / pitch-class / spelling helpers
- chord definitions
- chord parsing and naming
- chord detection
- exact explicit tension semantics
- scale definitions and relations
- available-tension rules
- degree classification
- Shell recognition
- triadic / quartal UST recognition
- structured confidence/source metadata

No DOM, Web MIDI, audio, controller protocol, or product state.

### 2. Pad geometry / voicing module

Logical module: `@pad-sensei/pad-layout`

Owns instrument-independent pad mathematics:

- isomorphic grid geometry
- MIDI <-> row/column projection
- compact positions
- voicing placement
- physical/source position structures
- register-aware shape selection

It may consume theory results but must not redefine theory.

### 3. Rendering model

Logical module: `@pad-sensei/pad-render`

Owns pure presentation models and optional SVG helpers:

- chord/scale pad-role classification
- display-ready structured render state
- SVG/string rendering where useful

Keep semantic results separate from HTML strings. A caller must be able to consume the same theory result without using Pad Sensei's UI.

### 4. Progression module

Existing repository: `pad-sensei/pad-progression`.

It remains the portable progression schema / reader / timeline package. Theory-aware progression analysis may consume `@pad-sensei/theory`, but progression storage/timeline concerns should not be folded back into the theory kernel.

### 5. Optional browser audio

Logical module: `@pad-sensei/audio-web`

Owns browser audition only:

- play one note/chord/scale
- simple progression audition
- optional lightweight instrument/sample backend

Theory must never depend on audio.

### 6. Static-site embed layer

Logical module: `@pad-sensei/embed`

Thin Web Components / browser wrappers intended for ordinary static HTML. Candidate components:

- `<pad-chord>` — show a chord on a pad grid
- `<pad-scale>` — show a scale/mode
- `<pad-analyzer>` — accept notes/MIDI and show chord analysis
- `<pad-progression>` — render a progression and corresponding pad forms
- optional play controls when `audio-web` is loaded

The static-site authoring target should support a no-build path such as:

```html
<script type="module" src="/pad-sensei/embed.js"></script>
<pad-chord chord="Cm7(11)" layout="fourths"></pad-chord>
```

and a headless JS path such as:

```js
import { detectChord, parseChord } from '/pad-sensei/theory.js';
```

A blog/article page must not need to load the full 64 Pad Explorer application merely to show one chord or play one example.

## Canonical data, generated artifacts, and native consumers

Cross-language duplication is the key architectural risk.

### Canonical declarative data

Move musical tables that can be represented declaratively into machine-readable canonical files, for example:

- `schema/chords.json`
- `schema/scales.json`
- `schema/tensions.json`
- `schema/ust-rules.json`

Exact file format is an implementation choice, but there must be one source for each table.

Generated JS and C++ tables must not be hand-edited copies.

### Native C++ strategy

DOJO owns realtime/native MIDI/audio and cannot make WebView JavaScript the realtime authority. Therefore the safe near-term model is:

1. pad-core owns canonical theory data and reference semantics;
2. a generator emits native C++ tables / fixtures where necessary;
3. native generic algorithms operate on those generated tables;
4. shared golden vectors generated from pad-core verify JS/native parity in CI.

This is better than manually porting a 600-line chord database.

Do not introduce WASM or a new implementation language merely to remove duplication unless measurement shows the generated-data/parity model is insufficient. A future WASM core remains possible, but it is not a v1.7 prerequisite.

## Distribution targets

The same source should be buildable into:

1. **ESM** — preferred browser/static-site import.
2. **legacy script/global bundle** — compatibility during 64PE/DOJO migration.
3. **test/reference corpus** — JSON fixtures for native parity.
4. **optional generated C++ data** — for DOJO/native consumers.

Current `package.json` is private and exposes no package exports. Migration should add explicit build/export metadata without requiring immediate npm publication. CDN/self-hosted static files are sufficient initially.

## API design rules

- Structured objects first; formatted strings second.
- Pure functions at semantic boundaries.
- Explicit note sets: no implicit textbook completion of 9/11/13.
- Preserve source identity / MIDI / row / col when supplied.
- A result should expose confidence/evidence rather than pretending generic MIDI has exact physical-pad evidence.
- UI and language translation belong above the theory kernel.
- Audio and MIDI I/O belong outside the theory kernel.
- Hardware protocols such as Push Bridge belong outside the theory kernel.

## Suggested migration sequence

### Phase A — v1.7 correctness first

- finish explicit tension correctness
- finish structured Shell/UST API
- update 64PE Web
- update DOJO with JS/native parity

Do not block those bug fixes on module packaging.

### Phase B — freeze public semantic API

Identify the minimum stable headless API used by 64PE and DOJO. Add contract tests for those exports.

### Phase C — canonical data + generators

Replace manually copied native tables with generated data and golden fixtures. Keep native algorithms small and parity-tested.

### Phase D — ESM build

Ship `dist/theory.js`, `dist/pad-layout.js`, `dist/pad-render.js` plus compatibility bundles. No npm publication is required to gain the static-site benefit.

### Phase E — embed components

Build small Web Components on top of the headless modules. Each component must load only the capabilities it needs.

## Release independence

The architecture version is not the 64 Pad Explorer product version. v1.7.0 is the immediate consumer release for theory correctness/Shell/UST; the modularization can proceed incrementally afterward without forcing an application major release for every packaging improvement.
