# Static-site embed sketches

These examples describe desired ergonomics, not committed API names.

## One chord, no app shell

```html
<script type="module" src="/assets/pad-sensei/embed.js"></script>
<pad-chord chord="C7(13)" show="degrees" playable></pad-chord>
```

## One scale

```html
<pad-scale root="D" scale="dorian" playable></pad-scale>
```

## Analysis-only widget

```html
<pad-analyzer input="midi" show="chord,shell,ust"></pad-analyzer>
```

## Progression + pad forms

```html
<pad-progression progression="Dm7 | G7 | Cmaj7" pads="true" playable></pad-progression>
```

## Headless use

```js
import { detectChord } from '/assets/pad-sensei/theory.js';

const result = detectChord([60, 64, 70, 74]);
```

The article should load only the modules it needs. Audio, MIDI input, and hardware support are optional capabilities rather than requirements of theory/rendering.
