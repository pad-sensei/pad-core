# Native generation / parity contract

## Goal

DOJO and any future native product must not hand-copy musical tables from 64 Pad Explorer or pad-core.

## Near-term contract

1. Canonical declarative theory data lives in pad-core.
2. A generator may emit C++ tables/headers for native consumers.
3. Generated native files are treated as build artifacts or generated source; edits go back to the canonical input.
4. pad-core also emits shared golden vectors for parser/detector/tension/Shell/UST cases.
5. Native CI runs the same vectors and compares semantic results.

## What remains native

Realtime ownership, MIDI/audio scheduling, Push protocol, transport, and UI projection remain native/product code.

Generic detection algorithms may remain native where required for latency/ownership, but their input tables and expected behavior are pinned to pad-core.

## Drift gate

A theory change is incomplete if:

- pad-core tests pass,
- but a registered native consumer parity suite fails.

Consumer release can be independent, but the incompatibility must be visible and cannot silently ship as an unrelated meaning.
