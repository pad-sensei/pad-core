// ========================================
// PAD-CORE — Data & Constants (SSOT)
// Theory calculation data shared across all pad ecosystem apps
// ========================================

const NOTE_NAMES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTE_NAMES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const FLAT_MAJOR_KEYS = new Set([1, 3, 5, 6, 8, 10]); // Db, Eb, F, Gb, Ab, Bb

// ======== SCALES ========
const SCALES = [
  // cn = characteristic notes (intervals that define the mode's color)
  // Diatonic
  {id:0, cat:'○', num:1, name:'Major (Ionian)', pcs:[0,2,4,5,7,9,11], cn:[11]},
  {id:1, cat:'○', num:2, name:'Dorian', pcs:[0,2,3,5,7,9,10], cn:[9]},
  {id:2, cat:'○', num:3, name:'Phrygian', pcs:[0,1,3,5,7,8,10], cn:[1]},
  {id:3, cat:'○', num:4, name:'Lydian', pcs:[0,2,4,6,7,9,11], cn:[6]},
  {id:4, cat:'○', num:5, name:'Mixolydian', pcs:[0,2,4,5,7,9,10], cn:[10]},
  {id:5, cat:'○', num:6, name:'Natural Minor (Aeolian)', pcs:[0,2,3,5,7,8,10], cn:[8]},
  {id:6, cat:'○', num:7, name:'Locrian', pcs:[0,1,3,5,6,8,10], cn:[1,6]},
  // Harmonic Minor
  {id:7, cat:'■', num:1, name:'Harmonic Minor', pcs:[0,2,3,5,7,8,11], cn:[11]},
  {id:8, cat:'■', num:2, name:'Locrian \u266E6', pcs:[0,1,3,5,6,9,10], cn:[9]},
  {id:9, cat:'■', num:3, name:'Ionian #5', pcs:[0,2,4,5,8,9,11], cn:[8]},
  {id:10, cat:'■', num:4, name:'Dorian #4', pcs:[0,2,3,6,7,9,10], cn:[6]},
  {id:11, cat:'■', num:5, name:'Phrygian Dominant', pcs:[0,1,4,5,7,8,10], cn:[1,4]},
  {id:12, cat:'■', num:6, name:'Lydian #2', pcs:[0,3,4,6,7,9,11], cn:[3]},
  {id:13, cat:'■', num:7, name:'Functional Diminish', pcs:[0,1,3,4,6,8,10], cn:[6]},
  // Melodic Minor
  {id:14, cat:'◆', num:1, name:'Melodic Minor', pcs:[0,2,3,5,7,9,11], cn:[9,11]},
  {id:15, cat:'◆', num:2, name:'Dorian b2', pcs:[0,1,3,5,7,9,10], cn:[1]},
  {id:16, cat:'◆', num:3, name:'Lydian #5', pcs:[0,2,4,6,8,9,11], cn:[6,8]},
  {id:17, cat:'◆', num:4, name:'Lydian b7', pcs:[0,2,4,6,7,9,10], cn:[6,10]},
  {id:18, cat:'◆', num:5, name:'Mixolydian b6', pcs:[0,2,4,5,7,8,10], cn:[8]},
  {id:19, cat:'◆', num:6, name:'Locrian \u266E2', pcs:[0,2,3,5,6,8,10], cn:[2]},
  {id:20, cat:'◆', num:7, name:'Super Locrian (Altered)', pcs:[0,1,3,4,6,8,10], cn:[1,6,8]},
  // Pentatonic / Blues / Symmetric
  {id:21, cat:'', num:0, name:'Major Pentatonic', pcs:[0,2,4,7,9], cn:[]},
  {id:22, cat:'', num:0, name:'Minor Pentatonic', pcs:[0,3,5,7,10], cn:[]},
  {id:23, cat:'', num:0, name:'Blues', pcs:[0,3,5,6,7,10], cn:[6]},
  {id:24, cat:'', num:0, name:'Chromatic', pcs:[0,1,2,3,4,5,6,7,8,9,10,11], cn:[]},
  {id:25, cat:'', num:0, name:'Whole Tone', pcs:[0,2,4,6,8,10], cn:[]},
  {id:26, cat:'', num:0, name:'Half-Whole Diminish', pcs:[0,1,3,4,6,7,9,10], cn:[]},
  {id:27, cat:'', num:0, name:'Whole-Half Diminish', pcs:[0,2,3,5,6,8,9,11], cn:[]},
  // Bebop Scales (8 notes) - cn = passing tone
  {id:28, cat:'♪', num:0, name:'Bebop Major', pcs:[0,2,4,5,7,8,9,11], cn:[8]},
  {id:29, cat:'♪', num:0, name:'Bebop Dominant (Mixolydian)', pcs:[0,2,4,5,7,9,10,11], cn:[11]},
  {id:30, cat:'♪', num:0, name:'Bebop Dorian', pcs:[0,2,3,4,5,7,9,10], cn:[4]},
];

// ======== SCALE FULL NAMES (スケールの本名) ========
// テンションを全部含めたコードネームは、そのスケールの「別名」に過ぎない。
// スケールを全部押さえたら、この名前のコードになる (アボイドを考慮しなければ、
// どのモードもコードネームで表せる)。
//
// 出典: うりなみさん提供資料 2026-07-26「コードの本名 / テンション・ノートの
// 順列組み合わせ」+ 公開記事「スケールは和音で作れる」。
// うりなみさん「コードの本名というか、スケールの本名だよね」。
//
// 値の根拠:
//   - 資料に表があるモード (id 0,1,3,4,5,11 と 16,17,18,20 相当) はその写し
//   - それ以外は pcs から機械的に導出し、うりなみさんが判定したもの
//   - 5音スケールは例外的 (うりなみさん「5音スケールでちょっと例外ではあるよね」)。
//     メジャーペンタ = 6/9、マイナーペンタ = m7(11)、ブルース = マイナーペンタ + ♭5
//     をテンション表記にした m7(#11, 11)
//
// オルタードとホールトーンは完全5度を持たない。同じ音を ♭5 とも #11 とも書けるが、
// 2つで書き分ける (うりなみさん 2026-07-26):
//   オルタード   -> (b5)。「実践的には#11というより、5度がないという方が
//                  アドリブとして大事なの」
//   ホールトーン -> #11。「#11のほうがみんなわかる。対称スケールと知ってるから」
//
// key = SCALES[].id。表に無い id は本名を持たない (未確定であって、無いという
// 意味ではない)。
const SCALE_FULL_NAMES = {
  0:  '\u25b37(13, 11, 9)',        // Major (Ionian)
  1:  'm7(13, 11, 9)',             // Dorian
  2:  'm7(b13, 11, b9)',           // Phrygian
  3:  '\u25b37(13, #11, 9)',       // Lydian
  4:  '7(13, 11, 9)',              // Mixolydian
  5:  'm7(b13, 11, 9)',            // Natural Minor (Aeolian)
  6:  'm7(b5)(b13, 11, b9)',       // Locrian
  7:  'mMaj7(b13, 11, 9)',         // Harmonic Minor
  11: '7(b13, 11, b9)',            // Phrygian Dominant
  14: 'mMaj7(13, 11, 9)',          // Melodic Minor
  17: '7(13, #11, 9)',             // Lydian b7
  18: '7(b13, 11, 9)',             // Mixolydian b6
  20: '7(b5)(b13, #9, b9)',        // Super Locrian (Altered)
  21: '6/9',                       // Major Pentatonic
  22: 'm7(11)',                    // Minor Pentatonic
  23: 'm7(#11, 11)',               // Blues
  25: '7(b13, #11, 9)',            // Whole Tone
  26: '7(13, #11, #9, b9)',        // Half-Whole Diminish
};

// ======== ENHARMONIC SPELLING (circle of fifths) ========
const KEY_SPELLINGS = [
  NOTE_NAMES_FLAT,  // C  (jazz convention: flats)
  NOTE_NAMES_FLAT,  // Db (5b)
  NOTE_NAMES_SHARP, // D  (2#)
  NOTE_NAMES_FLAT,  // Eb (3b)
  NOTE_NAMES_SHARP, // E  (4#)
  NOTE_NAMES_FLAT,  // F  (1b)
  ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','Cb'], // Gb (6b: Cb not B)
  NOTE_NAMES_SHARP, // G  (1#)
  NOTE_NAMES_FLAT,  // Ab (4b)
  NOTE_NAMES_SHARP, // A  (3#)
  NOTE_NAMES_FLAT,  // Bb (2b)
  NOTE_NAMES_SHARP, // B  (5#)
];

