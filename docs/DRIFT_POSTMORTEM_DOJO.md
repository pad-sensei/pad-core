# DOJO / pad-core theory drift postmortem

## What happened

The intended rule was already that pad-core is the shared theory SSOT, but the implementation paths diverged because the SSOT was not yet consumable in every runtime.

Timeline:

1. **2026-07-02** — DOJO integrates `WebUI/pad-core` for browser/WebUI theory/render support.
2. **2026-07-06** — live held-note chord detection is needed in native C++ for Push/runtime use. Instead of consuming generated pad-core data, DOJO ports a separate 64PE `ChordDetector` into `Source/ChordDetector.cpp`.
3. **2026-07-12** — DOJO needs UST display. UST semantics still live in the 64PE application layer rather than pad-core, so DOJO copies the 64PE UST subgraph into `WebUI/ust-detect.js`; the commit explicitly states that pad-core remains untouched.
4. **2026-07-25** — scale-practice code repeats some scale data in C++, but this time adds a parity test that reads pad-core and fails when the native mask differs. This is the safer pattern.

## Root causes

### 1. Runtime split

DOJO's native MIDI/audio/Push path is C++. Browser JavaScript cannot be the realtime native authority, so directly calling WebUI pad-core was not an appropriate solution for held-note detection.

### 2. No generated native artifact

pad-core exposed JavaScript tables/functions, but no canonical cross-runtime schema, generated C++ tables, or shared golden corpus. A manual port was therefore easier than a true dependency.

### 3. Theory still lived partly in 64PE application code

UST was treated as a 64PE feature instead of being extracted into pad-core first. Therefore consumers had no shared API to call.

### 4. "SSOT" was a policy, not a mechanically enforced dependency graph

The repository guide said pad-core was the SSOT, but CI did not universally fail when application-local theory tables appeared. The scale-practice parity test later demonstrated how this can be enforced.

## Corrective actions

- v1.7 moves explicit tension correctness and structured Shell/UST semantics into pad-core.
- DOJO receives JS/native parity tests and must not hand-maintain theory copies.
- Canonical declarative data should generate native tables/fixtures.
- Future theory features are implemented in pad-core before consumer UI code unless the feature is strictly presentation-only.
- Static-site/browser distribution should use explicit ESM modules so consumers can import only the capability they need.
