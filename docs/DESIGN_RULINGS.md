# Design rulings

1. 64 Pad Explorer remains the reference product where musical meaning is exercised and human-reviewed; pad-core is the implementation SSOT for shared theory semantics.
2. DOJO and other products must not maintain independent musical meaning.
3. Browser embeddability is a first-class output, not an afterthought.
4. Headless semantic APIs precede widgets.
5. A static article must be able to embed a small Pad Sensei capability without loading the whole 64PE app.
6. Native consumers use generated data/shared parity rather than handwritten copies.
7. Audio, MIDI I/O, and hardware control are optional layers outside theory.
8. `pad-progression` remains the progression schema/timeline boundary rather than being swallowed into pad-core.
9. Modularization proceeds incrementally after/beside v1.7 correctness and must not delay the bug fix.