// ======== QUALITY DEFINITIONS (Chord Builder Step 2) ========
// 4x3 grid matching Clover Chord Systems
const BUILDER_QUALITIES = [
  // Row 0 — triads: major / minor / diminished
  [{name:'', label:'Maj', pcs:[0,4,7]}, {name:'m', label:'m', pcs:[0,3,7]}, {name:'dim', label:'dim', pcs:[0,3,6]}],
  // Row 1 — 6th family + diminished 7th
  [{name:'6', label:'6', pcs:[0,4,7,9]}, {name:'m6', label:'m6', pcs:[0,3,7,9]}, {name:'dim7', label:'dim7', pcs:[0,3,6,9]}],
  // Row 2 — 7th family + half-diminished
  [{name:'7', label:'7', pcs:[0,4,7,10]}, {name:'m7', label:'m7', pcs:[0,3,7,10]}, {name:'m7(b5)', label:'m7⁻⁵', pcs:[0,3,6,10]}],
  // Row 3 — maj7 family + 7sus4
  [{name:'Maj7', label:'Maj7', pcs:[0,4,7,11]}, {name:'mMaj7', label:'mMaj7', pcs:[0,3,7,11]}, {name:'7sus4', label:'7sus4', pcs:[0,5,7,10]}],
  // Row 4 — other / non-tertian: sus (=sus4; sus2 is its inversion) / augmented / [空].
  // 4度堆積 (So What) は Quality ではなくボイシング技法なので TASTY 側 (So What recipe) に移管。
  // 3列目は null = 空セル (padBuildQualityGrid が .quality-btn.empty として描画、レイアウト維持)。
  [{name:'sus4', label:'sus', pcs:[0,5,7]}, {name:'aug', label:'aug', pcs:[0,4,8]}, null],
];

// ======== TENSION DEFINITIONS (Chord Builder Step 3) ========
const TENSION_ROWS = [
  // Row 0 — 2026-05-19: sus4 / sus2 を BUILDER_QUALITIES Row 4 (sus 系統) に集約、 Tension 行から削除
  [
    {label:'aug', mods:{sharp5:true}},
    {label:'6', mods:{add:[9]}},
    {label:'9', mods:{add:[2]}},
    {label:'11', mods:{add:[2,5]}},
    {label:'13', mods:{add:[9]}},
    {label:'(9,13)', mods:{add:[2,9]}},
  ],
  // Row 1
  [
    {label:'add9', mods:{add:[2]}},
    {label:'b5', mods:{flat5:true}},
    {label:'6(9)', mods:{add:[9,2]}},
    {label:'b9', mods:{add:[1]}},
    {label:'#11', mods:{add:[6]}},
    {label:'b13', mods:{add:[8]}},
  ],
  // Row 2
  [
    {label:'aug\n(9)', mods:{add:[2], sharp5:true}},
    {label:'6(9,#11)', mods:{add:[6,9,2]}},
    {label:'#9', mods:{add:[3]}},
    {label:'(9)\n(11)', mods:{add:[5,2]}},
    {label:'(11)\n(13)', mods:{add:[9,5]}},
  ],
  // Row 3
  [
    {label:'sus4\n(9)', mods:{replace3:5, add:[2]}},
    {label:'b5\n(b9)', mods:{add:[1], flat5:true}},
    null,
    null,
    {label:'(b11)\n(b13)', mods:{add:[8,4]}},
    null,
    null,
    null,
  ],
  // Row 4
  [
    {label:'sus4\n(b9)', mods:{replace3:5, add:[1]}},
    {label:'aug\n(b9)', mods:{sharp5:true, add:[1]}},
    null,
    {label:'(9)\n(#11)', mods:{add:[6,2]}},
    {label:'(#11)\n(b13)', mods:{add:[8,6]}},
    null,
    null,
    null,
  ],
  // Row 5
  [
    {label:'(#9)\n(#11)', mods:{add:[3,6]}},
    null,
    {label:'(9)\n(#11)\n(13)', mods:{add:[9,2,6]}},
    null,
    null,
    null,
    null,
    null,
  ],
  // Row 6
  [
    null,
    {label:'aug\n(#9)', mods:{add:[3], sharp5:true}},
    {label:'b5\n(#9)', mods:{add:[3], flat5:true}},
    {label:'(9)\n(b13)', mods:{add:[8,2]}},
    {label:'(b9)\n(13)', mods:{add:[1,9]}},
    null,
    null,
    null,
  ],
  // Row 7
  [
    null,
    null,
    null,
    {label:'(b9)\n(b13)', mods:{add:[8,1]}},
    {label:'(#9)\n(b13)', mods:{add:[3,8]}},
    null,
    null,
    null,
  ],
  // Row 8
  [
    null,
    null,
    null,
    {label:'(b9)\n(#9)\n(b13)', mods:{add:[8,1,3]}},
    null,
    null,
    null,
    null,
  ],
];

// ======== DEGREE NAME ↔ SEMITONE ========
// Complete mapping: chord tones + tensions + enharmonic aliases (superset of TENSION_NAME_TO_PC)
var DEGREE_TO_SEMITONE = {
  '1':0, 'b9':1, '9':2, '#9':3, 'b3':3, '3':4, '11':5,
  '#11':6, 'b5':6, '5':7, '#5':8, 'b13':8, '13':9, '6':9,
  'b7':10, '7':11, 'bb7':9
};

// ======== AVAILABLE TENSIONS PER SCALE ========
const PC_TO_TENSION_NAME = { 1:'b9', 2:'9', 3:'#9', 5:'11', 6:'#11', 8:'b13', 9:'13' };
const TENSION_NAME_TO_PC = { 'b9':1, '9':2, '#9':3, '11':5, '#11':6, 'b13':8, '13':9 };

const SCALE_AVAIL_TENSIONS = {
  // === Diatonic ===
  0:  { avail:['9','13'], avoid:['11'] },
  1:  { avail:['9','11','13'] },
  2:  { avail:['11'], avoid:['b9','b13'] },
  3:  { avail:['9','#11','13'] },
  4:  { avail:['9','13'], avoid:['11'] },
  5:  { avail:['9','11'], avoid:['b13'] },
  6:  { avail:['11','b13'], avoid:['b9'] },
  // === Harmonic Minor ===
  7:  { avail:['9','11','b13'] },
  8:  { avail:['11','13'], avoid:['b9'] },
  9:  { avail:['9','13'], avoid:['11'] },
  10: { avail:['9','#11','13'] },
  11: { avail:['b9','b13'], avoid:['11'] },
  12: { avail:['#11','13'] },
  13: { avail:['11','b13'] },
  // === Melodic Minor ===
  14: { avail:['9','11','13'] },
  15: { avail:['11','b13'], avoid:['b9'] },
  16: { avail:['9','#11','13'] },
  17: { avail:['9','#11','13'] },
  18: { avail:['9','b13'], avoid:['11'] },
  19: { avail:['9','11'] },
  20: { avail:['b9','#9','#11','b13'] },
  // === Symmetric / Special ===
  25: { avail:['9','#11','b13'] },
  26: { avail:['b9','#9','#11','13'] },
  27: { avail:['9','11','b13'] },
  // === Bebop (inherit from parent) ===
  28: { avail:['9','13'], avoid:['11'] },
  29: { avail:['9','13'], avoid:['11'] },
  30: { avail:['9','11','13'] },
};

// ======== CHORD NAME PARSING DATA ========

// Root note name → pitch class (0-11)
var PAD_ROOT_TO_PC = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

