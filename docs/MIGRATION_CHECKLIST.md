# Incremental modularization checklist

This is intentionally sequenced behind correctness, not instead of it.

## v1.7 correctness gate

- [x] explicit tensions represent exactly selected/played pitches (`pad-core` PR #3)
- [x] dim7 availability rule corrected (`pad-core` PR #3)
- [x] Shell/UST structured semantic API in pad-core (`pad-core` PR #4)
- [x] 64PE Web consumes corrected API with physical-source evidence (`64-pad-visualizer` PR #5, stacked on MIDI PR #10)
- [x] DOJO JS/native explicit-pitch parity established (`dojo` PR #100)

The remaining v1.7 gate is human, not architectural: real Push confirmation of physical behavior and final Shell/UST educational display/readability. It must not be replaced by fabricated position evidence in software.

## Module extraction

- [ ] inventory current public functions/data and their consumers
- [ ] classify each symbol as theory / layout / render / compatibility
- [ ] move grid-consistency / compact-position mechanics out of the transitional observed-theory module into `pad-layout` without changing semantic output
- [ ] add ESM entrypoints without removing current script-tag globals
- [ ] add browser import contract tests
- [ ] add canonical data schema for tables that native consumers duplicate
- [ ] generate shared golden corpus
- [ ] migrate DOJO native tables from handwritten copies to generated/parity contract

## Static-site embed

- [ ] minimal `<pad-chord>` component
- [ ] minimal `<pad-scale>` component
- [ ] optional audio capability
- [ ] `<pad-analyzer>` with MIDI optional, not required
- [ ] progression integration using `pad-progression`
- [ ] verify that one component can be embedded without loading the 64PE application shell

## Compatibility

- [x] 64PE current browser build remains functional through the v1.7 shared-core migration
- [ ] Desktop WebUI sync remains functional when it is intentionally moved from the frozen v1.6.14 line
- [x] DOJO submodule consumption remains functional with the v1.7 pin
- [ ] no theory rule duplicated in future embed/component layer
