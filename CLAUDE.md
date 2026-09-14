# pad-core

## This repo is
Theory calculations, data definitions, and pad rendering pure functions library.
**SSOT for the entire pad ecosystem.**

## Dependencies
None.

## Depends on me
- 64-pad-visualizer (Web)
- master-rhythm-chart (Web)
- 64-pad-clap (future: CLAP plugin)
- 64-pad-vst (future: VST3/AU/Standalone)

## Build type
Library (ES module + script tag compatible via conditional `module.exports`)

## Module structure
| File | Content |
|------|---------|
| `data.js` | Constants: SCALES, KEY_SPELLINGS, BUILDER_QUALITIES, TENSION_ROWS, GRID, etc. |
| `theory.js` | Pure theory functions: voicing, chord naming, parent scale search, etc. |
| `render.js` | SVG pad rendering: grid, boxes, degree names. Uses `PAD = GRID` alias. |

## Conventions
- All shared functions use `pad*` prefix (padPitchClass, padCalcVoicingOffsets, etc.)
- All functions are **pure** — no global state reads, state passed as arguments
- Internal helpers use `_` prefix (_psKeyName, _getParentScaleAbsPCS)
- Browser: loaded via `<script>` tag, functions become globals
- Node: `if (typeof module !== 'undefined') module.exports = {...}`

## Testing
```
npm test        # vitest run (62 tests)
npm run test:watch  # vitest watch mode
```

## 現在地（自動更新）
- 状態: 2026-09-11、root-relative pc8 の和声役割を `b6` / structural `#5` / altered `b13` に分離。`addb13` は自動検出語彙から外し、plain triad + pc8 は必要なら `b6`、`b13` は b7 を含む seventh-chord context でのみ自動解釈する。転回形では complete conventional inversion を unexplained b6/b13 color より優先する。
- 残作業: pad-core consumer（64-pad-visualizer / master-rhythm-chart / Desktop product line）の parity 確認と、1.8.0 release pipeline への exact-SHA 伝播。
- 正規ルール: pad-core が理論計算 SSOT。App 側で chord detection / degree / UST 判定を再定義しない。UST は「shell + upper triad」の教育表示であり、shell がないものを安易に UST と呼ばない。root-relative pc8 は pitch class だけで b6/#5/b13 を同一視しない。clean aug/#5 は structural、plain triad + pc8 は b6 color、b13 は b7 を伴う seventh/altered-tension context で扱う。minor7+b13 candidate を一律に hard-suppress せず、成立する場合は lower-confidence candidate として ranking する。
- 次: 64-pad-visualizer で pc8/inversion consumer tests を更新し、master-rhythm-chart parity を確認する。
- 注意: `△` は UST 分数表示内の major triad marker に限定する。通常 chord display は既存の `maj`/`Maj` 表記規約を維持する。key context に応じて `A#` より `Bb` が自然な場合は flat spelling を優先する。
- 判断待ち: Guitar engine / Double Stop layer の具体 UI 実装順。

## Referential integrity rules
- **This repo is the SSOT for theory calculations.** Write changes here only.
- Changes here affect all dependent apps. Run their tests too.
- App-side code must NOT redefine theory functions. Use thin adapters that call pad-core.
- Integration method: git submodule only. No npm, no copy.