// Quality string → intervals (semitones from root)
// Sorted by key length desc for longest-match parsing
var PAD_QUALITY_INTERVALS = {
  // Multi-tension combinations
  '7(b9,b13)':  [0, 4, 7, 10, 13, 20],
  '7(#9,b13)':  [0, 4, 7, 10, 15, 20],
  '7(9,b13)':   [0, 4, 7, 10, 14, 20],
  '7(b9,#11)':  [0, 4, 7, 10, 13, 18],
  '7(#9,#11)':  [0, 4, 7, 10, 15, 18],
  '7(9,#11)':   [0, 4, 7, 10, 14, 18],
  '6(9,#11)':   [0, 4, 7, 9, 14, 18],
  '6.9(#11)':   [0, 4, 7, 9, 14, 18],
  'm6(11)':     [0, 3, 7, 9, 17],
  'm6.11':      [0, 3, 7, 9, 17],
  'm6(9)':      [0, 3, 7, 9, 14],
  '6(9)':       [0, 4, 7, 9, 14],
  '6.9':        [0, 4, 7, 9, 14],
  '7(9,13)':    [0, 4, 7, 10, 14, 21],
  'maj7(#11)':  [0, 4, 7, 11, 18],
  '\u25B37(#11)': [0, 4, 7, 11, 18],
  // m7b5 + tensions
  'm7(b5,11)(omit3)': [0, 6, 10, 17],
  'm7b5(b13)':  [0, 3, 6, 10, 20],
  'm7b5(11)':   [0, 3, 6, 10, 17],
  'm7b5(9)':    [0, 3, 6, 10, 14],
  // maj7 + tensions
  'maj7(13)':   [0, 4, 7, 11, 21],
  'maj7(9)':    [0, 4, 7, 11, 14],
  // m7 + tensions
  'm7(13)':     [0, 3, 7, 10, 21],
  'm7(11)':     [0, 3, 7, 10, 17],
  'm7(9)':      [0, 3, 7, 10, 14],
  // 7 + tension explicit form
  '7(13)':      [0, 4, 7, 10, 14, 21],
  '7(11)':      [0, 4, 7, 10, 14, 17],
  '7(9)':       [0, 4, 7, 10, 14],
  // Quartal (4th stacking)
  'quartal':    [0, 5, 10, 15],
  // 4-5 char qualities
  '7sus4':  [0, 5, 7, 10],
  'm7b5':   [0, 3, 6, 10],
  'm7-5':   [0, 3, 6, 10],
  'madd#11': [0, 3, 7, 18],
  'madd11': [0, 3, 7, 17],
  'madd9':  [0, 3, 7, 14],
  'add#11': [0, 4, 7, 18],
  'addb13': [0, 4, 7, 20],
  'add11':  [0, 4, 7, 17],
  'add9':   [0, 4, 7, 14],
  'aug7':   [0, 4, 8, 10],
  '7alt':   [0, 4, 6, 10, 13, 15],
  'dim7':   [0, 3, 6, 9],
  'maj9':   [0, 4, 7, 11, 14],
  'maj7':   [0, 4, 7, 11],
  'min9':   [0, 3, 7, 10, 14],
  'min7':   [0, 3, 7, 10],
  'sus4':   [0, 5, 7],
  'sus2':   [0, 2, 7],
  // Parenthesized tensions
  'm7(b5)': [0, 3, 6, 10],
  '7(b9)':  [0, 4, 7, 10, 13],
  '7(#9)':  [0, 4, 7, 10, 15],
  '7(#11)': [0, 4, 7, 10, 18],
  '7(b13)': [0, 4, 7, 10, 20],
  '7(#5)':  [0, 4, 8, 10],
  '7(b5)':  [0, 4, 6, 10],
  // Unicode / special symbols
  'm\u25B37': [0, 3, 7, 11],  // m△7
  '\u25B39':  [0, 4, 7, 11, 14], // △9
  '\u25B37':  [0, 4, 7, 11],  // △7
  '\u00F87':  [0, 3, 6, 10],  // ø7
  '\u00B07':  [0, 3, 6, 9],   // °7
  // Short forms
  'mMaj7': [0, 3, 7, 11],
  'mM7':  [0, 3, 7, 11],
  'm6/9': [0, 3, 7, 9, 14],
  '6/9(#11)': [0, 4, 7, 9, 14, 18],
  '6/9':  [0, 4, 7, 9, 14],
  '7#9':  [0, 4, 7, 10, 15],
  '7b9':  [0, 4, 7, 10, 13],
  '7#5':  [0, 4, 8, 10],
  '7b5':  [0, 4, 6, 10],
  'maj':  [0, 4, 7],
  'M9':   [0, 4, 7, 11, 14],
  'M7':   [0, 4, 7, 11],
  // 3 char
  'dim':  [0, 3, 6],
  'aug':  [0, 4, 8],
  // 2 char
  'm9':   [0, 3, 7, 10, 14],
  'm7':   [0, 3, 7, 10],
  'm6':   [0, 3, 7, 9],
  '13':   [0, 4, 7, 10, 14, 21],
  '11':   [0, 4, 7, 10, 14, 17],
  // 1 char
  '9':    [0, 4, 7, 10, 14],
  '7':    [0, 4, 7, 10],
  '6':    [0, 4, 7, 9],
  'q':    [0, 5, 10, 15],
  'h':    [0, 3, 6, 10],
  '\u00F8': [0, 3, 6, 10],    // ø
  '\u00B0': [0, 3, 6],        // °
  '+':    [0, 4, 8],
  '-':    [0, 3, 7],          // minus = minor
  'm':    [0, 3, 7],
  // Empty = major triad
  '':     [0, 4, 7],
};

// Pre-sorted keys for matching (longest first)
var PAD_QUALITY_KEYS = Object.keys(PAD_QUALITY_INTERVALS).sort(function(a, b) { return b.length - a.length; });

// Alias → canonical display name (shortcuts that should show the real name)
var PAD_QUALITY_DISPLAY = {
  'h':   'm7b5',
  'q':   'quartal',
  '-':   'm',
  '+':   'aug',
  '\u00F8': 'm7b5',  // ø
  '\u00B0': 'dim',   // °
  'M7':  'maj7',
  '\u25B37': 'Maj7',
  'm\u25B37': 'mMaj7',
  'mMaj7': 'mMaj7',
  'mM7': 'mMaj7',
  '6/9': '6(9)',
  '6.9': '6(9)',
  '6/9(#11)': '6(9,#11)',
  '6.9(#11)': '6(9,#11)',
  'm6/9': 'm6(9)',
  'm6.11': 'm6(11)',
};

// ======== PAD GRID CONSTANTS ========
const GRID = {
  ROWS: 8, COLS: 8,
  BASE_MIDI: 36, ROW_INTERVAL: 5, COL_INTERVAL: 1,
  PAD_SIZE: 62, PAD_GAP: 4, MARGIN: 20,
};

const GRID_32 = {
  ROWS: 4, COLS: 8,
  BASE_MIDI: 36, ROW_INTERVAL: 5, COL_INTERVAL: 1,
  PAD_SIZE: 0, PAD_GAP: 4, MARGIN: 8,
};

const SCALE_DEGREE_NAMES = ['R','b2','2','b3','3','4','b5','5','b6','6','b7','7'];

// Instrument diagram color palette (Okabe-Ito colorblind-safe)
const PAD_INST_COLORS = {
  root: '#E69F00',          // amber (matches --pad-root)
  rootText: '#000',
  bass: '#ff9800',          // orange (matches pad bass)
  bassText: '#000',
  guide3: '#CC79A7',        // pink (matches --pad-guide3)
  guide7: '#009E73',        // green (matches --pad-guide7)
  tension: '#0072B2',       // blue (matches --pad-tension)
  avoid: '#D55E00',         // red-orange (matches --pad-avoid)
  omitted: '#555',          // dim gray (matches --pad-omitted)
  chord: '#56B4E9',         // sky blue (matches --pad-chord)
  overlay: '#56B4E9',       // sky blue (scale overlay)
  overlayChar: '#F0E442',   // yellow (characteristic note overlay)
  overlayText: '#aaa',
  padRange: '#56B4E9',      // pad range highlight
  mute: '#D55E00',          // mute X mark
  // Piano-specific (white/black key color variants)
  pianoChordWhite: '#90CAF9',     // active chord tone on white key
  pianoChordBlack: '#4A90D9',     // active chord tone on black key
  pianoOverlayWhite: '#b8d8ec',   // overlay on white key
  pianoOverlayCharWhite: '#e8dfa0', // overlay char on white key
  charNote: '#F0E442',            // characteristic note (scale mode)
};

