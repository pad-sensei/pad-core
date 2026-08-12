# Native generation / parity contract

## Goal

DOJO and any future native product must not hand-copy musical tables from 64 Pad Explorer or pad-core.

## Near-term contract

1. Canonical declarative theory data lives in pad-core.
2. A generator may emit C++ tables/headers for native consumers.
3. Generated native files are treated as build artifacts or generated source; edits go back to the canonical input.
4. pad-core emits or owns shared golden vectors for parser/detector/tension/Shell/UST cases.
5. Native CI runs the same semantic corpus and makes mismatches visible.

## v1.7 intermediate state

The first cross-runtime drift gate now exists in DOJO PR #100:

- DOJO pins the same structured v1.7 pad-core SHA used by the Web consumer;
- native ChordDetector tests enforce the explicit-pitch contract for single 11, single 13, actual 9+11, and abstract altered handling;
- the permanent self-hosted PR workflow runs native parity together with WebUI and pad-core tests.

This is intentionally an intermediate state, not the completed generation architecture. The native test cases are still maintained in DOJO rather than generated from one shared corpus. The next migration step is to make those fixtures/data mechanically originate from pad-core so semantic changes need one authoritative edit.

## What remains native

Realtime ownership, MIDI/audio scheduling, Push protocol, transport, and UI projection remain native/product code.

Generic detection algorithms may remain native where required for latency/ownership, but their input tables and expected behavior are pinned to pad-core.

Physical source evidence is also a transport concern: if a product does not carry `row`, `col`, `physicalPadId`, `sourceId`, and `positionConfidence` across its native/Web boundary, it must not fabricate exact-position Shell/UST conclusions.

## Drift gate

A theory change is incomplete if:

- pad-core tests pass,
- but a registered native consumer parity suite fails.

Consumer release can be independent, but the incompatibility must be visible and cannot silently ship as an unrelated meaning.
