# Incremental modularization checklist

This is intentionally sequenced behind correctness, not instead of it.

## v1.7 correctness gate

- [ ] explicit tensions represent exactly selected/played pitches
- [ ] dim7 availability rule corrected
- [ ] Shell/UST structured semantic API in pad-core
- [ ] 64PE Web consumes corrected API
- [ ] DOJO JS/native parity established

## Module extraction

- [ ] inventory current public functions/data and their consumers
- [ ] classify each symbol as theory / layout / render / compatibility
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

- [ ] 64PE current browser build remains functional during migration
- [ ] Desktop WebUI sync remains functional
- [ ] DOJO submodule consumption remains functional
- [ ] no theory rule duplicated in embed/component layer