// Standard guitar tuning (high to low): E4, B3, G3, D3, A2, E2
const PAD_GUITAR_TUNING = [64, 59, 55, 50, 45, 40];
const PAD_GUITAR_NAMES  = ['E', 'B', 'G', 'D', 'A', 'E'];

// Standard bass tuning (high to low): G2, D2, A1, E1
const PAD_BASS_TUNING = [43, 38, 33, 28];
const PAD_BASS_NAMES  = ['G', 'D', 'A', 'E'];


// ======== CHORD DETECTION DATABASE ========
// Built from BUILDER_QUALITIES + tension extensions for chord detection

function padBuildChordDetectDB() {
  var db = [];
  BUILDER_QUALITIES.flat().forEach(function(q) {
    if (!q) return;
    db.push({ name: q.name || 'Maj', pcs: q.pcs, pcsSet: new Set(q.pcs) });
  });

  // sus2 is not a builder quality (it is an inversion of the sus4 a 5th up),
  // but it should still be recognized by chord detection.
  db.push({ name: 'sus2', pcs: [0, 2, 7], pcsSet: new Set([0, 2, 7]) });

  function addGeneratedTensionChords(baseName, basePcs, groups) {
    function search(groupIdx, picked) {
      if (groupIdx === groups.length) {
        if (picked.length === 0) return;
        var pcs = basePcs.slice();
        picked.forEach(function(label) {
          var pc = TENSION_NAME_TO_PC[label];
          if (pc !== undefined && pcs.indexOf(pc) < 0) pcs.push(pc);
        });
        db.push({
          name: baseName + '(' + picked.join(',') + ')',
          pcs: pcs,
          pcsSet: new Set(pcs)
        });
        return;
      }

      search(groupIdx + 1, picked);
      groups[groupIdx].forEach(function(label) {
        search(groupIdx + 1, picked.concat([label]));
      });
    }

    search(0, []);
  }

  // Generate 1-3 tension combinations so detection keeps up with article-use
  // voicings such as C7(b9,#11,13), C7(#9,#11,b13), Cm7(9,11,13).
  addGeneratedTensionChords('7', [0,4,7,10], [
    ['b9','9','#9'],
    ['11','#11'],
    ['b13','13']
  ]);
  addGeneratedTensionChords('m7', [0,3,7,10], [
    ['b9','9'],
    ['11'],
    ['13']
  ]);
  addGeneratedTensionChords('Maj7', [0,4,7,11], [
    ['9'],
    ['11','#11'],
    ['13']
  ]);
  addGeneratedTensionChords('m7(b5)', [0,3,6,10], [
    ['9'],
    ['11'],
    ['b13']
  ]);

  var tensionChords = [
    // Practical jazz omissions
    { name: 'm7(b5,11)(omit3)', pcs: [0,6,10,5] },
    // 9th chords
    { name: '7(9)', pcs: [0,4,7,10,2] },
    { name: 'm7(9)', pcs: [0,3,7,10,2] },
    { name: 'Maj7(9)', pcs: [0,4,7,11,2] },
    { name: '6(9)', pcs: [0,4,7,9,2] },
    { name: '6(9,#11)', pcs: [0,4,7,9,2,6] },
    { name: 'm6(9)', pcs: [0,3,7,9,2] },
    { name: 'm6(11)', pcs: [0,3,7,9,5] },
    { name: '7(b9)', pcs: [0,4,7,10,1] },
    { name: '7(#9)', pcs: [0,4,7,10,3] },
    { name: 'm7(b9)', pcs: [0,3,7,10,1] },
    // 11th chords
    { name: '7(9,11)', pcs: [0,4,7,10,2,5] },
    { name: 'm7(9,11)', pcs: [0,3,7,10,2,5] },
    { name: 'Maj7(9,#11)', pcs: [0,4,7,11,2,6] },
    { name: 'Maj7(b9,#11)', pcs: [0,4,11,1,6] },
    { name: '7(#11)', pcs: [0,4,7,10,6] },
    // 13th chords
    { name: '7(9,13)', pcs: [0,4,7,10,2,9] },
    { name: 'm7(9,13)', pcs: [0,3,7,10,2,9] },
    { name: 'Maj7(9,13)', pcs: [0,4,7,11,2,9] },
    { name: '7(b13)', pcs: [0,4,7,10,8] },
    // Combined tensions
    { name: '7(9,#11)', pcs: [0,4,7,10,2,6] },
    { name: '7(9,b13)', pcs: [0,4,7,10,2,8] },
    { name: '7(b9,#11)', pcs: [0,4,7,10,1,6] },
    { name: '7(b9,b13)', pcs: [0,4,7,10,1,8] },
    { name: '7(b9,#9,b13)', pcs: [0,4,7,10,1,3,8] },
    { name: '7(#9,b13)', pcs: [0,4,7,10,3,8] },
    { name: '7(b9,13)', pcs: [0,4,7,10,1,9] },
    { name: '7(#9,13)', pcs: [0,4,7,10,3,9] },
    { name: '7(#11,13)', pcs: [0,4,7,10,6,9] },
    { name: '7(9,#11,13)', pcs: [0,4,7,10,2,6,9] },
    { name: '7(b9,#11,13)', pcs: [0,4,7,10,1,6,9] },
    // Compact combined tensions (no 5th)
    { name: '7(9,#11)', pcs: [0,4,10,2,6] },
    { name: '7(9,b13)', pcs: [0,4,10,2,8] },
    { name: '7(9,13)', pcs: [0,4,10,2,9] },
    { name: '7(b9,#11)', pcs: [0,4,10,1,6] },
    { name: '7(b9,b13)', pcs: [0,4,10,1,8] },
    { name: '7(b9,#9,b13)', pcs: [0,4,10,1,3,8] },
    { name: '7(b9,13)', pcs: [0,4,10,1,9] },
    { name: '7(#9,b13)', pcs: [0,4,10,3,8] },
    { name: '7(#9,13)', pcs: [0,4,10,3,9] },
    { name: '7(#11,13)', pcs: [0,4,10,6,9] },
    // Compact tension voicings (no 5th)
    { name: '7(13)', pcs: [0,4,10,9] },
    { name: 'm7(13)', pcs: [0,3,10,9] },
    { name: 'Maj7(13)', pcs: [0,4,11,9] },
    { name: '7(11)', pcs: [0,4,10,5] },
    { name: 'm7(11)', pcs: [0,3,10,5] },
    { name: '7(9)', pcs: [0,4,10,2] },
    { name: 'm7(9)', pcs: [0,3,10,2] },
    { name: 'Maj7(9)', pcs: [0,4,11,2] },
    // sus chords
    { name: 'sus4', pcs: [0,5,7] },
    { name: 'sus2', pcs: [0,2,7] },
    { name: '7sus4', pcs: [0,5,7,10] },
    { name: '7sus4(9)', pcs: [0,5,7,10,2] },
    { name: '7sus4(9)', pcs: [0,5,10,2] },
    { name: '7sus4(9,13)', pcs: [0,5,7,10,2,9] },
    { name: '7sus4(9,13)', pcs: [0,5,10,2,9] },
    { name: '7sus4(b9)', pcs: [0,5,7,10,1] },
    { name: '7sus4(b9)', pcs: [0,5,10,1] },
    // add chords
    { name: 'add9', pcs: [0,4,7,2] },
    { name: 'add11', pcs: [0,4,7,5] },
    { name: 'add#11', pcs: [0,4,7,6] },
    { name: 'addb13', pcs: [0,4,7,8] },
    { name: 'madd9', pcs: [0,3,7,2] },
    { name: 'madd11', pcs: [0,3,7,5] },
    { name: 'madd#11', pcs: [0,3,7,6] },
  ];
  tensionChords.forEach(function(c) {
    db.push({ name: c.name, pcs: c.pcs, pcsSet: new Set(c.pcs) });
  });
  return db;
}
var CHORD_DETECT_DB = padBuildChordDetectDB();

var TRIAD_DETECT_DB = [
  { name: 'Maj', pcs: [0,4,7] },
  { name: 'm', pcs: [0,3,7] },
  { name: 'dim', pcs: [0,3,6] },
  { name: 'aug', pcs: [0,4,8] },
  { name: 'sus4', pcs: [0,5,7] },
  { name: 'sus2', pcs: [0,2,7] },
];

var TETRAD_DETECT_DB = [
  { name: 'Maj7', pcs: [0,4,7,11] },
  { name: '7', pcs: [0,4,7,10] },
  { name: 'm7', pcs: [0,3,7,10] },
  { name: 'mMaj7', pcs: [0,3,7,11] },
  { name: 'm7(b5)', pcs: [0,3,6,10] },
  { name: 'dim7', pcs: [0,3,6,9] },
  { name: '6', pcs: [0,4,7,9] },
  { name: 'm6', pcs: [0,3,7,9] },
  { name: '7sus4', pcs: [0,5,7,10] },
];

// ======== COLOR THEME (Okabe-Ito colorblind-safe) ========

var PAD_THEME_OKABE_ITO = {
  root:     '#E69F00',
  bass:     '#ff9800',
  guide3:   '#009E73',
  guide7:   '#CC79A7',
  tension:  '#56B4E9',
  chord:    '#56B4E9',
  inactive: '#2a2a3e',
  mute:     '#D55E00',
};

// ======== GUITAR REFERENCE VOICINGS ========
// Human-verified chord forms organized by tuning → "rootPC|intervals" → fret strings.
// Fret format: high E → low E, 0-9 = fret, a=10 b=11 c=12, x = mute.
// Source: curated from standard chord references, converted to pad-core format.
// Used by padEnumGuitarChordForms for reference bonus scoring.
// Keyed by tuning name for future open tuning support (DADGAD, Open G, etc.)
var PAD_GUITAR_REFERENCE_FORMS = {
  "standard": {
    "0|0,2,7": ["31003x","33003x","335533","8870x8"],
    "0|0,3,6": ["21x13x","x4543x","x78x68","bxbaxx"],
    "0|0,3,6,10": ["x4343x","6454xx","8b8a98","bbbaxx"],
    "0|0,3,6,9": ["2121xx","24243x","x787x8","babaxx"],
    "0|0,3,7": ["31013x","345533","xx5568","888aa8"],
    "0|0,3,7,11": ["x0013x","344533","8889a8","bccaxx"],
    "0|0,4,6,10": ["2132xx","x5343x","0798x8","cbbaxx"],
    "0|0,4,7": ["01023x","35553x","8555xx","889aa8"],
    "0|0,4,7,10": ["01323x","35353x","6555xx","8898a8"],
    "0|0,4,7,10,13": ["32323x","xx6878","9898x8","9b9axx"],
    "0|0,4,7,10,14": ["030230","333233","887878","a878a8","ab9axx"],
    "0|0,4,7,10,14,18": ["23323x","35343x","877878","cbbaxx"],
    "0|0,4,7,10,15": ["x4323x","04353x","b898a8","bb9axx"],
    "0|0,4,7,10,21": ["55323x","553333","687778","8a98a8"],
    "0|0,4,7,11": ["000233","354533","7555xx","cccaxx"],
    "0|0,4,7,11,14": ["00003x","x34233","755550","a899x8"],
    "0|0,4,7,14": ["33023x","03023x","03003x","080078","a89axx"],
    "0|0,4,7,9": ["01223x","55553x","x897x8","8a9ax8"],
    "0|0,4,7,9,14": ["33223x","55003x","887778","aa9aax"],
    "0|0,4,8": ["x1123x","x5563x","x55678","899axx"],
    "0|0,4,8,10": ["4x323x","45363x","0998x8","cbdaxx"],
    "0|0,5,7": ["11033x","365533","860x88","88aaa8"],
    "0|0,5,7,10": ["11333x","363533","6655xx","88a8a8"],
    "10|0,4,7": ["13331x","x33356","667886","aba88x"],
    "10|0,4,7,10": ["13131x","667686","a9a88x","xbdcdx"],
    "10|0,4,7,11": ["13231x","5333xx","667786","aaa88x"],
    "11|0,3,6,10": ["x3232x","x677x7","7a7987","aaa9xx"],
    "11|0,4,7,10": ["20212x"],
    "1|0,3,7": ["x2124x","456644","9x6679","999bb9"],
    "1|0,3,7,10": ["x999x9","45464x","7566xx","9999b9","ccdbxx"],
    "2|0,2,7": ["0320xx","5322xx","557755","aa777x"],
    "2|0,3,7": ["1320xx","567755","x6778x","aaacca"],
    "2|0,3,7,10": ["xaaaxa","1120xx","56575x","8677xx","aaaaca"],
    "2|0,3,7,10,14": ["012001","55535x","06575x","caaaca"],
    "2|0,4,7": ["2320xx","23245x","57775x","aabcca"],
    "2|0,4,7,10": ["2120xx","x3545x","575755","aabaca"],
    "2|0,4,7,10,14": ["555455","87707x","xa9a9a","cabaca"],
    "2|0,5,7": ["3320xx","53005x","587755","aaccca"],
    "4|0,3,7": ["000220","354220","78997x","xx99ac"],
    "4|0,3,7,10": ["x000x0","xcccxc","030220","000020","334220","787977","a899xx"],
    "4|0,3,7,10,14": ["200020","230220","77757x","acbca0"],
    "4|0,4,7": ["001220","4542xx","45467x","79997x"],
    "4|0,4,7,10": ["001020","x5767x","797977","a999xx"],
    "4|0,4,7,10,13": ["101020","464050","76767x","xxacbc"],
    "4|0,5,7": ["002220"],
    "4|0,5,7,10": ["002020","032220"],
    "5|0,4,7": ["112331","1123xx","5653xx","56578x","8aaa8x"],
    "5|0,4,7,10": ["112131","54533x","8a8a88","baaaxx"],
    "5|0,4,7,11": ["0123xx","112231","55533x","8a9a88"],
    "6|0,3,6,10": ["012202","5554xx","xa9a9x","cabaxx"],
    "6|0,3,7": ["222442","57644x","5767xx","9abb99"],
    "6|0,3,7,10": ["x222x2","xeeexe","222242","5564xx","9a9b99","cabbxx"],
    "7|0,4,7": ["300023","300023","334553","7875xx","7879a7"],
    "7|0,4,7,10": ["100023","334353","76755x","acacaa"],
    "7|0,4,7,10,14": ["100003","x32323","534353","aaa9aa"],
    "7|0,4,7,10,21": ["100203","5543x3","354353","caa9ax"],
    "7|0,4,7,11": ["200023","334453","77755x","acbcax"],
    "7|0,4,7,14": ["302003","4123xx","7a79ax","aa09ax"],
    "7|0,4,7,9": ["000023","x342x3","75755x","ccccax"],
    "7|0,4,8": ["x00123","x445x3","x445xx","x889ax"],
    "7|0,4,8,10": ["100123","x443x3","7685xx","bcadax"],
    "9|0,3,6": ["x1210x","x34x35","8x87xx","baxacx"],
    "9|0,3,6,9": ["21210x","x454x5","575765","87870x"],
    "9|0,3,7": ["01220x","55520x","555775","8a970x"],
    "9|0,3,7,10": ["01020x","31220x","x555x5","55550x","555575","88977x"],
    "9|0,3,7,10,14": ["31420x","755575","080908","cccacx"],
    "9|0,3,7,11": ["01120x","555675","89977x","x99acx"],
    "9|0,3,7,14": ["01420x","7557xx","8097xx","xc9acx"],
    "9|0,3,7,9": ["21220x","5554x5","575775","87977x"],
    "9|0,4,7": ["02220x","52220x","556775","9a970x"],
    "9|0,4,7,10": ["02020x","32220x","556575","98970x"],
    "9|0,4,7,10,13": ["32320x","656575","6867xx","cbcbcx"],
    "9|0,5,7": ["03220x","03x00x","557775","aa977x"]
  }
};

// ======== GUITAR FORM KNOWLEDGE ========
// Human-playability metadata layered on top of raw chord shapes.
// String indexes and finger arrays use pad-core order: high E = 0, low E = 5.
// The fret key format is the same as PAD_GUITAR_REFERENCE_FORMS.
var PAD_GUITAR_POSITION_FAMILIES = [
  { id: 'jazz-pos-1', label: 'Position 1', minFret: 0, maxFret: 3, source: 'Jazz Code Connection: major diatonic 7th five-position system' },
  { id: 'jazz-pos-2', label: 'Position 2', minFret: 3, maxFret: 5, source: 'Jazz Code Connection: major diatonic 7th five-position system' },
  { id: 'jazz-pos-3', label: 'Position 3', minFret: 5, maxFret: 9, source: 'Jazz Code Connection: major diatonic 7th five-position system' },
  { id: 'jazz-pos-4', label: 'Position 4', minFret: 7, maxFret: 10, source: 'Jazz Code Connection: major diatonic 7th five-position system' },
  { id: 'jazz-pos-5', label: 'Position 5', minFret: 10, maxFret: 13, source: 'Jazz Code Connection: major diatonic 7th five-position system' },
];

var PAD_GUITAR_FORM_KNOWLEDGE = {
  "standard": {
    "0|0,4,7,14": {
      "33023x": {
        movable: false,
        rankBonus: 180,
        styleTags: ["folk-open", "folk-rock", "jangle"],
        nonBarre: true,
        fingerings: [
          { id: "folk-open-seed", fingers: [4, 3, 0, 1, 2, null], barre: null, note: "Cadd9 open grip x32033 is a standard folk/folk-rock color shape." }
        ],
        mutes: [
          { string: 5, actor: "thumb", hand: "fretting", context: "folk-open", note: "Mute or avoid the 6th string." }
        ]
      }
    },
    "9|0,4,7,10": {
      "02020x": {
        movable: false,
        rankBonus: 60,
        styleTags: ["folk-open", "blues-open"],
        fingerings: [
          { id: "human-2026-05-25", fingers: [0, 3, 0, 2, 0, null], barre: null, note: "A7 open grip can use fingers 2 and 3." }
        ],
        mutes: [
          { string: 5, actor: "thumb", hand: "fretting", context: "folk/blues", note: "Mute the 6th string with the fretting-hand thumb." }
        ]
      }
    },
    "11|0,4,7,10": {
      "20212x": {
        movable: false,
        rankBonus: 120,
        styleTags: ["folk-open", "blues-open"],
        fingerings: [
          { id: "human-2026-05-25", fingers: [4, 0, 3, 2, 1, null], barre: null, note: "B7 open grip: A string 1, D string 2, G string 3, high E string 4." }
        ],
        mutes: [
          { string: 5, actor: "middle", hand: "fretting", context: "open B7", note: "Mute the 6th string with the middle finger." }
        ]
      }
    },
    "4|0,5,7": {
      "002220": {
        movable: false,
        rankBonus: 90,
        styleTags: ["folk-open", "blues-open", "sus-resolution"],
        nonBarre: true,
        fingerings: [
          { id: "human-2026-05-25-a", fingers: [0, 0, 3, 2, 1, 0], barre: null, note: "Esus4 open grip, not a barre: fingers 1,2,3 from the 5th string side." },
          { id: "human-2026-05-25-b", fingers: [0, 0, 4, 3, 2, 0], barre: null, note: "Alternative Esus4 open grip: fingers 2,3,4 from the 5th string side." }
        ],
        mutes: []
      }
    },
    "4|0,5,7,10": {
      "002020": {
        movable: false,
        rankBonus: 70,
        styleTags: ["folk-open", "blues-open", "sus-resolution"],
        nonBarre: true,
        fingerings: [
          { id: "human-2026-05-25", fingers: [0, 0, 2, 0, 1, 0], barre: null, note: "E7sus open grip, not a broken barre; separated fingers around the open D string." }
        ],
        mutes: []
      },
      "032220": {
        movable: false,
        rankBonus: 80,
        styleTags: ["folk-open", "blues-open", "sus-resolution"],
        nonBarre: true,
        fingerings: [
          { id: "human-2026-05-25", fingers: [0, 4, 3, 2, 1, 0], barre: null, note: "E7sus open grip, not a barre; the 2nd-fret group uses separate fingers." }
        ],
        mutes: []
      }
    }
  }
};

// ======== GUITAR SOURCE FORM SEEDS ========
// Source-derived movable grips. Shapes are stored low E → high e here because
// they mirror guitar books; the installer converts them to pad-core's internal
// high e → low E fret-key format.
var PAD_GUITAR_SOURCE_PATTERN_SEEDS = [
  {
    id: "misch-a-root-maj7",
    source: "Misch-Inspired Rhythm Guitar Course PDF: Basic 7th Chords",
    quality: "maj7",
    intervals: [0, 4, 7, 11],
    rootString: 4,
    lowToHighOffsets: [null, 0, 2, 1, 2, 0],
    styleTags: ["neo-soul", "misch", "a-string-root"],
    genreBonuses: { neoSoul: 170, funk: 70 },
    note: "A-string-root movable maj7 grip from the Misch neo-soul course."
  },
  {
    id: "misch-a-root-maj7-muted-top",
    source: "Misch-Inspired Rhythm Guitar Course PDF: Basic 7th Chords",
    quality: "maj7",
    intervals: [0, 4, 7, 11],
    rootString: 4,
    lowToHighOffsets: [null, 0, 2, 1, 2, null],
    styleTags: ["neo-soul", "misch", "a-string-root"],
    genreBonuses: { neoSoul: 190, funk: 80 },
    note: "A-string-root maj7 grip with the top string muted, common for tight R&B/neo-soul rhythm."
  },
  {
    id: "misch-a-root-m7",
    source: "Misch-Inspired Rhythm Guitar Course PDF: Basic 7th Chords",
    quality: "m7",
    intervals: [0, 3, 7, 10],
    rootString: 4,
    lowToHighOffsets: [null, 0, 2, 0, 1, 0],
    styleTags: ["neo-soul", "misch", "a-string-root"],
    genreBonuses: { neoSoul: 170, funk: 70 },
    note: "A-string-root movable minor 7 grip from the Misch neo-soul course."
  },
  {
    id: "misch-a-root-7",
    source: "Misch-Inspired Rhythm Guitar Course PDF: Basic 7th Chords",
    quality: "7",
    intervals: [0, 4, 7, 10],
    rootString: 4,
    lowToHighOffsets: [null, 0, 2, 0, 2, 0],
    styleTags: ["neo-soul", "misch", "a-string-root"],
    genreBonuses: { neoSoul: 150, funk: 90 },
    note: "A-string-root movable dominant 7 grip from the Misch neo-soul course."
  },
  {
    id: "misch-e-root-maj7",
    source: "Misch-Inspired Rhythm Guitar Course PDF: Basic 7th Chords",
    quality: "maj7",
    intervals: [0, 4, 7, 11],
    rootString: 5,
    lowToHighOffsets: [0, null, 1, 1, 1, null],
    styleTags: ["neo-soul", "misch", "e-string-root"],
    genreBonuses: { neoSoul: 140, funk: 50 },
    note: "E-string-root movable maj7 grip from the Misch neo-soul course."
  },
  {
    id: "misch-e-root-m7",
    source: "Misch-Inspired Rhythm Guitar Course PDF: Basic 7th Chords",
    quality: "m7",
    intervals: [0, 3, 7, 10],
    rootString: 5,
    lowToHighOffsets: [0, 2, 0, 0, 0, 0],
    styleTags: ["neo-soul", "misch", "e-string-root"],
    genreBonuses: { neoSoul: 130, funk: 70 },
    note: "E-string-root movable minor 7 grip from the Misch neo-soul course."
  },
  {
    id: "misch-e-root-7",
    source: "Misch-Inspired Rhythm Guitar Course PDF: Basic 7th Chords",
    quality: "7",
    intervals: [0, 4, 7, 10],
    rootString: 5,
    lowToHighOffsets: [0, 2, 0, 1, 0, 0],
    styleTags: ["neo-soul", "misch", "e-string-root"],
    genreBonuses: { neoSoul: 120, funk: 90 },
    note: "E-string-root movable dominant 7 grip from the Misch neo-soul course."
  },
  {
    id: "wes-a-root-maj7-block",
    source: "Wes Montgomery block chord study: major 7th",
    quality: "maj7",
    intervals: [0, 4, 7, 11],
    rootString: 4,
    lowToHighOffsets: [null, 0, 2, 1, 2, null],
    styleTags: ["jazz", "wes", "block-chord", "a-string-root"],
    genreBonuses: { jazz: 190 },
    note: "A-string-root major 7 block-chord grip from a Wes-style study."
  },
  {
    id: "wes-e-root-maj7-block",
    source: "Wes Montgomery block chord study: major 7th",
    quality: "maj7",
    intervals: [0, 4, 7, 11],
    rootString: 5,
    lowToHighOffsets: [0, null, 1, 1, 0, null],
    styleTags: ["jazz", "wes", "block-chord", "e-string-root"],
    genreBonuses: { jazz: 160 },
    note: "E-string-root major 7 block-chord grip from a Wes-style study."
  },
  {
    id: "wes-a-root-m7-block",
    source: "Wes Montgomery block chord study: minor 7th",
    quality: "m7",
    intervals: [0, 3, 7, 10],
    rootString: 4,
    lowToHighOffsets: [null, 0, 2, 0, 1, null],
    styleTags: ["jazz", "wes", "block-chord", "a-string-root"],
    genreBonuses: { jazz: 190 },
    note: "A-string-root minor 7 block-chord grip from a Wes-style study."
  },
  {
    id: "wes-e-root-m7-block",
    source: "Wes Montgomery block chord study: minor 7th",
    quality: "m7",
    intervals: [0, 3, 7, 10],
    rootString: 5,
    lowToHighOffsets: [0, 2, 0, 0, 0, null],
    styleTags: ["jazz", "wes", "block-chord", "e-string-root"],
    genreBonuses: { jazz: 140 },
    note: "E-string-root minor 7 block-chord grip from a Wes-style study."
  },
  {
    id: "wes-a-root-7-block",
    source: "Wes Montgomery block chord study: dominant 7th",
    quality: "7",
    intervals: [0, 4, 7, 10],
    rootString: 4,
    lowToHighOffsets: [null, 0, 2, 0, 2, null],
    styleTags: ["jazz", "wes", "block-chord", "a-string-root"],
    genreBonuses: { jazz: 180 },
    note: "A-string-root dominant 7 block-chord grip from a Wes-style study."
  },
  {
    id: "wes-e-root-7-block",
    source: "Wes Montgomery block chord study: dominant 7th",
    quality: "7",
    intervals: [0, 4, 7, 10],
    rootString: 5,
    lowToHighOffsets: [0, null, 0, 1, 0, null],
    styleTags: ["jazz", "wes", "block-chord", "e-string-root"],
    genreBonuses: { jazz: 170 },
    note: "E-string-root dominant 7 block-chord grip from a Wes-style study."
  },
  {
    id: "wes-a-root-m7b5-block",
    source: "Wes Montgomery block chord study: minor 7 flat 5",
    quality: "m7b5",
    intervals: [0, 3, 6, 10],
    rootString: 4,
    lowToHighOffsets: [null, 0, 1, 0, 1, null],
    styleTags: ["jazz", "wes", "block-chord", "a-string-root"],
    genreBonuses: { jazz: 190 },
    note: "A-string-root minor 7 flat 5 block-chord grip from a Wes-style study."
  },
  {
    id: "wes-e-root-m7b5-block",
    source: "Wes Montgomery block chord study: minor 7 flat 5",
    quality: "m7b5",
    intervals: [0, 3, 6, 10],
    rootString: 5,
    lowToHighOffsets: [0, null, 0, 0, -1, null],
    styleTags: ["jazz", "wes", "block-chord", "e-string-root"],
    genreBonuses: { jazz: 160 },
    note: "E-string-root minor 7 flat 5 block-chord grip from a Wes-style study."
  },
  {
    id: "wes-a-root-9-block",
    source: "Wes Montgomery block chord study: 9th",
    quality: "9",
    intervals: [0, 4, 10, 14],
    rootString: 4,
    lowToHighOffsets: [null, 0, -1, 0, 0, null],
    styleTags: ["jazz", "wes", "block-chord", "a-string-root"],
    genreBonuses: { jazz: 170 },
    note: "A-string-root dominant 9 block-chord grip from a Wes-style study."
  },
  {
    id: "wes-e-root-9-block",
    source: "Wes Montgomery block chord study: 9th",
    quality: "9",
    intervals: [0, 4, 10, 14],
    rootString: 5,
    lowToHighOffsets: [0, null, 0, -1, 0, null],
    styleTags: ["jazz", "wes", "block-chord", "e-string-root"],
    genreBonuses: { jazz: 170 },
    note: "E-string-root dominant 9 block-chord grip from a Wes-style study."
  },
  {
    id: "wes-e-root-13-block",
    source: "Wes Montgomery block chord study: 13th",
    quality: "13",
    intervals: [0, 4, 10, 21],
    rootString: 5,
    lowToHighOffsets: [0, null, 0, 1, 2, null],
    styleTags: ["jazz", "wes", "block-chord", "e-string-root"],
    genreBonuses: { jazz: 170 },
    note: "E-string-root dominant 13 block-chord grip from a Wes-style study."
  },
  {
    id: "bossa-a-root-maj7-shell",
    source: "Bossa guitar voicing chart: major 7 shell",
    quality: "maj7",
    intervals: [0, 4, 7, 11],
    rootString: 4,
    lowToHighOffsets: [null, 0, 2, 1, 2, null],
    styleTags: ["bossa", "shell", "a-string-root"],
    genreBonuses: { bossa: 190, jazz: 80 },
    note: "A-string-root major 7 bossa shell grip."
  },
  {
    id: "bossa-e-root-maj7-shell",
    source: "Bossa guitar voicing chart: major 7 shell",
    quality: "maj7",
    intervals: [0, 4, 7, 11],
    rootString: 5,
    lowToHighOffsets: [0, null, 1, 1, 0, null],
    styleTags: ["bossa", "shell", "e-string-root"],
    genreBonuses: { bossa: 160, jazz: 70 },
    note: "E-string-root major 7 bossa shell grip."
  },
  {
    id: "bossa-a-root-m7-shell",
    source: "Bossa guitar voicing chart: minor 7 shell",
    quality: "m7",
    intervals: [0, 3, 7, 10],
    rootString: 4,
    lowToHighOffsets: [null, 0, -2, 0, 1, null],
    styleTags: ["bossa", "shell", "a-string-root"],
    genreBonuses: { bossa: 210, jazz: 80 },
    note: "A-string-root minor 7 bossa shell grip."
  },
  {
    id: "bossa-e-root-m7-shell",
    source: "Bossa guitar voicing chart: minor 7 shell",
    quality: "m7",
    intervals: [0, 3, 7, 10],
    rootString: 5,
    lowToHighOffsets: [0, null, 0, 0, 0, null],
    styleTags: ["bossa", "shell", "e-string-root"],
    genreBonuses: { bossa: 150, jazz: 60 },
    note: "E-string-root minor 7 compact bossa grip."
  },
  {
    id: "bossa-a-root-m9-shell",
    source: "Bossa guitar voicing chart: minor 7 ninth shell",
    quality: "m9",
    intervals: [0, 3, 10, 14],
    rootString: 4,
    lowToHighOffsets: [null, 0, -2, 0, 0, null],
    styleTags: ["bossa", "shell", "a-string-root", "ninth"],
    genreBonuses: { bossa: 210, jazz: 80 },
    note: "A-string-root minor 9 bossa shell grip."
  },
  {
    id: "bossa-e-root-7-shell",
    source: "Bossa guitar voicing chart: dominant 7 shell",
    quality: "7",
    intervals: [0, 4, 7, 10],
    rootString: 5,
    lowToHighOffsets: [0, null, 0, 1, 0, null],
    styleTags: ["bossa", "shell", "e-string-root"],
    genreBonuses: { bossa: 210, jazz: 90 },
    note: "E-string-root dominant 7 bossa shell grip."
  },
  {
    id: "bossa-a-root-7-shell",
    source: "Bossa guitar voicing chart: dominant 7 shell",
    quality: "7",
    intervals: [0, 4, 7, 10],
    rootString: 4,
    lowToHighOffsets: [null, 0, -1, 0, -2, null],
    styleTags: ["bossa", "shell", "a-string-root"],
    genreBonuses: { bossa: 180, jazz: 80 },
    note: "A-string-root dominant 7 bossa shell grip."
  },
  {
    id: "bossa-e-root-13-shell",
    source: "Bossa guitar voicing chart: dominant 13 shell",
    quality: "13",
    intervals: [0, 4, 10, 21],
    rootString: 5,
    lowToHighOffsets: [0, null, 0, 1, 2, null],
    styleTags: ["bossa", "shell", "e-string-root", "13th"],
    genreBonuses: { bossa: 210, jazz: 100 },
    note: "E-string-root dominant 13 bossa shell grip."
  },
  {
    id: "bossa-a-root-13-shell",
    source: "Bossa guitar voicing chart: dominant 13 shell",
    quality: "13",
    intervals: [0, 4, 10, 21],
    rootString: 4,
    lowToHighOffsets: [null, 0, -1, 0, 2, null],
    styleTags: ["bossa", "shell", "a-string-root", "13th"],
    genreBonuses: { bossa: 180, jazz: 80 },
    note: "A-string-root dominant 13 bossa shell grip."
  },
  {
    id: "bossa-a-root-6-9",
    source: "Bossa guitar voicing chart: 6 ninth",
    quality: "6(9)",
    intervals: [0, 4, 9, 14],
    rootString: 4,
    lowToHighOffsets: [null, 0, -1, -1, 0, null],
    styleTags: ["bossa", "sixth", "ninth", "a-string-root"],
    genreBonuses: { bossa: 210, jazz: 70 },
    note: "A-string-root 6(9) bossa grip."
  },
  {
    id: "bossa-e-root-6-9",
    source: "Bossa guitar voicing chart: 6 ninth",
    quality: "6(9)",
    intervals: [0, 4, 9, 14],
    rootString: 5,
    lowToHighOffsets: [0, null, -1, -1, 0, null],
    styleTags: ["bossa", "sixth", "ninth", "e-string-root"],
    genreBonuses: { bossa: 170, jazz: 60 },
    note: "E-string-root 6(9) bossa grip."
  },
  {
    id: "bossa-a-root-m6",
    source: "Bossa guitar voicing chart: minor 6",
    quality: "m6",
    intervals: [0, 3, 9],
    rootString: 4,
    lowToHighOffsets: [null, 0, -2, -1, 1, null],
    styleTags: ["bossa", "minor-sixth", "a-string-root"],
    genreBonuses: { bossa: 160, jazz: 70 },
    note: "A-string-root minor 6 bossa grip."
  },
  {
    id: "bossa-a-root-m7b5",
    source: "Bossa guitar voicing chart: minor 7 flat 5",
    quality: "m7b5",
    intervals: [0, 3, 6, 10],
    rootString: 4,
    lowToHighOffsets: [null, 0, -1, 0, 1, null],
    styleTags: ["bossa", "shell", "minor-seven-flat-five", "a-string-root"],
    genreBonuses: { bossa: 180, jazz: 100 },
    note: "A-string-root minor 7 flat 5 bossa grip."
  },
  {
    id: "bossa-e-root-dim7",
    source: "Bossa guitar voicing chart: diminished 7",
    quality: "dim7",
    intervals: [0, 3, 6, 9],
    rootString: 5,
    lowToHighOffsets: [0, null, -1, 0, -1, null],
    styleTags: ["bossa", "diminished", "e-string-root"],
    genreBonuses: { bossa: 160, jazz: 80 },
    note: "E-string-root diminished 7 bossa grip."
  }
];

function padGuitarSourceSeedRootFret(rootPC, rootString) {
  var openPc = rootString === 5 ? 4 : 9; // low E or A string
  var fret = (rootPC - openPc + 12) % 12;
  if (fret < 2) fret += 12;
  return fret;
}

function padInstallGuitarSourcePatternSeeds() {
  if (!PAD_GUITAR_FORM_KNOWLEDGE.standard) PAD_GUITAR_FORM_KNOWLEDGE.standard = {};
  var rootPcs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  for (var si = 0; si < PAD_GUITAR_SOURCE_PATTERN_SEEDS.length; si++) {
    var seed = PAD_GUITAR_SOURCE_PATTERN_SEEDS[si];
    for (var ri = 0; ri < rootPcs.length; ri++) {
      var rootPC = rootPcs[ri];
      var rootFret = padGuitarSourceSeedRootFret(rootPC, seed.rootString);
      if (rootFret > 12) continue;
      var lowToHigh = [];
      for (var oi = 0; oi < seed.lowToHighOffsets.length; oi++) {
        var offset = seed.lowToHighOffsets[oi];
        lowToHigh.push(offset === null ? null : rootFret + offset);
      }
      var highToLow = lowToHigh.slice().reverse();
      var fretKey = highToLow.map(function(f) {
        if (f === null) return 'x';
        if (f >= 10) return String.fromCharCode(97 + f - 10);
        return String(f);
      }).join('');
      var chordKey = rootPC + "|" + seed.intervals.join(",");
      if (!PAD_GUITAR_FORM_KNOWLEDGE.standard[chordKey]) {
        PAD_GUITAR_FORM_KNOWLEDGE.standard[chordKey] = {};
      }
      if (!PAD_GUITAR_FORM_KNOWLEDGE.standard[chordKey][fretKey]) {
        PAD_GUITAR_FORM_KNOWLEDGE.standard[chordKey][fretKey] = {
          movable: true,
          rankBonus: 0,
          styleTags: seed.styleTags.slice(),
          genreBonuses: Object.assign({}, seed.genreBonuses),
          source: seed.source,
          sourceSeedId: seed.id,
          fingerings: [
            { id: seed.id, fingers: null, barre: null, note: seed.note }
          ],
          mutes: []
        };
      } else {
        var existing = PAD_GUITAR_FORM_KNOWLEDGE.standard[chordKey][fretKey];
        if (!existing.genreBonuses) existing.genreBonuses = {};
        for (var gb in seed.genreBonuses) {
          existing.genreBonuses[gb] = Math.max(existing.genreBonuses[gb] || 0, seed.genreBonuses[gb]);
        }
        if (!existing.styleTags) existing.styleTags = [];
        for (var ti = 0; ti < seed.styleTags.length; ti++) {
          if (existing.styleTags.indexOf(seed.styleTags[ti]) === -1) existing.styleTags.push(seed.styleTags[ti]);
        }
      }
    }
  }
}

padInstallGuitarSourcePatternSeeds();

// Conditional exports for Node.js (Vitest) — ignored in browser
if (typeof module !== 'undefined') module.exports = {
  NOTE_NAMES_SHARP, NOTE_NAMES_FLAT, FLAT_MAJOR_KEYS,
  SCALES, SCALE_FULL_NAMES, KEY_SPELLINGS,
  BUILDER_QUALITIES, TENSION_ROWS,
  DEGREE_TO_SEMITONE, PC_TO_TENSION_NAME, TENSION_NAME_TO_PC, SCALE_AVAIL_TENSIONS,
  PAD_ROOT_TO_PC, PAD_QUALITY_INTERVALS, PAD_QUALITY_KEYS, PAD_QUALITY_DISPLAY,
  GRID, GRID_32, SCALE_DEGREE_NAMES,
  PAD_INST_COLORS, PAD_GUITAR_TUNING, PAD_GUITAR_NAMES, PAD_BASS_TUNING, PAD_BASS_NAMES,
  padBuildChordDetectDB, CHORD_DETECT_DB, TRIAD_DETECT_DB, TETRAD_DETECT_DB,
  PAD_THEME_OKABE_ITO,
  PAD_GUITAR_REFERENCE_FORMS, PAD_GUITAR_POSITION_FAMILIES, PAD_GUITAR_FORM_KNOWLEDGE,
  PAD_GUITAR_SOURCE_PATTERN_SEEDS,
};
