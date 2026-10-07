// ========================================
// PAD-CORE — Theory Calculations (Pure Functions)
// All functions are pure: no global state reads.
// Required state is passed as arguments.
// ========================================

// Node.js: load data.js exports into global scope (browser: already global via script tag)
if (typeof require !== 'undefined' && typeof SCALES === 'undefined') {
  Object.assign(globalThis, require('./data.js'));
}

// ======== CHORD NAME PARSING ========

function padParseRoot(str) {
  if (!str || str.length === 0) return null;
  var first = str[0].toUpperCase();
  if (first < 'A' || first > 'G') return null;
  var name = first;
  if (str.length > 1) {
    var second = str[1];
    if (second === '#' || second === '\u266F') name += '#';      // # or ♯
    else if (second === 'b' || second === '\u266D') name += 'b'; // b or ♭
  }
  var pc = PAD_ROOT_TO_PC[name];
  return pc !== undefined ? { pc: pc, len: name.length } : null;
}

function padParseChordName(input) {
  if (!input) return null;
  input = input.trim();
  if (!input) return null;

  // Normalize: uppercase first letter
  input = input[0].toUpperCase() + input.slice(1);

  // 1. Extract bass note (slash chord: /X at end)
  var bass = null;
  var mainPart = input;
  var slashIdx = input.lastIndexOf('/');
  if (slashIdx > 0) {
    var bassStr = input.slice(slashIdx + 1);
    var bassResult = padParseRoot(bassStr);
    if (bassResult && bassResult.len === bassStr.length) {
      bass = bassResult.pc;
      mainPart = input.slice(0, slashIdx);
    }
  }

  // 2. Parse root note
  var rootResult = padParseRoot(mainPart);
  if (!rootResult) return null;

  // 3. Extract quality string (everything after root)
  var qualityStr = mainPart.slice(rootResult.len);

  // 4. Match quality (longest match first)
  var matchedKey = null;
  for (var i = 0; i < PAD_QUALITY_KEYS.length; i++) {
    if (qualityStr === PAD_QUALITY_KEYS[i]) {
      matchedKey = PAD_QUALITY_KEYS[i];
      break;
    }
  }

  // 4b. Fallback: compound tension like "m7(9,11)" or "7(b9,#11)"
  if (matchedKey === null) {
    var parenMatch = qualityStr.match(/^(.*?)\(([^)]+)\)$/);
    if (parenMatch) {
      var baseQ = parenMatch[1];
      var tensionStr = parenMatch[2];
      if (PAD_QUALITY_INTERVALS[baseQ] !== undefined) {
        var TENSION_MAP = {
          '9': 14, 'b9': 13, '#9': 15,
          '11': 17, '#11': 18,
          '13': 21, 'b13': 20, 'b6': 8, '7': 23,
          '#5': 8, 'b5': 6,
        };
        var baseIntervals = PAD_QUALITY_INTERVALS[baseQ].slice();
        var tensions = tensionStr.split(',').map(function(s) { return s.trim(); });
        var valid = true;
        for (var t = 0; t < tensions.length; t++) {
          var iv = TENSION_MAP[tensions[t]];
          if (iv === undefined) { valid = false; break; }
          // b13 is an altered/seventh-chord tension in automatic semantics.
          // A plain triad chromatic lower-sixth is written b6 instead.
          if (tensions[t] === 'b13' && baseIntervals.indexOf(10) < 0) { valid = false; break; }
          if (tensions[t] === 'b5' || tensions[t] === '#5') {
            var idx = baseIntervals.indexOf(7);
            if (idx >= 0) baseIntervals[idx] = iv;
            else if (baseIntervals.indexOf(iv) < 0) baseIntervals.push(iv);
          } else {
            if (baseIntervals.indexOf(iv) < 0) baseIntervals.push(iv);
          }
        }
        if (valid) {
          baseIntervals.sort(function(a, b) { return a - b; });
          var rootName = mainPart.slice(0, rootResult.len);
          var displayQuality = PAD_QUALITY_DISPLAY[baseQ] || baseQ;
          var displayName = rootName + displayQuality + '(' + tensions.join(',') + ')';
          if (bass !== null) {
            var bassStr2 = input.slice(input.lastIndexOf('/') + 1);
            displayName += '/' + bassStr2[0].toUpperCase() + bassStr2.slice(1);
          }
          return {
            root: rootResult.pc,
            quality: qualityStr,
            intervals: baseIntervals,
            bass: bass,
            displayName: displayName,
          };
        }
      }
    }
  }

  if (matchedKey === null) return null;

  var intervals = PAD_QUALITY_INTERVALS[matchedKey];

  // Build canonical display name (resolve aliases)
  var rootName2 = mainPart.slice(0, rootResult.len);
  var displayQuality2 = PAD_QUALITY_DISPLAY[matchedKey] || matchedKey;
  var displayName2 = rootName2 + displayQuality2;
  if (bass !== null) {
    var bassStr3 = input.slice(input.lastIndexOf('/') + 1);
    displayName2 += '/' + bassStr3[0].toUpperCase() + bassStr3.slice(1);
  }

  return {
    root: rootResult.pc,
    quality: matchedKey,
    intervals: intervals.slice(),
    bass: bass,
    displayName: displayName2,
  };
}

// ======== BASIC PITCH MATH ========

function padPitchClass(midi) {
  return ((midi % 12) + 12) % 12;
}

// ======== ENHARMONIC SPELLING ========

function padGetParentMajorKey(scaleIdx, key) {
  var scale = SCALES[scaleIdx];
  if (scale.cat === '○') {
    var DIATONIC = [0, 2, 4, 5, 7, 9, 11];
    return (key - DIATONIC[scale.num - 1] + 12) % 12;
  }
  if (scale.cat === '■') {
    var HM = [0, 2, 3, 5, 7, 8, 11];
    var minorRoot = (key - HM[scale.num - 1] + 12) % 12;
    return (minorRoot + 3) % 12;
  }
  if (scale.cat === '◆') {
    var MM = [0, 2, 3, 5, 7, 9, 11];
    var minorRoot2 = (key - MM[scale.num - 1] + 12) % 12;
    return (minorRoot2 + 3) % 12;
  }
  // Non-modal: minor-like (has b3 without natural 3) → relative major
  if (scale.pcs.includes(3) && !scale.pcs.includes(4)) {
    return (key + 3) % 12;
  }
  return key;
}

function padPcName(pc, scaleIdx, key) {
  var parentKey = padGetParentMajorKey(scaleIdx, key);
  return KEY_SPELLINGS[parentKey][pc];
}

function padNoteNameForKey(pc, key) {
  return KEY_SPELLINGS[padGetParentMajorKey(0, key)][pc];
}

// ======== CIRCLE OF FIFTHS ========

function padFifthsDistance(key1, key2) {
  var d = ((key2 - key1) * 7 + 144) % 12;
  return Math.min(d, 12 - d);
}

// ======== TENSION APPLICATION ========

function padApplyTension(basePCS, mods) {
  var pcs = [].concat(basePCS);
  if (mods.replace3 !== undefined) {
    pcs = pcs.filter(function(p) { return p !== 3 && p !== 4; });
    if (!pcs.includes(mods.replace3)) pcs.push(mods.replace3);
  }
  if (mods.sharp5) {
    var i = pcs.indexOf(7);
    if (i >= 0) pcs[i] = 8;
    else if (!pcs.includes(8)) pcs.push(8);
  }
  if (mods.flat5) {
    var j = pcs.indexOf(7);
    if (j >= 0) pcs[j] = 6;
    else if (!pcs.includes(6)) pcs.push(6);
  }
  if (mods.add) {
    for (var k = 0; k < mods.add.length; k++) {
      var addPC = mods.add[k];
      var preserveRegister = mods.registerAdd && mods.registerAdd.indexOf(addPC) >= 0;
      if (preserveRegister) {
        // A selected explicit extension can share a pitch class with a symmetric
        // chord tone. Keep its compound register as voicing information.
        if (!pcs.includes(addPC + 12)) pcs.push(addPC + 12);
      } else if (!pcs.some(function(p) { return p % 12 === addPC; })) {
        pcs.push(addPC + 12);
      }
    }
  }
  if (mods.omit3) { pcs = pcs.filter(function(p) { return p !== 3 && p !== 4; }); }
  if (mods.omit5) { pcs = pcs.filter(function(p) { return p !== 6 && p !== 7 && p !== 8; }); }
  return pcs.sort(function(a, b) { return a - b; });
}

// Builder-facing structured payload. It preserves selected compound register
// information so consumers never need to recover intent from a display name.
function padBuildChordPayload(basePCS, tension) {
  var explicitIntent = !!tension;
  var mods = (tension && tension.mods) || {};
  var chordIntervals = padApplyTension(basePCS, mods);
  var chordPCS = Array.from(new Set(chordIntervals.map(function(interval) {
    return ((interval % 12) + 12) % 12;
  }))).sort(function(a, b) { return a - b; });
  var tensionIntervals = chordIntervals.filter(function(interval) {
    return interval >= 12 || basePCS.indexOf(interval) < 0;
  });
  var tensionPCS = Array.from(new Set(tensionIntervals.map(function(interval) {
    return ((interval % 12) + 12) % 12;
  }))).sort(function(a, b) { return a - b; });
  var registerIntervals = tensionIntervals.filter(function(interval) {
    return mods.registerAdd && mods.registerAdd.indexOf(((interval % 12) + 12) % 12) >= 0;
  });
  return {
    tensionLabels: (tension && tension.tensionLabels ? tension.tensionLabels.slice() : []),
    chordPCS: chordPCS,
    chordIntervals: chordIntervals,
    tensionPCS: tensionPCS,
    tensionIntervals: tensionIntervals,
    register: { explicit: explicitIntent, intervals: registerIntervals },
    explicitIntent: explicitIntent,
  };
}

// ======== VOICING CALCULATION ========

function padCalcVoicingOffsets(chordPCS, inversion, drop) {
  var voiced = [].concat(chordPCS).sort(function(a, b) { return a - b; });
  for (var i = 0; i < inversion && i < voiced.length; i++) {
    voiced.push(voiced.shift() + 12);
  }
  if (drop === 'drop2' && voiced.length >= 4) {
    voiced[voiced.length - 2] -= 12;
    voiced.sort(function(a, b) { return a - b; });
  } else if (drop === 'drop3' && voiced.length >= 4) {
    voiced[voiced.length - 3] -= 12;
    voiced.sort(function(a, b) { return a - b; });
  }
  var bassInterval = voiced[0];
  var minVal = voiced[0];
  var offsets = voiced.map(function(v) { return v - minVal; });
  return { offsets: offsets, bassInterval: bassInterval, voiced: voiced };
}

function padGetBassCase(bassPC, rootPC, chordPCS) {
  var bassIv = ((bassPC - rootPC) % 12 + 12) % 12;
  var sorted = Array.from(new Set(chordPCS.map(function(iv) { return iv % 12; }))).sort(function(a, b) { return a - b; });
  var idx = sorted.indexOf(bassIv);
  return { isChordTone: idx >= 0, inversionIndex: idx >= 0 ? idx : null };
}

function padApplyOnChordBass(voiced, rootPC, bassPC) {
  var bassIv = ((bassPC - rootPC) % 12 + 12) % 12;
  var lowestPC = ((voiced[0] % 12) + 12) % 12;
  if (lowestPC === bassIv) return voiced;
  var bassVal = bassIv;
  while (bassVal >= voiced[0]) bassVal -= 12;
  return [bassVal].concat(voiced).sort(function(a, b) { return a - b; });
}

function padGetShellIntervals(qualityPCS, shellMode, extension, fullPCS) {
  var thirdIv = null, seventhIv = null;
  if (qualityPCS) {
    if (qualityPCS.includes(4)) thirdIv = 4;
    else if (qualityPCS.includes(3)) thirdIv = 3;
    if (qualityPCS.includes(11)) seventhIv = 11;
    else if (qualityPCS.includes(10)) seventhIv = 10;
    else if (qualityPCS.includes(9) && !qualityPCS.includes(10) && !qualityPCS.includes(11)) {
      seventhIv = 9;
    }
  }
  if (thirdIv === null || seventhIv === null) return null;
  var intervals = [0, thirdIv, seventhIv];
  if (fullPCS) {
    fullPCS.filter(function(iv) { return iv >= 12; }).forEach(function(iv) {
      if (!intervals.includes(iv)) intervals.push(iv);
    });
  }
  if (extension > 0 && fullPCS) {
    var shellSet = new Set(intervals.map(function(iv) { return iv % 12; }));
    var extras = fullPCS.filter(function(iv) { return !shellSet.has(iv); }).sort(function(a, b) {
      var at = a >= 12 ? 0 : 1;
      var bt = b >= 12 ? 0 : 1;
      if (at !== bt) return at - bt;
      return a - b;
    });
    var extCount = Math.min(extension, extras.length);
    for (var i = 0; i < extCount; i++) intervals.push(extras[i]);
  }
  if (shellMode === '173') {
    intervals = intervals.map(function(iv) { return iv === thirdIv ? iv + 12 : iv; });
  }
  intervals.sort(function(a, b) { return a - b; });
  return intervals;
}

// ======== VOICING POSITION SEARCH ========

function padCalcAllVoicingPositions(bassRow, bassCol, offsets, gridRows, gridCols, bm, rowInterval, maxResults) {
  if (maxResults === undefined) maxResults = 10;
  var bassMidi = bm + bassRow * rowInterval + bassCol;
  var candidates = offsets.slice(1).map(function(offset) {
    var targetMidi = bassMidi + offset;
    var positions = [];
    for (var r = 0; r < gridRows; r++) {
      var c = targetMidi - bm - r * rowInterval;
      if (c >= 0 && c < gridCols) positions.push({ row: r, col: c });
    }
    return positions;
  });
  if (candidates.some(function(c) { return c.length === 0; })) return [];
  var bassPos = { row: bassRow, col: bassCol };
  var results = [];
  function search(idx, chosen) {
    if (idx === candidates.length) {
      var all = [bassPos].concat(chosen);
      var minR = Math.min.apply(null, all.map(function(p) { return p.row; }));
      var maxR = Math.max.apply(null, all.map(function(p) { return p.row; }));
      var minC = Math.min.apply(null, all.map(function(p) { return p.col; }));
      var maxC = Math.max.apply(null, all.map(function(p) { return p.col; }));
      var rowSpan = maxR - minR + 1, colSpan = maxC - minC + 1;
      if (rowSpan > 5 || colSpan > 6) return;
      var maxDim = Math.max(rowSpan, colSpan);
      var area = rowSpan * colSpan;
      results.push({ positions: all, minRow: minR, maxRow: maxR, minCol: minC, maxCol: maxC, maxDim: maxDim, area: area });
      return;
    }
    for (var p = 0; p < candidates[idx].length; p++) search(idx + 1, chosen.concat([candidates[idx][p]]));
  }
  search(0, []);
  results.sort(function(a, b) { return a.maxDim - b.maxDim || a.area - b.area; });
  return results.slice(0, maxResults);
}

// ======== COMPACT PAD POSITIONS ========

/**
 * Find the most compact pad positions for a set of MIDI notes.
 * Each MIDI note maps to 1-2 grid positions; this picks the combination
 * that minimizes the bounding box. When degreeMap is provided, shell /
 * triad clusters are preferred so HPS voicings land in playable positions.
 * Returns [{row, col, midi}] — one position per in-range note.
 */
function padFindCompactPositions(midiNotes, gridRows, gridCols, bm, rowInterval, degreeMap) {
  var candidates = [];
  for (var i = 0; i < midiNotes.length; i++) {
    var midi = midiNotes[i];
    var positions = [];
    for (var r = 0; r < gridRows; r++) {
      var c = midi - bm - r * rowInterval;
      if (c >= 0 && c < gridCols) positions.push({ row: r, col: c, midi: midi });
    }
    candidates.push(positions);
  }
  var validIndices = [];
  for (var j = 0; j < candidates.length; j++) {
    if (candidates[j].length > 0) validIndices.push(j);
  }
  if (validIndices.length === 0) return [];
  var validCands = validIndices.map(function(i) { return candidates[i]; });
  var best = null;
  function degreeForMidi(midi) {
    if (!degreeMap) return '';
    return degreeMap[midi] || degreeMap[String(midi)] || '';
  }
  function clusterScore(chosen, groups) {
    if (!degreeMap) return 0;
    var buckets = groups.map(function(matches) {
      return chosen.filter(function(p) {
        var deg = degreeForMidi(p.midi);
        return matches.indexOf(deg) >= 0;
      });
    });
    for (var b = 0; b < buckets.length; b++) {
      if (buckets[b].length === 0) return 9999;
    }
    var bestCluster = Infinity;
    function walk(idx, picked) {
      if (idx === buckets.length) {
        var minR = picked[0].row, maxR = minR, minC = picked[0].col, maxC = minC;
        var pair = 0;
        for (var i = 0; i < picked.length; i++) {
          if (picked[i].row < minR) minR = picked[i].row;
          if (picked[i].row > maxR) maxR = picked[i].row;
          if (picked[i].col < minC) minC = picked[i].col;
          if (picked[i].col > maxC) maxC = picked[i].col;
          for (var j = i + 1; j < picked.length; j++) {
            pair += Math.abs(picked[i].row - picked[j].row) + Math.abs(picked[i].col - picked[j].col);
          }
        }
        var rowSpan = maxR - minR + 1;
        var colSpan = maxC - minC + 1;
        var score = rowSpan * colSpan * 20 + Math.max(rowSpan, colSpan) * 5 + pair;
        if (score < bestCluster) bestCluster = score;
        return;
      }
      for (var p = 0; p < buckets[idx].length; p++) {
        picked.push(buckets[idx][p]);
        walk(idx + 1, picked);
        picked.pop();
      }
    }
    walk(0, []);
    return bestCluster;
  }
  function search(idx, chosen) {
    if (idx === validCands.length) {
      var minR = chosen[0].row, maxR = minR, minC = chosen[0].col, maxC = minC;
      for (var k = 1; k < chosen.length; k++) {
        if (chosen[k].row < minR) minR = chosen[k].row;
        if (chosen[k].row > maxR) maxR = chosen[k].row;
        if (chosen[k].col < minC) minC = chosen[k].col;
        if (chosen[k].col > maxC) maxC = chosen[k].col;
      }
      var maxDim = Math.max(maxR - minR + 1, maxC - minC + 1);
      var area = (maxR - minR + 1) * (maxC - minC + 1);
      var shell = clusterScore(chosen, [['1'], ['3', 'b3'], ['7', 'b7', 'bb7', '6']]);
      var triad = clusterScore(chosen, [['1'], ['3', 'b3'], ['5', 'b5', '#5']]);
      var center = 0;
      for (var c = 0; c < chosen.length; c++) {
        center += Math.abs(chosen[c].row - (gridRows - 1) / 2) + Math.abs(chosen[c].col - (gridCols - 1) / 2);
      }
      var score = degreeMap
        ? shell * 100000 + triad * 10000 + area * 100 + maxDim * 10 + center
        : maxDim * 100000 + area * 100 + center;
      if (!best || score < best.score) {
        best = { positions: chosen.slice(), maxDim: maxDim, area: area, score: score };
      }
      return;
    }
    for (var p = 0; p < validCands[idx].length; p++) {
      chosen.push(validCands[idx][p]);
      search(idx + 1, chosen);
      chosen.pop();
    }
  }
  search(0, []);
  return best ? best.positions : [];
}

// ======== NEAREST PAD POSITIONS (continuous voicing placement) ========
//
// Pick pad positions for the next chord from the previous chord's resolved
// positions. Pitches never change; only "which pad plays each pitch" is chosen.
// A human-decided seed / override always wins. No finger or hand model:
// positions only (see DOJO #902).
//
// Order of preference (lexicographic, NOT a weighted sum):
//   1. common pitches stay on the same pad (fewest pitches that move)
//   2. smallest total hand movement: minimum-cost one-to-one matching between
//      previous pads and next pads, cost = |drow| + |dcol| (board distance;
//      never semitone or serial difference)
//   3. most compact bounding rectangle: longer side (maxDim) first, then area
//      (same order as padFindCompactPositions / padCalcAllVoicingPositions)
//   4. deterministic: serials ascending in pitch order

var PAD_NEAREST_MAX_PITCHES = 10;

/**
 * The board layout: push-fourths-chromatic-v1, fixed from the existing GRID
 * constants (8x8, base MIDI 36, +5 per row, +1 per column,
 * serial = 36 + row*8 + col). The layout cannot be replaced through options.
 * options.octaveShift moves only the pitch base (by 12 per step); serials
 * do not change.
 */
function padNearestLayout(options) {
  var g = (typeof GRID !== 'undefined') ? GRID : null;
  var shift = options && options.octaveShift !== undefined ? options.octaveShift : 0;
  return {
    rows: g ? g.ROWS : 8,
    cols: g ? g.COLS : 8,
    baseMidi: (g ? g.BASE_MIDI : 36) + 12 * shift,
    rowInterval: g ? g.ROW_INTERVAL : 5,
    colInterval: g ? g.COL_INTERVAL : 1,
    serialBase: 36,
  };
}

function padSerialToRowCol(serial, options) {
  var L = padNearestLayout(options);
  if (typeof serial !== 'number' || serial % 1 !== 0) return null;
  var idx = serial - L.serialBase;
  if (idx < 0 || idx >= L.rows * L.cols) return null;
  return { row: Math.floor(idx / L.cols), col: idx % L.cols };
}

// Returns null when (row, col) is not a pad on the board.
function padRowColToSerial(row, col, options) {
  var L = padNearestLayout(options);
  if (typeof row !== 'number' || typeof col !== 'number' || row % 1 !== 0 || col % 1 !== 0) return null;
  if (row < 0 || row >= L.rows || col < 0 || col >= L.cols) return null;
  return L.serialBase + row * L.cols + col;
}

function padPitchAtSerial(serial, options) {
  var L = padNearestLayout(options);
  var p = padSerialToRowCol(serial, options);
  if (!p) return null;
  return L.baseMidi + p.row * L.rowInterval + p.col * L.colInterval;
}

// Every pad that plays `pitch` (a pitch can sit on several pads).
function _padNearestPadsForPitch(pitch, L) {
  var pads = [];
  for (var r = 0; r < L.rows; r++) {
    var rest = pitch - L.baseMidi - r * L.rowInterval;
    if (rest % L.colInterval !== 0) continue;
    var c = rest / L.colInterval;
    if (c >= 0 && c < L.cols) pads.push({ row: r, col: c });
  }
  return pads;
}

// Minimum total Manhattan distance of a one-to-one matching. The smaller side
// is fully matched; leftover pads of the larger side cost nothing.
function _padMinManhattanMatching(a, b) {
  if (a.length > b.length) { var t = a; a = b; b = t; }
  if (a.length === 0) return 0;
  var nb = b.length;
  var size = 1 << nb;
  var dp = new Array(size);
  for (var m = 0; m < size; m++) dp[m] = Infinity;
  dp[0] = 0;
  var best = Infinity;
  for (var mask = 0; mask < size; mask++) {
    if (dp[mask] === Infinity) continue;
    var i = 0, mm = mask;
    while (mm) { i += mm & 1; mm >>= 1; }
    if (i === a.length) { if (dp[mask] < best) best = dp[mask]; continue; }
    for (var j = 0; j < nb; j++) {
      if (mask & (1 << j)) continue;
      var d = Math.abs(a[i].row - b[j].row) + Math.abs(a[i].col - b[j].col);
      var nm = mask | (1 << j);
      if (dp[mask] + d < dp[nm]) dp[nm] = dp[mask] + d;
    }
  }
  return best;
}

function _padNearestFail(reason, extra) {
  var r = { ok: false, reason: reason, bindings: [] };
  if (extra) for (var k in extra) r[k] = extra[k];
  return r;
}

// Validate [{pitch, serial}] against the layout. Returns {ok, bindings} sorted by pitch.
function _padNearestCheckBindings(list, options) {
  var L = padNearestLayout(options);
  var seen = {};
  var out = [];
  var bad = [];
  for (var i = 0; i < list.length; i++) {
    var b = list[i];
    var pos = b ? padSerialToRowCol(b.serial, options) : null;
    var pitch = b ? b.pitch : null;
    if (!pos || typeof pitch !== 'number' || pitch % 1 !== 0 ||
        L.baseMidi + pos.row * L.rowInterval + pos.col * L.colInterval !== pitch) {
      bad.push(b);
      continue;
    }
    if (seen[pitch] !== undefined && seen[pitch] !== b.serial) { bad.push(b); continue; }
    if (seen[pitch] !== undefined) continue;
    seen[pitch] = b.serial;
    out.push({ pitch: pitch, serial: b.serial, row: pos.row, col: pos.col });
  }
  out.sort(function(x, y) { return x.pitch - y.pitch; });
  if (bad.length) return { ok: false, bad: bad };
  // The matching below is exponential in the pad count; cap it on both sides.
  if (out.length > PAD_NEAREST_MAX_PITCHES) return { ok: false, tooMany: true };
  return { ok: true, bindings: out };
}

function _padNearestUniquePitches(pitches) {
  var seen = {};
  var out = [];
  for (var i = 0; i < pitches.length; i++) {
    var p = pitches[i];
    if (typeof p !== 'number' || p % 1 !== 0) return null;
    if (!seen[p]) { seen[p] = true; out.push(p); }
  }
  out.sort(function(a, b) { return a - b; });
  return out;
}

/**
 * Choose pad positions for `nextPitches` given the previous chord's resolved
 * positions `prev` ([{pitch, serial}]). Pure; does not mutate inputs.
 *
 * Returns { ok:true, bindings:[{pitch,serial,row,col}] (pitch ascending),
 *           metrics:{ movedCommon, distance, area, rowSpan, colSpan,
 *                     matched, unmatchedPrev, unmatchedNext, tieCount } }
 *      or { ok:false, reason, bindings:[] } with reason one of
 *   'no_origin' (prev empty / missing: a seed is required),
 *   'invalid_origin' (prev serial out of range or not producing that pitch; `bad`),
 *   'invalid_pitch' (non-integer pitch), 'empty_pitches',
 *   'too_many_pitches' (more than PAD_NEAREST_MAX_PITCHES pads in prev or next),
 *   'unplaceable' (`unplaceablePitches`: no pad plays them).
 * No pitch is ever dropped silently.
 *
 * Duplicate pitches in `nextPitches` collapse to one pad (a pad plays a pitch
 * once). Different pitches never share a pad, so no collision can occur.
 * When the number of pads differs, the smaller side is fully matched and the
 * rest cost nothing (metrics.unmatchedPrev / unmatchedNext tell the caller).
 */
function padChooseNearestPositions(prev, nextPitches, options) {
  var L = padNearestLayout(options);
  if (!prev || prev.length === 0) return _padNearestFail('no_origin');
  var origin = _padNearestCheckBindings(prev, options);
  if (!origin.ok) return origin.tooMany ? _padNearestFail('too_many_pitches') : _padNearestFail('invalid_origin', { bad: origin.bad });
  var pitches = _padNearestUniquePitches(nextPitches || []);
  if (pitches === null) return _padNearestFail('invalid_pitch');
  if (pitches.length === 0) return _padNearestFail('empty_pitches');
  if (pitches.length > PAD_NEAREST_MAX_PITCHES) return _padNearestFail('too_many_pitches');

  var prevSerialByPitch = {};
  origin.bindings.forEach(function(b) { prevSerialByPitch[b.pitch] = b.serial; });
  var prevPads = origin.bindings.map(function(b) { return { row: b.row, col: b.col }; });

  var cands = pitches.map(function(p) { return _padNearestPadsForPitch(p, L); });
  var unplaceable = pitches.filter(function(p, i) { return cands[i].length === 0; });
  if (unplaceable.length) return _padNearestFail('unplaceable', { unplaceablePitches: unplaceable });

  var best = null;
  var tieCount = 0;
  var chosen = [];

  function cmpKey(a, b) {
    return a.moved - b.moved || a.distance - b.distance || a.maxDim - b.maxDim || a.area - b.area;
  }
  function cmpSerials(a, b) {
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  }

  function evaluate() {
    var moved = 0;
    var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    var serials = [];
    for (var i = 0; i < chosen.length; i++) {
      var pad = chosen[i];
      var serial = L.serialBase + pad.row * L.cols + pad.col;
      serials.push(serial);
      if (prevSerialByPitch[pitches[i]] !== undefined && prevSerialByPitch[pitches[i]] !== serial) moved++;
      if (pad.row < minR) minR = pad.row;
      if (pad.row > maxR) maxR = pad.row;
      if (pad.col < minC) minC = pad.col;
      if (pad.col > maxC) maxC = pad.col;
    }
    var rowSpan = maxR - minR + 1, colSpan = maxC - minC + 1;
    var cand = {
      moved: moved, distance: 0, area: rowSpan * colSpan, maxDim: Math.max(rowSpan, colSpan),
      rowSpan: rowSpan, colSpan: colSpan, serials: serials, pads: chosen.slice(),
    };
    // Distance is the costly part: skip it when rule 1 already loses.
    if (best && cand.moved > best.moved) return;
    cand.distance = _padMinManhattanMatching(prevPads, chosen);
    if (!best) { best = cand; tieCount = 1; return; }
    var c = cmpKey(cand, best);
    if (c < 0) { best = cand; tieCount = 1; }
    else if (c === 0) {
      tieCount++;
      if (cmpSerials(cand.serials, best.serials) < 0) best = cand;
    }
  }

  function walk(idx) {
    if (idx === pitches.length) { evaluate(); return; }
    for (var k = 0; k < cands[idx].length; k++) {
      chosen.push(cands[idx][k]);
      walk(idx + 1);
      chosen.pop();
    }
  }
  walk(0);

  var matched = Math.min(prevPads.length, pitches.length);
  return {
    ok: true,
    bindings: best.pads.map(function(pad, i) {
      return { pitch: pitches[i], serial: best.serials[i], row: pad.row, col: pad.col };
    }),
    metrics: {
      movedCommon: best.moved, distance: best.distance, area: best.area,
      rowSpan: best.rowSpan, colSpan: best.colSpan,
      matched: matched, unmatchedPrev: prevPads.length - matched,
      unmatchedNext: pitches.length - matched, tieCount: tieCount,
    },
  };
}

/**
 * Resolve a chord sequence. steps[i] = { pitches:[midi...], explicit?:[{pitch,serial}...] }.
 * steps[0] must carry `explicit` (the human seed). Any later step with
 * `explicit` is an override and becomes the origin for the following steps;
 * steps without it are derived from the previous resolved step.
 * `explicit` must cover exactly the step's pitches and each serial must
 * produce its pitch on the layout; otherwise the sequence stops.
 *
 * Returns { ok, results:[{index, ok, source:'seed'|'override'|'nearest', bindings, metrics?}],
 *           failedAt?, reason? }. Resolution stops at the first failing step
 * (nothing after it is guessed).
 */
function padResolveNearestSequence(steps, options) {
  var results = [];
  var origin = null;
  for (var i = 0; i < steps.length; i++) {
    var step = steps[i] || {};
    var res;
    if (step.explicit) {
      var pitches = _padNearestUniquePitches(step.pitches || []);
      var chk = _padNearestCheckBindings(step.explicit, options);
      if (pitches === null) res = _padNearestFail('invalid_pitch');
      else if (!chk.ok) res = chk.tooMany ? _padNearestFail('too_many_pitches') : _padNearestFail('invalid_explicit', { bad: chk.bad });
      else {
        var got = chk.bindings.map(function(b) { return b.pitch; });
        if (pitches.length === 0) res = _padNearestFail('empty_pitches');
        else if (got.length !== pitches.length || got.some(function(p, k) { return p !== pitches[k]; })) {
          res = _padNearestFail('explicit_pitch_mismatch');
        } else res = { ok: true, bindings: chk.bindings };
      }
      if (res.ok) res.source = i === 0 ? 'seed' : 'override';
    } else if (i === 0) {
      res = _padNearestFail('seed_required');
    } else {
      res = padChooseNearestPositions(origin, step.pitches, options);
      if (res.ok) res.source = 'nearest';
    }
    res.index = i;
    results.push(res);
    if (!res.ok) return { ok: false, results: results, failedAt: i, reason: res.reason };
    origin = res.bindings;
  }
  return { ok: true, results: results };
}

// ======== 押さえ方 第2版（任意に利用するAPI、PR27は互換維持） ========

function _padPositionConfig(options) {
  var base = PAD_POSITION_MODEL_V2;
  if (options && options.model !== undefined && (!options.model || typeof options.model !== 'object' || Array.isArray(options.model))) return null;
  var override = options && options.model || {};
  var model = {
    version: override.version || base.version,
    limits: Object.assign({}, base.limits, override.limits),
    weights: Object.assign({}, base.weights, override.weights),
    referenceBpm: override.referenceBpm === undefined ? base.referenceBpm : override.referenceBpm,
    movementExponent: override.movementExponent === undefined ? base.movementExponent : override.movementExponent,
    forms: override.forms === undefined ? base.forms : override.forms,
  };
  if (typeof model.version !== 'string' || !model.version) return null;
  var bpm = options && options.bpm !== undefined ? options.bpm : model.referenceBpm;
  var shift = options && options.octaveShift !== undefined ? options.octaveShift : 0;
  function positive(n) { return typeof n === 'number' && Number.isFinite(n) && n > 0; }
  if (!positive(bpm) || !positive(model.referenceBpm) || !positive(model.movementExponent) || model.movementExponent < 1 || !Number.isInteger(shift) ||
      !positive(model.limits.maxHandDistance) || !model.forms || typeof model.forms !== 'object') return null;
  for (var key of ['maxSteps', 'maxCandidates']) {
    if (!Number.isInteger(model.limits[key]) || model.limits[key] < 1 || model.limits[key] > base.limits[key]) return null;
  }
  for (var weight of Object.keys(model.weights)) {
    if (typeof model.weights[weight] !== 'number' || !Number.isFinite(model.weights[weight]) || model.weights[weight] < 0) return null;
  }
  var factor = Math.pow(bpm / model.referenceBpm, 2);
  if (!Number.isFinite(factor * model.weights.movement)) return null;
  var normalizedForms = Object.create(null);
  for (var quality of Object.keys(model.forms)) {
    var forms = model.forms[quality], ids = new Set();
    if (!Array.isArray(forms) || forms.length === 0 || forms.length > base.limits.maxCandidates) return null;
    normalizedForms[quality] = [];
    for (var form of forms) {
      if (!form || typeof form.id !== 'string' || !form.id || ids.has(form.id) ||
          typeof form.usageCost !== 'number' || !Number.isFinite(form.usageCost) || form.usageCost < 0) return null;
      ids.add(form.id);
      // 既存の調整用left/right手本も受ける。既定m7は手を推定しないgroups形式。
      var groups = form.groups;
      if (groups === undefined) {
        if (!Array.isArray(form.left) || !Array.isArray(form.right)) return null;
        groups = [{ id: 'left', degrees: form.left, hand: 'left' }, { id: 'right', degrees: form.right, hand: 'right' }];
      }
      if (!Array.isArray(groups) || groups.length !== 2) return null;
      var degrees = [], groupIds = new Set(), assignedHands = new Set();
      for (var group of groups) {
        if (!group || typeof group.id !== 'string' || !group.id || groupIds.has(group.id) ||
            !Array.isArray(group.degrees) || !group.degrees.length || !['left', 'right', 'unknown'].includes(group.hand)) return null;
        if (group.hand !== 'unknown') {
          if (assignedHands.has(group.hand)) return null;
          assignedHands.add(group.hand);
        }
        groupIds.add(group.id);
        degrees = degrees.concat(group.degrees);
      }
      if (degrees.length > PAD_NEAREST_MAX_PITCHES || new Set(degrees).size !== degrees.length ||
          !degrees.includes(0) || degrees.some(function(d) { return !Number.isInteger(d) || d < 0 || d > 11; })) return null;
      if (form.geometry !== undefined && (!form.geometry || typeof form.geometry !== 'object' || Array.isArray(form.geometry) || !groupIds.has(form.geometry.group) || !groupIds.has(form.geometry.relativeTo) ||
          form.geometry.group === form.geometry.relativeTo || !['left', 'right'].includes(form.geometry.side))) return null;
      normalizedForms[quality].push(Object.assign({}, form, { groups: groups }));
    }
  }
  model.forms = normalizedForms;
  return { model: model, bpm: bpm, movementWeight: model.weights.movement * factor };
}

function _padPositionHandSpan(hand) {
  var span = 0;
  for (var i = 0; i < hand.length; i++) {
    for (var j = i + 1; j < hand.length; j++) {
      span = Math.max(span, Math.abs(hand[i].row - hand[j].row) + Math.abs(hand[i].col - hand[j].col));
    }
  }
  return span;
}

function _padPositionCandidate(bindings, root, form, cfg, fixed) {
  var degrees = {};
  bindings.forEach(function(b) { degrees[((b.pitch - root) % 12 + 12) % 12] = b; });
  var groups = Object.create(null), hands = { left: null, right: null }, groupSpans = Object.create(null);
  form.groups.forEach(function(group) {
    var notes = group.degrees.slice().sort(function(a, b) { return a - b; }).map(function(d) {
      return Object.assign({ degree: d }, degrees[d]);
    });
    groups[group.id] = { notes: notes, hand: group.hand };
    groupSpans[group.id] = _padPositionHandSpan(notes);
    if (group.hand !== 'unknown') hands[group.hand] = notes;
  });
  // 手の左右と盤面の左右を分ける。手本の向きを対の平均列で分類する初期仮説。
  // 平均が同じ転回配置は両フォームに属し得る（HPS4→Fm7を排除しない）。
  var matchesGeometry = true;
  if (form.geometry) {
    var geometry = form.geometry;
    function meanCol(id) { return groups[id].notes.reduce(function(n, b) { return n + b.col; }, 0) / groups[id].notes.length; }
    var delta = meanCol(geometry.group) - meanCol(geometry.relativeTo);
    matchesGeometry = geometry.side === 'right' ? delta >= 0 : delta <= 0;
  }
  var spans = Object.values(groupSpans);
  var unreachable = Math.max.apply(null, spans) > cfg.model.limits.maxHandDistance;
  if ((!matchesGeometry || unreachable) && !fixed) return null;
  var balance = Math.abs(form.groups[0].degrees.length - form.groups[1].degrees.length);
  var weights = cfg.model.weights;
  var costs = {
    fingerDistance: weights.fingerDistance * spans.reduce(function(a, b) { return a + b; }, 0),
    balance: weights.balance * balance,
    usage: weights.usage * form.usageCost,
  };
  var cost = fixed ? 0 : costs.fingerDistance + costs.balance + costs.usage;
  if (!Number.isFinite(cost)) return null;
  return {
    ok: true, bindings: bindings, formId: form.id,
    internal: { groups: groups, hands: hands, reason: form.reason || '', fixed: fixed },
    metrics: { groupSpans: groupSpans,
      leftSpan: hands.left === null ? null : _padPositionHandSpan(hands.left),
      rightSpan: hands.right === null ? null : _padPositionHandSpan(hands.right), balance: balance,
      matchesGeometry: matchesGeometry, exceedsReach: unreachable, costs: costs, intrinsicCost: cost },
  };
}

/**
 * step={root: pitch class 0..11, quality:'m7'|'dom7'|手本で追加した質,
 *       pitches:[実MIDI], explicit?:[{pitch,serial}], formId?:内部のフォーム指定}。
 * options={octaveShift?, bpm?, model?:{version?,weights?,limits?,referenceBpm?,forms?}}。
 * 既定はm7の2つとdom7の右R+b7。指の推定・UI表示は行わない。
 * 同じ度数の重複オクターブ・shell・未登録の質は黙って一般形へ逃げない。
 * explicitは固定。未指定のformIdは幾何に合う最初の手本を使う。
 * 指間距離を超えるexplicitも動かさず、metrics.exceedsReachで伝える。
 */
function padEnumPerformancePositions(step, options) {
  var cfg = _padPositionConfig(options);
  if (!cfg) return _padNearestFail('invalid_model');
  if (!step || !Number.isInteger(step.root) || step.root < 0 || step.root > 11 || typeof step.quality !== 'string') {
    return _padNearestFail('harmony_required');
  }
  var allForms = Object.prototype.hasOwnProperty.call(cfg.model.forms, step.quality) ? cfg.model.forms[step.quality] : null;
  if (!allForms) return _padNearestFail('unsupported_quality');
  if (step.pitches !== undefined && !Array.isArray(step.pitches)) return _padNearestFail('invalid_pitch');
  var pitches = _padNearestUniquePitches(step.pitches || []);
  if (pitches === null) return _padNearestFail('invalid_pitch');
  if (!pitches.length) return _padNearestFail('empty_pitches');
  if (pitches.length > PAD_NEAREST_MAX_PITCHES) return _padNearestFail('too_many_pitches');
  var degrees = pitches.map(function(p) { return ((p - step.root) % 12 + 12) % 12; }).sort(function(a, b) { return a - b; });
  var forms = allForms.filter(function(f) {
    var expected = f.groups.flatMap(function(g) { return g.degrees; }).sort(function(a, b) { return a - b; });
    return expected.length === degrees.length && expected.every(function(d, i) { return d === degrees[i]; });
  });
  if (!forms.length) return _padNearestFail('unsupported_voicing');
  if (step.formId !== undefined) {
    forms = forms.filter(function(f) { return f.id === step.formId; });
    if (!forms.length) return _padNearestFail('unknown_form');
  }
  var fixed = step.explicit !== undefined;
  var pools, explicit;
  if (fixed) {
    if (!Array.isArray(step.explicit)) return _padNearestFail('invalid_explicit');
    var checked = _padNearestCheckBindings(step.explicit, options);
    if (!checked.ok) return checked.tooMany ? _padNearestFail('too_many_pitches') : _padNearestFail('invalid_explicit', { bad: checked.bad });
    explicit = checked.bindings;
    if (explicit.length !== pitches.length || explicit.some(function(b, i) { return b.pitch !== pitches[i]; })) {
      return _padNearestFail('explicit_pitch_mismatch');
    }
    // formId未指定なら手本の幾何に合うフォームを選ぶ。指定formIdは動かさない。
    forms = [forms.find(function(form) {
      return _padPositionCandidate(explicit, step.root, form, cfg, true).metrics.matchesGeometry;
    }) || forms[0]];
    pools = explicit.map(function(b) { return [b]; });
  } else {
    var layout = padNearestLayout(options);
    pools = pitches.map(function(p) {
      return _padNearestPadsForPitch(p, layout).map(function(pad) {
        return { pitch: p, serial: padRowColToSerial(pad.row, pad.col), row: pad.row, col: pad.col };
      });
    });
    var missing = pitches.filter(function(p, i) { return !pools[i].length; });
    if (missing.length) return _padNearestFail('unplaceable', { unplaceablePitches: missing });
  }
  // 上限で候補を切り捨てて最適と称さず、探索自体を明示的に止める。
  var count = pools.reduce(function(n, pool) { return n * pool.length; }, forms.length);
  if (count > cfg.model.limits.maxCandidates) return _padNearestFail('too_many_candidates');
  var candidates = [], chosen = [], rejected = 0, rejectedGeometry = 0;
  function walk(index) {
    if (index === pools.length) {
      forms.forEach(function(form) {
        var candidate = _padPositionCandidate(chosen.slice(), step.root, form, cfg, fixed);
        if (candidate) candidates.push(candidate);
        else {
          var diagnostic = _padPositionCandidate(chosen.slice(), step.root, form, cfg, true);
          if (diagnostic.metrics.exceedsReach) rejected++;
          if (!diagnostic.metrics.matchesGeometry) rejectedGeometry++;
        }
      });
      return;
    }
    pools[index].forEach(function(b) { chosen.push(b); walk(index + 1); chosen.pop(); });
  }
  walk(0);
  candidates.sort(function(a, b) {
    for (var i = 0; i < a.bindings.length; i++) {
      if (a.bindings[i].serial !== b.bindings[i].serial) return a.bindings[i].serial - b.bindings[i].serial;
    }
    return a.formId < b.formId ? -1 : a.formId > b.formId ? 1 : 0;
  });
  if (!candidates.length) return _padNearestFail('no_playable_form', { rejectedByReach: rejected, rejectedByGeometry: rejectedGeometry });
  return { ok: true, candidates: candidates, rejectedByReach: rejected, rejectedByGeometry: rejectedGeometry };
}

// 同じ度数の位置差が全て一致する時だけ厳密な平行移動。
function _padPositionParallel(a, b) {
  if (a.formId !== b.formId) return false;
  var dr = null, dc = null;
  // 度数はgroupsに持つ。手のunknownに左右を補わず同形を判定する。
  var prevNotes = Object.values(a.internal.groups).flatMap(function(g) { return g.notes; });
  var nextNotes = Object.values(b.internal.groups).flatMap(function(g) { return g.notes; });
  if (prevNotes.length !== nextNotes.length) return false;
  for (var p of prevNotes) {
    var q = nextNotes.find(function(n) { return n.degree === p.degree; });
    if (!q) return false;
    var r = q.row - p.row, c = q.col - p.col;
    if (dr === null) { dr = r; dc = c; }
    if (r !== dr || c !== dc) return false;
  }
  return true;
}

function _padPositionTransition(a, b, cfg) {
  var movement = 0, movementEffort = 0, movementGroups = Object.create(null);
  var movementBasis;
  function addMovement(id, prevNotes, nextNotes) {
    var distance = _padMinManhattanMatching(prevNotes, nextNotes);
    var matched = Math.min(prevNotes.length, nextNotes.length);
    var meanDistance = matched ? distance / matched : 0;
    // 1パッド以下は線形、それ以上は平均移動距離の累乗で負担を増す。
    // 手/まとまり単位なので、一方だけ大きく動く場合も合計で均さない。
    // キー・方向・盤端・フォームに特例を置かない。余り音は既存同様費用0。
    var effort = distance * Math.pow(Math.max(1, meanDistance), cfg.model.movementExponent - 1);
    movement += distance;
    movementEffort += effort;
    movementGroups[id] = { distance: distance, matched: matched, meanDistance: meanDistance, effort: effort };
  }
  if (a.internal.hands.left && a.internal.hands.right && b.internal.hands.left && b.internal.hands.right) {
    movementBasis = 'known-hands';
    for (var hand of ['left', 'right']) addMovement(hand, a.internal.hands[hand], b.internal.hands[hand]);
  } else {
    // 左右未指定なら同じ役割のまとまり同士。手を推定した移動費用ではない。
    movementBasis = 'role-groups';
    var groupIds = Object.keys(a.internal.groups);
    if (groupIds.some(function(id) { return !b.internal.groups[id]; })) return { cost: Infinity };
    for (var id of groupIds) addMovement(id, a.internal.groups[id].notes, b.internal.groups[id].notes);
  }
  var prev = {};
  a.bindings.forEach(function(p) { prev[p.pitch] = p.serial; });
  var movedCommon = b.bindings.filter(function(p) { return prev[p.pitch] !== undefined && prev[p.pitch] !== p.serial; }).length;
  var switched = a.formId !== b.formId;
  var parallel = _padPositionParallel(a, b);
  var costs = {
    movement: movementEffort * cfg.movementWeight,
    movedCommon: movedCommon * cfg.model.weights.movedCommon,
    formSwitch: switched ? cfg.model.weights.formSwitch : 0,
    shapeChange: !switched && !parallel ? cfg.model.weights.shapeChange : 0,
  };
  return { movement: movement, movementEffort: movementEffort, movementGroups: movementGroups,
    movementBasis: movementBasis, movedCommon: movedCommon, switched: switched, parallel: parallel,
    costs: costs, cost: costs.movement + costs.movedCommon + costs.formSwitch + costs.shapeChange };
}

/**
 * 進行全体の動的計画法。候補・形は各stepの実音高を変えない。
 * options.constantStructure=[{from,to}]（両端を含むindex）。自動で区間を作らない。
 * 指定区間内の隣接stepは同じフォームの厳密な平行移動に制限する。
 * seed/overrideとの衝突はstyle_conflict。届かない形を様式で復活させない。
 * PR27のpadResolveNearestSequenceとは別API。最初の失敗で止め、後ろは返さない。
 */
function padResolvePerformanceSequence(steps, options) {
  var cfg = _padPositionConfig(options);
  if (!cfg) return { ok: false, results: [], reason: 'invalid_model' };
  if (!Array.isArray(steps)) return { ok: false, results: [], reason: 'invalid_steps' };
  if (steps.length > cfg.model.limits.maxSteps) return { ok: false, results: [], reason: 'too_many_steps' };
  var ranges = options && options.constantStructure !== undefined ? options.constantStructure : [];
  if (!Array.isArray(ranges) || ranges.some(function(r) {
    return !r || !Number.isInteger(r.from) || !Number.isInteger(r.to) || r.from < 0 || r.to >= steps.length || r.from >= r.to;
  })) return { ok: false, results: [], reason: 'invalid_style' };
  if (!steps.length) return { ok: true, results: [], totalCost: 0 };
  var layers = [];
  function recover() {
    if (!layers.length) return [];
    var layer = layers[layers.length - 1], best = 0;
    for (var j = 1; j < layer.length; j++) if (layer[j].cost < layer[best].cost) best = j;
    var results = [];
    for (var index = layers.length - 1; index >= 0; index--) {
      var state = layers[index][best], candidate = state.candidate;
      results.unshift({ index: index, ok: true,
        source: steps[index].explicit !== undefined ? (index === 0 ? 'seed' : 'override') : 'performance',
        bindings: candidate.bindings, formId: candidate.formId, internal: candidate.internal,
        metrics: Object.assign({}, candidate.metrics, { transition: state.transition, cumulativeCost: state.cost }),
      });
      best = state.prev;
    }
    return results;
  }
  function fail(index, res) {
    var results = recover();
    results.push(Object.assign({ index: index }, res));
    return { ok: false, results: results, failedAt: index, reason: res.reason };
  }
  for (var i = 0; i < steps.length; i++) {
    if (i === 0 && (!steps[i] || steps[i].explicit === undefined)) return fail(i, _padNearestFail('seed_required'));
    var enumeration = padEnumPerformancePositions(steps[i], options);
    if (!enumeration.ok) return fail(i, enumeration);
    var strict = ranges.some(function(r) { return r.from < i && i <= r.to; });
    var nextLayer = [];
    for (var candidate of enumeration.candidates) {
      if (i === 0) { nextLayer.push({ candidate: candidate, cost: 0, prev: -1, transition: null }); continue; }
      var bestCost = Infinity, bestPrev = -1, bestTransition = null;
      for (var j = 0; j < layers[i - 1].length; j++) {
        var state = layers[i - 1][j];
        if (strict && !_padPositionParallel(state.candidate, candidate)) continue;
        var transition = _padPositionTransition(state.candidate, candidate, cfg);
        var cost = state.cost + transition.cost + candidate.metrics.intrinsicCost;
        if (Number.isFinite(cost) && cost < bestCost) { bestCost = cost; bestPrev = j; bestTransition = transition; }
      }
      if (bestPrev !== -1) nextLayer.push({ candidate: candidate, cost: bestCost, prev: bestPrev, transition: bestTransition });
    }
    if (!nextLayer.length) return fail(i, _padNearestFail(strict ? 'style_conflict' : 'cost_overflow'));
    layers.push(nextLayer);
  }
  var results = recover();
  return { ok: true, results: results, totalCost: results[results.length - 1].metrics.cumulativeCost,
    modelVersion: cfg.model.version, bpm: cfg.bpm };
}

// ======== CHORD CONTEXT KEY ========

function padChordContextKey(root, scaleIdx, key) {
  var scale = SCALES[scaleIdx];
  var rootIv = ((root - key) % 12 + 12) % 12;
  if (scale.pcs.includes(rootIv)) {
    return padGetParentMajorKey(scaleIdx, key);
  }
  return root;
}

// ======== CHORD NAME GENERATION ========

function padGetBuilderChordName(root, quality, tension, bass, scaleIdx, key) {
  if (root === null) return '';
  var rootKey = padChordContextKey(root, scaleIdx, key);
  var name = KEY_SPELLINGS[rootKey][root];
  if (quality) name += quality.name;
  if (tension) {
    var tl = tension.label.replace(/\)\n\(/g, ',').replace(/\n/g, '');
    var has7th = quality && (
      quality.pcs.includes(10) || quality.pcs.includes(11) ||
      (quality.pcs.includes(9) && quality.pcs.includes(6))
    );
    if (has7th) {
      if (tl === 'b5') {
        tl = '#11';
      } else if (tl.indexOf('b5(') === 0 || tl.indexOf('b5,') === 0) {
        var inner = tl.slice(2).replace(/[()]/g, '');
        var parts = inner.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        parts.push('#11');
        var ORDER = {'b9':1,'#9':2,'9':3,'11':4,'#11':5,'b13':6,'13':7};
        parts.sort(function(a, b) { return (ORDER[a] || 99) - (ORDER[b] || 99); });
        tl = parts.join(',');
      }
    }
    if (quality && quality.name !== '') {
      if (tl === 'aug') {
        tl = '(#5)';
      } else if (tl.indexOf('aug(') === 0) {
        var inner2 = tl.slice(4, -1);
        var parts2 = inner2.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        parts2.push('#5');
        var ORDER2 = {'#5':0,'b9':1,'#9':2,'9':3,'11':4,'#11':5,'b13':6,'13':7};
        parts2.sort(function(a, b) { return (ORDER2[a] || 99) - (ORDER2[b] || 99); });
        tl = '(' + parts2.join(',') + ')';
      }
    }
    var noWrap = tl.indexOf('(') === 0 || tl.indexOf('sus') === 0 || tl.indexOf('aug') === 0 ||
                 tl.indexOf('add') === 0 || tl.indexOf('b5') === 0 || tl.indexOf('6') === 0;
    if (noWrap) {
      name += tl;
    } else {
      name += '(' + tl + ')';
    }
  }
  if (bass !== null) {
    name += '/' + KEY_SPELLINGS[rootKey][bass];
  }
  return name;
}

// ======== DIATONIC CHORDS (Triads & Tetrads) ========

function padGetDiatonicTetrads(scalePCS, key, noteCount) {
  if (scalePCS.length !== 7) return [];
  if (noteCount === undefined) noteCount = 4;
  var ROMAN = ['I','II','III','IV','V','VI','VII'];
  var tetrads = [];
  for (var i = 0; i < 7; i++) {
    var rootIv = scalePCS[i];
    var i3 = ((scalePCS[(i + 2) % 7] - rootIv) + 12) % 12;
    var i5 = ((scalePCS[(i + 4) % 7] - rootIv) + 12) % 12;
    var i7 = ((scalePCS[(i + 6) % 7] - rootIv) + 12) % 12;

    var pcs, quality;
    if (noteCount === 3) {
      pcs = [0, i3, i5];
      quality = null;
      for (var r = 0; r < BUILDER_QUALITIES.length; r++) {
        for (var c = 0; c < BUILDER_QUALITIES[r].length; c++) {
          var q = BUILDER_QUALITIES[r][c];
          if (q && q.pcs.length === 3 &&
              q.pcs[1] === i3 && q.pcs[2] === i5) {
            quality = q; break;
          }
        }
        if (quality) break;
      }
      if (!quality) quality = {name:'?', label:'?', pcs: pcs};
    } else {
      pcs = [0, i3, i5, i7];
      quality = null;
      for (var r = 0; r < BUILDER_QUALITIES.length; r++) {
        for (var c = 0; c < BUILDER_QUALITIES[r].length; c++) {
          var q = BUILDER_QUALITIES[r][c];
          if (q && q.pcs.length === 4 &&
              q.pcs[1] === i3 && q.pcs[2] === i5 && q.pcs[3] === i7) {
            quality = q; break;
          }
        }
        if (quality) break;
      }
      if (!quality && i3 === 4 && i5 === 8 && i7 === 11) {
        quality = {name:'aug\u25B37', label:'aug\u25B37', pcs:[0,4,8,11]};
      }
      if (!quality) quality = {name:'?', label:'?', pcs: pcs};
    }

    var rootPC = (rootIv + key) % 12;
    var parentKey = padGetParentMajorKey(0, key);
    var chordName = KEY_SPELLINGS[parentKey][rootPC] + quality.name;

    var roman = ROMAN[i];
    // Add b/# prefix when scale degree differs from major scale
    var MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
    var degreePrefix = '';
    if (scalePCS[i] < MAJOR_INTERVALS[i]) degreePrefix = 'b';
    else if (scalePCS[i] > MAJOR_INTERVALS[i]) degreePrefix = '#';
    var suffix;
    if (noteCount === 3) {
      // Triad roman numerals: same convention as tetrads (upper + suffix)
      switch (quality.name) {
        case '':    suffix = ''; break;              // Major triad
        case 'm':   suffix = 'm'; break;
        case 'dim': suffix = 'dim'; break;
        case 'aug': suffix = '+'; break;
        default:    suffix = ''; break;
      }
    } else {
      switch (quality.name) {
        case '\u25B37': suffix = '\u25B37'; break;
        case '7':       suffix = '7'; break;
        case 'm7':      suffix = 'm7'; break;
        case 'm\u25B37': suffix = 'm\u25B37'; break;
        case 'm7(b5)':  suffix = 'm7(b5)'; break;
        case 'dim7':    suffix = 'dim7'; break;
        case 'aug\u25B37': suffix = 'aug\u25B37'; break;
        default:        suffix = ''; break;
      }
    }
    var degree = degreePrefix + roman + suffix;

    tetrads.push({ rootPC: rootPC, pcs: pcs, quality: quality, chordName: chordName, degree: degree });
  }
  return tetrads;
}

// ======== DIATONIC CHORD DATABASE ========

function _psKeyName(entry) {
  var relMajor = entry.system === '○' ? entry.parentKey : (entry.parentKey + 3) % 12;
  return FLAT_MAJOR_KEYS.has(relMajor) ? NOTE_NAMES_FLAT[entry.parentKey] : NOTE_NAMES_SHARP[entry.parentKey];
}

function _getParentScaleAbsPCS(entry) {
  var scalePCS;
  if (entry.system === '○') scalePCS = SCALES[0].pcs;
  else if (entry.system === 'NM') scalePCS = SCALES[5].pcs;
  else if (entry.system === '■') scalePCS = SCALES[7].pcs;
  else scalePCS = SCALES[14].pcs;
  return new Set(scalePCS.map(function(pc) { return (pc + entry.parentKey) % 12; }));
}

function _psDegreeLabel(degreeNum, quality) {
  var ROMAN = ['I','II','III','IV','V','VI','VII'];
  var roman = ROMAN[degreeNum - 1];
  var name = quality.name;
  if (name.indexOf('m') === 0 || name === 'dim' || name === 'dim7') {
    roman = roman.toLowerCase();
  }
  var suffix = '';
  switch (name) {
    case '\u25B37': suffix = '\u25B37'; break;
    case '7': suffix = '7'; break;
    case 'm7': suffix = '7'; break;
    case 'm\u25B37': suffix = '\u25B37'; break;
    case 'm7(b5)': suffix = '\u00F87'; break;
    case 'dim7': suffix = '\u00B07'; break;
    case 'aug\u25B37': suffix = '+\u25B37'; break;
    default: break;
  }
  return roman + suffix;
}

var DIATONIC_CHORD_DB = (function() {
  var db = {};
  var SYSTEMS = [
    { cat: '○', label: 'Major', baseIdx: 0, scalePCS: SCALES[0].pcs },
    { cat: '■', label: 'Harm.Min', baseIdx: 7, scalePCS: SCALES[7].pcs },
    { cat: '◆', label: 'Mel.Min', baseIdx: 14, scalePCS: SCALES[14].pcs },
  ];
  for (var s = 0; s < SYSTEMS.length; s++) {
    var sys = SYSTEMS[s];
    for (var key = 0; key < 12; key++) {
      var tetrads = padGetDiatonicTetrads(sys.scalePCS, key);
      for (var i = 0; i < tetrads.length; i++) {
        var t = tetrads[i];
        var degreeNum = i + 1;
        if (!db[t.rootPC]) db[t.rootPC] = [];
        db[t.rootPC].push({
          parentKey: key, system: sys.cat, systemLabel: sys.label,
          degreeNum: degreeNum, scaleName: SCALES[sys.baseIdx + i].name,
          scaleIdx: sys.baseIdx + i, rootPC: t.rootPC,
          quality: t.quality, tetradPCS: t.quality.pcs,
        });
        if (sys.cat === '○') {
          db[t.rootPC].push({
            parentKey: (key + 9) % 12, system: 'NM', systemLabel: 'Nat.Min',
            degreeNum: ((degreeNum + 1) % 7) + 1,
            scaleName: SCALES[i].name, scaleIdx: i, rootPC: t.rootPC,
            quality: t.quality, tetradPCS: t.quality.pcs,
          });
        }
      }
    }
  }
  return db;
})();

// ======== PARENT SCALE REVERSE LOOKUP ========

function padFindParentScales(rootPC, chordIntervals, currentKey) {
  var entries = DIATONIC_CHORD_DB[rootPC];
  if (!entries) return [];
  var results = [];
  var strictKeys = new Set();

  var isMaj6 = chordIntervals.has(4) && chordIntervals.has(9) &&
    !chordIntervals.has(10) && !chordIntervals.has(11);
  var flat7AbsPC = (rootPC + 10) % 12;

  for (var e = 0; e < entries.length; e++) {
    var entry = entries[e];
    var scaleAbsPCS = _getParentScaleAbsPCS(entry);
    var allIn = true;
    var iter = chordIntervals.values();
    var next = iter.next();
    while (!next.done) {
      var absPC = (next.value + rootPC) % 12;
      if (!scaleAbsPCS.has(absPC)) { allIn = false; break; }
      next = iter.next();
    }
    if (!allIn) continue;
    if (isMaj6 && scaleAbsPCS.has(flat7AbsPC)) continue;
    var key = entry.parentKey + ':' + entry.scaleIdx;
    strictKeys.add(key);
    var sat = SCALE_AVAIL_TENSIONS[entry.scaleIdx];
    var avoidCount = (sat && sat.avoid) ? sat.avoid.length : 0;
    results.push({
      parentKey: entry.parentKey, parentKeyName: _psKeyName(entry),
      system: entry.system, systemLabel: entry.systemLabel,
      degree: _psDegreeLabel(entry.degreeNum, entry.quality),
      degreeNum: entry.degreeNum, scaleName: entry.scaleName,
      scaleIdx: entry.scaleIdx, distance: padFifthsDistance(currentKey, entry.parentKey),
      omit5Match: false, avoidCount: avoidCount,
    });
  }

  if (chordIntervals.has(7)) {
    var omit5Intervals = new Set(chordIntervals);
    omit5Intervals.delete(7);
    for (var e2 = 0; e2 < entries.length; e2++) {
      var entry2 = entries[e2];
      var key2 = entry2.parentKey + ':' + entry2.scaleIdx;
      if (strictKeys.has(key2)) continue;
      var scaleAbsPCS2 = _getParentScaleAbsPCS(entry2);
      var allIn2 = true;
      var iter2 = omit5Intervals.values();
      var next2 = iter2.next();
      while (!next2.done) {
        var absPC2 = (next2.value + rootPC) % 12;
        if (!scaleAbsPCS2.has(absPC2)) { allIn2 = false; break; }
        next2 = iter2.next();
      }
      if (!allIn2) continue;
      if (isMaj6 && scaleAbsPCS2.has(flat7AbsPC)) continue;
      var sat2 = SCALE_AVAIL_TENSIONS[entry2.scaleIdx];
      var avoidCount2 = (sat2 && sat2.avoid) ? sat2.avoid.length : 0;
      results.push({
        parentKey: entry2.parentKey, parentKeyName: _psKeyName(entry2),
        system: entry2.system, systemLabel: entry2.systemLabel,
        degree: _psDegreeLabel(entry2.degreeNum, entry2.quality),
        degreeNum: entry2.degreeNum, scaleName: entry2.scaleName,
        scaleIdx: entry2.scaleIdx, distance: padFifthsDistance(currentKey, entry2.parentKey),
        omit5Match: true, avoidCount: avoidCount2,
      });
    }
  }

  // Non-diatonic scales (symmetric)
  var NON_DIATONIC_SCALES = [
    { scaleIdx: 25, needsAll: [10] },
    { scaleIdx: 26, needsAll: [4, 10] },
    { scaleIdx: 27, needsAll: [3, 6] },
  ];
  var ndMatched = new Set();
  for (var n = 0; n < NON_DIATONIC_SCALES.length; n++) {
    var nd = NON_DIATONIC_SCALES[n];
    if (nd.needsAll && !nd.needsAll.every(function(iv) { return chordIntervals.has(iv); })) continue;
    var scalePCSSet = new Set(SCALES[nd.scaleIdx].pcs);
    var allIn3 = true;
    var iter3 = chordIntervals.values();
    var next3 = iter3.next();
    while (!next3.done) {
      if (!scalePCSSet.has(next3.value % 12)) { allIn3 = false; break; }
      next3 = iter3.next();
    }
    if (!allIn3) continue;
    ndMatched.add(nd.scaleIdx);
    var sat3 = SCALE_AVAIL_TENSIONS[nd.scaleIdx];
    var avoidCount3 = (sat3 && sat3.avoid) ? sat3.avoid.length : 0;
    results.push({
      parentKey: rootPC, parentKeyName: '',
      system: '', systemLabel: '',
      degree: '', degreeNum: 0,
      scaleName: SCALES[nd.scaleIdx].name,
      scaleIdx: nd.scaleIdx, distance: 0,
      omit5Match: false, avoidCount: avoidCount3,
    });
  }
  if (chordIntervals.has(7)) {
    var omit5Ivs = new Set(chordIntervals);
    omit5Ivs.delete(7);
    for (var n2 = 0; n2 < NON_DIATONIC_SCALES.length; n2++) {
      var nd2 = NON_DIATONIC_SCALES[n2];
      if (ndMatched.has(nd2.scaleIdx)) continue;
      if (nd2.needsAll && !nd2.needsAll.every(function(iv) { return omit5Ivs.has(iv); })) continue;
      var scalePCSSet2 = new Set(SCALES[nd2.scaleIdx].pcs);
      var allIn4 = true;
      var iter4 = omit5Ivs.values();
      var next4 = iter4.next();
      while (!next4.done) {
        if (!scalePCSSet2.has(next4.value % 12)) { allIn4 = false; break; }
        next4 = iter4.next();
      }
      if (!allIn4) continue;
      var sat4 = SCALE_AVAIL_TENSIONS[nd2.scaleIdx];
      var avoidCount4 = (sat4 && sat4.avoid) ? sat4.avoid.length : 0;
      results.push({
        parentKey: rootPC, parentKeyName: '',
        system: '', systemLabel: '',
        degree: '', degreeNum: 0,
        scaleName: SCALES[nd2.scaleIdx].name,
        scaleIdx: nd2.scaleIdx, distance: 0,
        omit5Match: true, avoidCount: avoidCount4,
      });
    }
  }

  var SYS_ORDER = { '○': 0, 'NM': 1, '■': 2, '◆': 3 };
  results.sort(function(a, b) {
    return (a.omit5Match - b.omit5Match) ||
      (a.distance - b.distance) || (SYS_ORDER[a.system] || 99) - (SYS_ORDER[b.system] || 99) || (a.degreeNum - b.degreeNum);
  });
  return results;
}

// ======== GUITAR/BASS CHORD FORM ENUMERATION ========

function padDecodeGuitarFretKey(key) {
  var out = [];
  for (var i = 0; i < key.length; i++) {
    var ch = key.charAt(i);
    if (ch === 'x') out.push(null);
    else if (ch >= 'a' && ch <= 'z') out.push(ch.charCodeAt(0) - 97 + 10);
    else out.push(parseInt(ch, 10));
  }
  return out;
}

function padEncodeGuitarFretKey(frets) {
  return frets.map(function(f) {
    if (f === null) return 'x';
    if (f >= 10) return String.fromCharCode(97 + f - 10);
    return String(f);
  }).join('');
}

function padGetGuitarTuningName(tuning, options) {
  if (options && options.tuningName) return options.tuningName;
  if (typeof PAD_GUITAR_TUNING === 'undefined') return null;
  if (!tuning || tuning.length !== PAD_GUITAR_TUNING.length) return null;
  for (var i = 0; i < tuning.length; i++) {
    if (tuning[i] !== PAD_GUITAR_TUNING[i]) return null;
  }
  return 'standard';
}

function padGetGuitarChordKey(rootPC, chordPCS) {
  return rootPC + '|' + chordPCS.join(',');
}

function padGetGuitarFormKnowledge(frets, chordPCS, rootPC, tuning, options) {
  if (typeof PAD_GUITAR_FORM_KNOWLEDGE === 'undefined') return null;
  var tuningName = padGetGuitarTuningName(tuning, options);
  if (!tuningName || !PAD_GUITAR_FORM_KNOWLEDGE[tuningName]) return null;
  var chordKey = padGetGuitarChordKey(rootPC, chordPCS);
  var byChord = PAD_GUITAR_FORM_KNOWLEDGE[tuningName][chordKey];
  if (!byChord) return null;
  return byChord[padEncodeGuitarFretKey(frets)] || null;
}

function padGetGuitarPositionFamily(frets) {
  if (typeof PAD_GUITAR_POSITION_FAMILIES === 'undefined') return null;
  var minFret = Infinity;
  var maxFret = 0;
  for (var i = 0; i < frets.length; i++) {
    if (frets[i] !== null && frets[i] > 0) {
      if (frets[i] < minFret) minFret = frets[i];
      if (frets[i] > maxFret) maxFret = frets[i];
    }
  }
  if (minFret === Infinity) return null;
  for (var pi = 0; pi < PAD_GUITAR_POSITION_FAMILIES.length; pi++) {
    var family = PAD_GUITAR_POSITION_FAMILIES[pi];
    if (minFret >= family.minFret && maxFret <= family.maxFret) {
      return {
        id: family.id,
        label: family.label,
        minFret: family.minFret,
        maxFret: family.maxFret,
        source: family.source,
      };
    }
  }
  return null;
}

function padApplyGuitarFormKnowledge(form, chordPCS, rootPC, tuning, options) {
  var meta = padGetGuitarFormKnowledge(form.frets, chordPCS, rootPC, tuning, options);
  form.referenceMeta = meta || null;
  form.positionFamily = padGetGuitarPositionFamily(form.frets);
  if (meta && meta.movable !== undefined) {
    form.movable = !!meta.movable;
  } else {
    form.movable = form.frets.indexOf(0) === -1;
  }
  if (meta && meta.fingerings && meta.fingerings.length > 0) {
    var fingering = meta.fingerings[0];
    if (fingering.fingers) form.fingers = fingering.fingers.slice();
    form.barre = fingering.barre || null;
    form.fingeringNote = fingering.note || '';
  }
  if (meta && meta.nonBarre && Array.isArray(form.qualityIssues)) {
    form.qualityIssues = form.qualityIssues.filter(function(issue) {
      return issue !== 'broken_barre';
    });
    form.isBrokenBarre = false;
  }
  return form;
}

function padGuitarReferenceVariantBonus(frets, refArrays, rootPC, tuning) {
  var best = 0;
  for (var ri = 0; ri < refArrays.length; ri++) {
    var ref = refArrays[ri];
    if (!ref || ref.length !== frets.length) continue;
    var muted = [];
    var ok = true;
    for (var i = 0; i < frets.length; i++) {
      if (frets[i] === ref[i]) continue;
      if (frets[i] === null && ref[i] !== null) {
        muted.push(i);
        continue;
      }
      ok = false;
      break;
    }
    if (!ok || muted.length === 0 || muted.length > 1) continue;

    var soundingFirst = -1;
    var soundingLast = -1;
    for (var si = 0; si < frets.length; si++) {
      if (frets[si] !== null) {
        if (soundingFirst === -1) soundingFirst = si;
        soundingLast = si;
      }
    }
    var onlyOuterMutes = true;
    for (var mi = 0; mi < muted.length; mi++) {
      if (muted[mi] >= soundingFirst && muted[mi] <= soundingLast) {
        onlyOuterMutes = false;
        break;
      }
    }
    if (!onlyOuterMutes) continue;

    var score = 70;
    var mutedLowSideOnly = muted.every(function(idx) { return idx > soundingLast; });
    var mutedHighSideOnly = muted.every(function(idx) { return idx < soundingFirst; });
    if (mutedLowSideOnly) score = 110;
    if (mutedHighSideOnly) score = 25;

    var fifthPC = (rootPC + 7) % 12;
    for (var di = 0; di < muted.length; di++) {
      var idx = muted[di];
      var refPC = (tuning[idx] + ref[idx]) % 12;
      if (refPC === fifthPC) score += 45;
    }
    if (score > best) best = score;
  }
  return best;
}

function padEnumGuitarChordForms(chordPCS, rootPC, tuning, maxFrets, maxSpan, options) {
  if (!options) options = {};
  var minNotes = options.minNotes !== undefined ? options.minNotes : 3;
  var maxResults = options.maxResults !== undefined ? options.maxResults : 15;
  var allowRootless = !!options.allowRootless;
  var noOpen = !!options.noOpen; // funk/soul: no open strings (can't mute for tight rhythm)

  // Reference voicing lookup: detect tuning, build reference set for this chord.
  // Unknown tunings (8-string, open tunings without reference data) get no bonus,
  // so the scoring logic alone determines ranking — this is by design.
  var refSet = null;
  var refArrays = null;
  if (typeof PAD_GUITAR_REFERENCE_FORMS !== 'undefined') {
    var tuningName = padGetGuitarTuningName(tuning, options);
    if (tuningName && PAD_GUITAR_REFERENCE_FORMS[tuningName]) {
      var chordKey = padGetGuitarChordKey(rootPC, chordPCS);
      var refForms = PAD_GUITAR_REFERENCE_FORMS[tuningName][chordKey];
      if (refForms) {
        refSet = {};
        refArrays = [];
        for (var ri = 0; ri < refForms.length; ri++) {
          refSet[refForms[ri]] = true;
          refArrays.push(padDecodeGuitarFretKey(refForms[ri]));
        }
      }
    }
  }

  // Scoring weights: override via options.weights for genre presets (bossa/jazz/funk)
  var W = options.weights || {};
  var wRootBass   = W.rootBass   !== undefined ? W.rootBass   : 120;
  var wFifthBass  = W.fifthBass  !== undefined ? W.fifthBass  : 100;
  var wRootStr6   = W.rootStr6   !== undefined ? W.rootStr6   : 50;
  var wRootStr5   = W.rootStr5   !== undefined ? W.rootStr5   : 30;
  var wRootStr4   = W.rootStr4   !== undefined ? W.rootStr4   : 20;
  var wTop4       = W.top4       !== undefined ? W.top4       : 30;
  var wGuideTone  = W.guideTone  !== undefined ? W.guideTone  : 40;
  var wOpenStr    = W.openStr    !== undefined ? W.openStr    : 10;
  var wStringCount= W.stringCount!== undefined ? W.stringCount: 30;
  var wAvgFret    = W.avgFret    !== undefined ? W.avgFret    : 12;
  var wSpan       = W.span       !== undefined ? W.span       : 10;
  var wGaps       = W.gaps       !== undefined ? W.gaps       : 15;
  var wFullFret   = W.fullFret   !== undefined ? W.fullFret   : 15;
  var wClosedAForm= W.closedAForm!== undefined ? W.closedAForm: 80;
  var wMajor7OpenCluster = W.major7OpenCluster !== undefined ? W.major7OpenCluster : 150;
  var preferRootBass = options.preferRootBass !== false;

  // Fifth is optional when chord has tensions (9th+), since guitar has only 6 strings.
  // BUT: altered 5ths (b5=6, #5=8) that REPLACE the natural 5th define chord quality
  // (dim, m7b5, aug) and must NOT be omitted.
  // When both natural 5th and b5/#5 coexist (e.g. #11 = compound b5), 5th is still optional.
  var hasTensions = false;
  var hasNatural5th = false;
  var hasAltered5th = false;
  for (var i = 0; i < chordPCS.length; i++) {
    if (chordPCS[i] >= 13) hasTensions = true;
    var iv = chordPCS[i] % 12;
    if (iv === 7) hasNatural5th = true;
    if (iv === 6 || iv === 8) hasAltered5th = true;
  }
  var alteredFifthIsChordTone = hasAltered5th && !hasNatural5th;
  // Fifth is optional when: 7th/6th present (R37 shell voicing is standard),
  // or fifthOptional option. Guitar has 4 fingers = 5th is first to drop.
  // NOTE: tensions alone (e.g. add9 = triad+9) do NOT make 5th optional.
  // add9's 5th is part of the triad foundation — only omit when 7th provides the shell.
  var has7or6 = false;
  for (var i = 0; i < chordPCS.length; i++) {
    var iv = chordPCS[i] % 12;
    if (iv === 9 || iv === 10 || iv === 11) has7or6 = true;
  }
  var fifthIsOptional = (has7or6 || !!options.fifthOptional) && !alteredFifthIsChordTone;

  // Compute absolute pitch class set
  var chordAbsPCS = {};
  for (var i = 0; i < chordPCS.length; i++) {
    chordAbsPCS[(rootPC + (chordPCS[i] % 12)) % 12] = true;
  }

  // Check if chord has a 3rd, 6th, 7th (for filtering and guide tone bonus)
  var has3 = false, has4 = false, has6thInChord = false, has7thInChord = false, hasMajor7thInChord = false;
  for (var i = 0; i < chordPCS.length; i++) {
    var iv = chordPCS[i] % 12;
    if (iv === 3) has3 = true;
    if (iv === 4) has4 = true;
    if (iv === 9) has6thInChord = true;
    if (iv === 10 || iv === 11) has7thInChord = true;
    if (iv === 11) hasMajor7thInChord = true;
  }
  var hasThirdInChord = has3 || has4;
  var third3PC = (rootPC + 3) % 12;
  var third4PC = (rootPC + 4) % 12;

  var numStrings = tuning.length;

  // Build candidate frets per string: [null(mute), valid frets...]
  var candidates = [];
  for (var s = 0; s < numStrings; s++) {
    var openPC = tuning[s] % 12;
    var cands = [null];
    for (var f = (noOpen ? 1 : 0); f <= maxFrets; f++) {
      if (chordAbsPCS[(openPC + f) % 12]) cands.push(f);
    }
    candidates.push(cands);
  }

  var results = [];
  var chosen = new Array(numStrings);

  function search(si, fMin, fMax, count) {
    if (si === numStrings) {
      if (count < minNotes) return;
      var span = (fMin <= fMax) ? fMax - fMin + 1 : 0;
      if (span > maxSpan) return;

      // Collect pitch classes, MIDI notes, and find bass (lowest MIDI)
      var notePCs = {};
      var midiNotes = {};
      var lowestMidi = Infinity, lowestPC = -1;
      for (var i = 0; i < numStrings; i++) {
        if (chosen[i] !== null) {
          var midi = tuning[i] + chosen[i];
          notePCs[midi % 12] = true;
          // Unison avoidance: reject exact same MIDI note on two fretted strings.
          // Exception: open string unisons are allowed — guitarists use them
          // intentionally for richer sound (chorus effect from string detuning).
          if (midiNotes[midi]) {
            if (chosen[i] > 0 && midiNotes[midi] > 0) return; // both fretted = reject
            // at least one is open = allow (but flag for scoring)
          }
          midiNotes[midi] = chosen[i] > 0 ? 1 : -1; // 1=fretted, -1=open
          if (midi < lowestMidi) { lowestMidi = midi; lowestPC = midi % 12; }
        }
      }

      // Filter: must have root (unless rootless allowed)
      var isRootless = !notePCs[rootPC];
      if (isRootless && !allowRootless) return;
      // Filter: must have 3rd if chord defines one
      if (hasThirdInChord && !notePCs[third3PC] && !notePCs[third4PC]) return;
      // Filter: all pitch classes must be present, except:
      // - root (when rootless allowed)
      // - natural 5th (when fifthIsOptional — tension chords, 7th chords, etc.)
      // Tension notes themselves are NEVER optional.
      var fifthPC = (rootPC + 7) % 12;
      for (var pc in chordAbsPCS) {
        var p = parseInt(pc);
        if (isRootless && p === rootPC) continue;
        if (fifthIsOptional && p === fifthPC) continue;
        if (!notePCs[pc]) return;
      }

      // Finger unit feasibility: max 4 fingers available
      // Finger unit feasibility: barre = lowest fret pressed by index finger.
      // Barre is valid if no OPEN strings (fret 0) break it — muted strings
      // are OK (barre finger rests on them to mute). Open strings need to
      // ring freely, so they break the barre into separate finger units.
      var fretGroups = {};
      var minFrettedFret = Infinity;
      for (var i = 0; i < numStrings; i++) {
        if (chosen[i] !== null && chosen[i] > 0) {
          if (!fretGroups[chosen[i]]) fretGroups[chosen[i]] = [];
          fretGroups[chosen[i]].push(i);
          if (chosen[i] < minFrettedFret) minFrettedFret = chosen[i];
        }
      }
      var fingerUnits = 0;
      var isBrokenBarre = false;
      for (var fret in fretGroups) {
        var strs = fretGroups[fret].slice().sort(function(a, b) { return a - b; });
        if (parseInt(fret) === minFrettedFret && strs.length >= 2) {
          if (strs.length === 2) {
            fingerUnits += 2;
            for (var bi2 = strs[0] + 1; bi2 < strs[1]; bi2++) {
              if (chosen[bi2] === null) { isBrokenBarre = true; break; }
            }
            continue;
          }
          // Barre candidate: check if strings are contiguous
          // (allowing higher-fretted strings in between, but not muted/open)
          var barreFirst = strs[0], barreLast = strs[strs.length - 1];
          // Barre valid if no OPEN strings (fret 0) between barre strings.
          // Muted strings (null) between barre strings are OK — barre finger
          // rests on the string to mute it. This is standard technique.
          // Open strings (fret 0) break the barre — can't barre through an
          // open string that needs to ring freely.
          var barreValid = true;
          for (var bi = barreFirst + 1; bi < barreLast; bi++) {
            if (chosen[bi] === 0) {
              barreValid = false; // open string breaks barre
              break;
            }
          }
          if (barreValid) {
            fingerUnits += 1; // valid barre: 1 unit (even with muted strings)
            // Still flag as "soft" broken barre for scoring penalty
            // if there are muted strings in between (less stable)
            for (var bi = barreFirst + 1; bi < barreLast; bi++) {
              if (chosen[bi] === null) { isBrokenBarre = true; break; }
            }
          } else {
            // Hard broken barre (open string): count contiguous groups
            isBrokenBarre = true;
            var groups = 1;
            for (var gi = 1; gi < strs.length; gi++) {
              if (strs[gi] !== strs[gi - 1] + 1) groups++;
            }
            fingerUnits += groups;
          }
        } else if (parseInt(fret) === minFrettedFret && strs.length === 1) {
          fingerUnits += 1; // single string at min fret
        } else {
          var groups = 1;
          for (var gi = 1; gi < strs.length; gi++) {
            if (strs[gi] !== strs[gi - 1] + 1) groups++;
          }
          fingerUnits += groups;
        }
      }
      if (fingerUnits > 4) return;

      // Finger reach check: index (lowest fret) and pinky (highest fret)
      // must not be too far apart in BOTH fret and string dimensions.
      // Fret span is already checked (maxSpan=4). But if the highest fret
      // note is on a distant string from the lowest, the hand can't reach.
      if (minFrettedFret < Infinity) {
        var maxFret = 0, maxFretStr = -1, minFretStr = -1;
        for (var i = 0; i < numStrings; i++) {
          if (chosen[i] !== null && chosen[i] > 0) {
            if (chosen[i] === minFrettedFret && minFretStr === -1) minFretStr = i;
            if (chosen[i] > maxFret) { maxFret = chosen[i]; maxFretStr = i; }
          }
        }
        if (minFretStr !== -1 && maxFretStr !== -1) {
          var fretDiff = maxFret - minFrettedFret;
          var strDist = Math.abs(maxFretStr - minFretStr);
          // fretDiff 3+ across 4+ strings = physically very difficult
          // (pinky and index too far apart in both dimensions)
          if (fretDiff >= 3 && strDist >= 4) return;
        }
      }

      // Above-barre spread check: notes above the barre must be within a
      // reasonable window. Relaxed when fret difference is small (1-2 frets)
      // because fingers can reach across the neck at adjacent frets easily
      // (e.g. G chord 320003: fret 3 on strings 1 and 6, barre at fret 2).
      if (minFrettedFret < Infinity) {
        var aboveMinStr = -1, aboveMaxStr = -1, maxAboveFret = 0;
        for (var i = 0; i < numStrings; i++) {
          if (chosen[i] !== null && chosen[i] > minFrettedFret) {
            if (aboveMinStr === -1) aboveMinStr = i;
            aboveMaxStr = i;
            if (chosen[i] > maxAboveFret) maxAboveFret = chosen[i];
          }
        }
        var aboveSpread = aboveMaxStr - aboveMinStr;
        var aboveFretDiff = maxAboveFret - minFrettedFret;
        // Wide spread only OK if fret difference is small (1-3 frets).
        // 3-fret diff with wide spread is playable with barre anchor
        // (e.g. C#m [9,x,6,6,7,9]: barre at 6, fingers reach fret 9).
        if (aboveSpread > 4 && aboveFretDiff > 3) return;
        if (aboveSpread > 3 && aboveFretDiff > 3) return;
      }

      // Count gaps (muted strings between outermost sounding strings)
      // Also count "open gaps": muted string adjacent to an open string
      // = fingerpicking only (can't strum/mute cleanly)
      var hiStr = -1, loStr = -1; // hiStr = lowest index (highest pitch)
      for (var i = 0; i < numStrings; i++) {
        if (chosen[i] !== null) {
          if (hiStr === -1) hiStr = i;
          loStr = i;
        }
      }
      var gaps = 0, openGaps = 0;
      for (var i = hiStr + 1; i < loStr; i++) {
        if (chosen[i] === null) {
          gaps++;
          // Check if adjacent sounding strings include an open string
          var prevOpen = (i > 0 && chosen[i - 1] === 0);
          var nextOpen = false;
          for (var j = i + 1; j < numStrings; j++) {
            if (chosen[j] !== null) { nextOpen = (chosen[j] === 0); break; }
          }
          if (prevOpen || nextOpen) openGaps++;
        }
      }

      // Sandwiched open: open string between two fretted strings.
      // Open string vibration clashes with fretted notes — uncommon technique.
      var sandwichedOpen = 0;
      for (var i = hiStr; i <= loStr; i++) {
        if (chosen[i] !== 0) continue;
        // Find nearest sounding string on each side
        var leftFretted = false, rightFretted = false;
        for (var j = i - 1; j >= 0; j--) {
          if (chosen[j] === null) continue;
          leftFretted = (chosen[j] > 0); break;
        }
        for (var j = i + 1; j < numStrings; j++) {
          if (chosen[j] === null) continue;
          rightFretted = (chosen[j] > 0); break;
        }
        if (leftFretted && rightFretted) sandwichedOpen++;
      }

      results.push({
        frets: chosen.slice(),
        bassPC: lowestPC,
        bassString: loStr,
        rootInBass: lowestPC === rootPC,
        fifthInBass: lowestPC === ((rootPC + 7) % 12),
        isRootless: isRootless,
        stringCount: count,
        span: span,
        gaps: gaps,
        openGaps: openGaps,
        sandwichedOpen: sandwichedOpen,
        fingerUnits: fingerUnits,
        isBrokenBarre: isBrokenBarre,
      });
      return;
    }

    var remaining = numStrings - si - 1;
    var cands = candidates[si];
    for (var c = 0; c < cands.length; c++) {
      var fret = cands[c];
      var newMin = fMin, newMax = fMax, newCount = count;

      if (fret !== null) {
        newCount++;
        if (fret > 0) {
          newMin = Math.min(fMin, fret);
          newMax = Math.max(fMax, fret);
          if (newMax - newMin + 1 > maxSpan) continue;
        }
      }
      if (newCount + remaining < minNotes) continue;

      chosen[si] = fret;
      search(si + 1, newMin, newMax, newCount);
    }
  }

  search(0, Infinity, 0, 0);

  // add9/sus2 genre bonus: these chords are genre-signaling.
  // Open-string voicings (Police/British) and upper-string partials (R&B/gospel)
  // should rank higher than generic barre shapes.
  var isAdd9Type = hasTensions && !has7or6;  // 9th present but no 7th = add chord
  var isSus2 = false;
  for (var i = 0; i < chordPCS.length; i++) {
    if (chordPCS[i] === 2 && !has3 && !has4) isSus2 = true;
  }
  var addSusBoost = isAdd9Type || isSus2;

  // Sort by weighted score (higher = better)
  // Balances string count against fret position so open chords rank well
  function sortScore(r) {
    var avgFret = 0, n = 0;
    var minFret = Infinity;
    for (var i = 0; i < r.frets.length; i++) {
      if (r.frets[i] !== null && r.frets[i] > 0) {
        avgFret += r.frets[i];
        if (r.frets[i] < minFret) minFret = r.frets[i];
        n++;
      }
    }
    avgFret = n > 0 ? avgFret / n : 0;
    // Fifth-in-bass bonus: bossa batida plays R+5 on bass strings (thumb)
    // Results in 2nd inversion voicings (C/G, Am/E) as standard bossa forms
    var fifthBassBonus = 0;
    if (!r.rootInBass && wFifthBass > 0) {
      var fifthPC = (rootPC + 7) % 12;
      if (r.bassPC === fifthPC) fifthBassBonus = wFifthBass;
    }

    // CAGED root string bonus: 6th (E form), 5th (A form), 4th (D form)
    var rootStrBonus = 0;
    if (r.rootInBass && numStrings === 6) {
      if (r.bassString === 5) rootStrBonus = wRootStr6;
      else if (r.bassString === 4) rootStrBonus = wRootStr5;
      else if (r.bassString === 3) rootStrBonus = wRootStr4;
    }
    // Top-4-string comping bonus: strings 1-4 only (jazz/funk standard)
    var top4Bonus = 0;
    if (numStrings === 6 && r.frets[4] === null && r.frets[5] === null) {
      var soundingCount = 0;
      for (var i = 0; i < 4; i++) { if (r.frets[i] !== null) soundingCount++; }
      if (soundingCount >= 3) top4Bonus = wTop4;
    }
    // Guide tone bonus: 3rd + 7th (or 3rd + 6th for 6th chords) = harmonically complete
    // Shell voicing core: R37 for 7th chords, R36 for 6th chords (bossa/jazz standard)
    var guideToneBonus = 0;
    var has3rdInForm = false, has7thInForm = false, has6thInForm = false;
    for (var i = 0; i < r.frets.length; i++) {
      if (r.frets[i] !== null) {
        var pc = (tuning[i] + r.frets[i]) % 12;
        if (pc === third3PC || pc === third4PC) has3rdInForm = true;
        var fromRoot = ((pc - rootPC) + 12) % 12;
        if (fromRoot === 10 || fromRoot === 11) has7thInForm = true;
        if (fromRoot === 9) has6thInForm = true;
      }
    }
    // R37 shell (7th chords) or R36 shell (6th chords without 7th)
    if (has3rdInForm && has7thInForm) guideToneBonus = wGuideTone;
    else if (has3rdInForm && has6thInForm && has6thInChord && !has7thInChord) guideToneBonus = wGuideTone;

    // Open string bonus/penalty: sliding scale based on fret position.
    // Pure open chord (avgFret≈1): full bonus. Higher frets: bonus shrinks
    // then flips to penalty. Standard barre always beats scattered open+fret.
    var openBonus = 0;
    var openCount = 0;
    var maxFret = 0;
    if (!noOpen) {
      for (var i = 0; i < r.frets.length; i++) {
        if (r.frets[i] === 0) openCount++;
        if (r.frets[i] !== null && r.frets[i] > maxFret) maxFret = r.frets[i];
      }
      if (openCount > 0) {
        // factor: 1.0 at avgFret=0, 0.5 at avgFret=3, 0.0 at avgFret=5, negative above
        // Standard open chords (C, Am, G, D) have avgFret 1-3 → strong bonus
        var openFactor = 1 - (avgFret / 5);
        openBonus = openCount * wOpenStr * openFactor;
      }
    }

    // Full-fret bonus: all sounding strings are fretted (no open strings).
    // Rewards standard barre shapes over open-string variants at same position.
    var fullFretBonus = 0;
    if (openCount === 0) fullFretBonus = wFullFret;

    // add9/sus2 genre boost: open-string voicings (Police) and
    // upper-string partials (R&B/gospel) are the standard approaches.
    var addSusOpenBonus = 0, addSusTop3Bonus = 0;
    if (addSusBoost) {
      // Boost open-string voicings (British/Police: arpeggiated open add9)
      if (openCount >= 1 && avgFret <= 3) addSusOpenBonus = 60;
      // Boost upper-string partials: only strings 1-3 (R&B/gospel: partial voicing)
      if (numStrings === 6 && r.frets[3] === null && r.frets[4] === null && r.frets[5] === null) {
        var top3count = 0;
        for (var i = 0; i < 3; i++) { if (r.frets[i] !== null) top3count++; }
        if (top3count >= 3) addSusTop3Bonus = 50;
      }
    }

    // Open+high fret stretch penalty: physical distance from nut to fret 4+
    // while keeping a string open is a big stretch. Standard open chords max
    // at fret 3 (G major). Fret 4+ with open strings = non-standard stretch.
    // Exception: open string is root or 5th = musically justified (e.g. Am with open A)
    var stretchPenalty = 0;
    if (openCount > 0 && maxFret >= 4) {
      var fifthPC = (rootPC + 7) % 12;
      var openIsRoot = false, openIsFifth = false;
      for (var si = 0; si < r.frets.length; si++) {
        if (r.frets[si] === 0) {
          var openPC = tuning[si] % 12;
          if (openPC === rootPC) openIsRoot = true;
          if (openPC === fifthPC) openIsFifth = true;
        }
      }
      // Reduced penalty when open string is musically justified
      var stretchFactor = (openIsRoot || openIsFifth) ? 15 : 40;
      stretchPenalty = (maxFret - 3) * stretchFactor;
    }

    // Broken barre penalty: barre at minFret has muted/open strings in between.
    // These forms are physically awkward compared to contiguous barre shapes.
    var brokenBarrePenalty = r.isBrokenBarre ? 60 : 0;

    // Overcrowded penalty: 6 strings with wide span = fingers can't fit.
    // Span 4 + 6 strings = borderline (some are standard barre shapes).
    // Only heavy penalty for span 5+ (truly impossible).
    var overcrowdedPenalty = 0;
    if (r.stringCount >= 6 && r.span >= 5) overcrowdedPenalty = 80;
    else if (r.stringCount >= 6 && r.span >= 4) overcrowdedPenalty = 30;
    else if (r.stringCount >= 5 && r.span >= 5) overcrowdedPenalty = 50;

    // Thin high-position penalty: 3-string forms at fret 3+ are rarely useful.
    // Exception: top-4 comping (already has top4Bonus if applicable).
    var thinPenalty = 0;
    if (r.stringCount <= 3 && avgFret >= 3) thinPenalty = 30;

    // Reference bonus: human-verified voicing from reference database.
    // These are forms that real guitarists actually play.
    // Bonus is large enough to pull high-position forms into top results,
    // but not so large that it overrides all other scoring.
    var refBonus = 0;
    if (refSet) {
      var fretKey = padEncodeGuitarFretKey(r.frets);
      if (refSet[fretKey]) refBonus = 200;
      else if (refArrays) refBonus = padGuitarReferenceVariantBonus(r.frets, refArrays, rootPC, tuning);
    }

    var formKnowledge = padGetGuitarFormKnowledge(r.frets, chordPCS, rootPC, tuning, options);
    var knowledgeBonus = formKnowledge && formKnowledge.rankBonus ? formKnowledge.rankBonus : 0;
    if (formKnowledge && formKnowledge.genreBonuses && options.genre && formKnowledge.genreBonuses[options.genre]) {
      knowledgeBonus += formKnowledge.genreBonuses[options.genre];
    }

    var closedAFormBonus = 0;
    if (numStrings === 6 && has7or6 && r.rootInBass && r.bassString === 4 && openCount === 0) {
      closedAFormBonus = wClosedAForm;
    }

    // Muting both outer E strings while sounding the middle strings is playable,
    // but it asks for two independent edge mutes. Keep it available, not early.
    var edgeMutePenalty = 0;
    if (numStrings === 6 && openCount > 0 &&
        r.frets[0] === null && r.frets[1] !== null &&
        r.frets[5] === null && r.frets[4] !== null) {
      edgeMutePenalty = 110;
    }

    // Root on 6th string with the 5th string fretted behind it is a suspicious
    // closed grip for 7th-family chords. The sound can be valid, but the left
    // hand often becomes harder than the diagram suggests.
    var root6LowerAStringPenalty = 0;
    if (numStrings === 6 && r.rootInBass && r.bassString === 5 && has7or6 &&
        r.frets[5] !== null && r.frets[5] > 0 &&
        r.frets[4] !== null && r.frets[4] > 0 &&
        r.frets[4] < r.frets[5]) {
      root6LowerAStringPenalty = 110;
    }

    var openMutePenalty = 0;
    if (openCount > 0 && (r.gaps > 0 || r.openGaps > 0)) {
      openMutePenalty = 70 + r.gaps * 25 + r.openGaps * 60;
    }

    var openHighStringConflictPenalty = 0;
    if (numStrings === 6 && r.frets[0] === 0 && r.frets[1] !== null && r.frets[1] > 0 && maxFret >= 4) {
      openHighStringConflictPenalty = 120;
    }

    var highStringGapPenalty = 0;
    if (numStrings === 6 && r.frets[0] !== null && r.frets[1] === null) {
      highStringGapPenalty = 120;
    }

    var major7OpenClusterPenalty = 0;
    if (hasMajor7thInChord && openCount >= 2) {
      major7OpenClusterPenalty = wMajor7OpenCluster;
    }

    var lowPositionWideStretchPenalty = 0;
    if (has7or6 && openCount === 0 && r.span >= 4 && minFret <= 1) {
      lowPositionWideStretchPenalty = 80;
    }

    return (r.rootInBass ? wRootBass : 0)
      + fifthBassBonus
      + rootStrBonus
      + top4Bonus
      + guideToneBonus
      + openBonus
      + fullFretBonus
      + addSusOpenBonus
      + addSusTop3Bonus
      + refBonus
      + knowledgeBonus
      + closedAFormBonus
      + r.stringCount * wStringCount
      - avgFret * wAvgFret
      - r.span * wSpan
      - r.gaps * wGaps
      - r.openGaps * 40 // fingerpicking-only: mute between open strings
      - r.sandwichedOpen * 25 // open string vibration clashes with fretted neighbors
      - brokenBarrePenalty
      - overcrowdedPenalty
      - thinPenalty
      - stretchPenalty
      - edgeMutePenalty
      - root6LowerAStringPenalty
      - openMutePenalty
      - openHighStringConflictPenalty
      - highStringGapPenalty
      - major7OpenClusterPenalty
      - lowPositionWideStretchPenalty;
  }

  if (allowRootless) {
    // Partition: rooted first, rootless after (each sorted independently)
    var rooted = [], rootless = [];
    for (var i = 0; i < results.length; i++) {
      if (results[i].isRootless) rootless.push(results[i]);
      else rooted.push(results[i]);
    }
    rooted.sort(function(a, b) { return sortScore(b) - sortScore(a); });
    rootless.sort(function(a, b) { return sortScore(b) - sortScore(a); });
    var maxRootless = options.maxRootless !== undefined ? options.maxRootless : 5;
    return rooted.slice(0, maxResults).concat(rootless.slice(0, maxRootless));
  }

  results.sort(function(a, b) {
    return sortScore(b) - sortScore(a);
  });

  // add9/sus2: pin #1 = best open-string voicing, #2 = best 6th-string-root.
  // These two are the standard approaches (Police open vs barre).
  if (addSusBoost && results.length >= 2 && numStrings === 6) {
    var bestOpen = -1, bestStr6Root = -1;
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (bestOpen === -1) {
        for (var s = 0; s < 6; s++) { if (r.frets[s] === 0) { bestOpen = i; break; } }
      }
      if (bestStr6Root === -1 && r.rootInBass && r.bassString === 5) {
        bestStr6Root = i;
      }
      if (bestOpen !== -1 && bestStr6Root !== -1) break;
    }
    // Move to front: open → #0, 6th-root → #1 (splice order matters)
    var pinned = [];
    if (bestOpen !== -1) pinned.push(results.splice(bestOpen, 1)[0]);
    if (bestStr6Root !== -1) {
      // Adjust index if open was before str6root
      var adj = (bestOpen !== -1 && bestOpen < bestStr6Root) ? bestStr6Root - 1 : bestStr6Root;
      pinned.push(results.splice(adj, 1)[0]);
    }
    results = pinned.concat(results);
  }

  if (preferRootBass) {
    var rootBassResults = [];
    var nonRootBassResults = [];
    for (var ri2 = 0; ri2 < results.length; ri2++) {
      if (results[ri2].rootInBass) rootBassResults.push(results[ri2]);
      else nonRootBassResults.push(results[ri2]);
    }
    if (rootBassResults.length > 0) {
      results = rootBassResults.concat(nonRootBassResults);
    }
  }

  var finalResults = results.slice(0, maxResults);
  // Enrich results with finger assignments and barre info
  for (var fi = 0; fi < finalResults.length; fi++) {
    var fa = padAssignFingers(finalResults[fi].frets);
    finalResults[fi].fingers = fa.fingers;
    finalResults[fi].barre = fa.barre;
    finalResults[fi].qualityIssues = padAnalyzeGuitarFormQuality(
      finalResults[fi].frets,
      chordPCS,
      rootPC,
      tuning,
      { maxSpan: maxSpan, maxFingerUnits: 4 }
    ).issues;
    padApplyGuitarFormKnowledge(finalResults[fi], chordPCS, rootPC, tuning, options);
  }
  return finalResults;
}

function padAnalyzeGuitarFormQuality(frets, chordPCS, rootPC, tuning, options) {
  if (!options) options = {};
  var maxSpan = options.maxSpan !== undefined ? options.maxSpan : 4;
  var maxFingerUnits = options.maxFingerUnits !== undefined ? options.maxFingerUnits : 4;
  var issues = [];
  var pcs = {};
  var midiSeen = {};
  var sounding = 0;
  var fMin = Infinity;
  var fMax = 0;
  var lowestMidi = Infinity;
  var lowestPC = -1;
  var hiStr = -1;
  var loStr = -1;
  var openCount = 0;

  for (var i = 0; i < frets.length; i++) {
    var fret = frets[i];
    if (fret === null) continue;
    sounding++;
    if (hiStr === -1) hiStr = i;
    loStr = i;
    if (fret === 0) openCount++;
    if (fret > 0) {
      if (fret < fMin) fMin = fret;
      if (fret > fMax) fMax = fret;
    }
    var midi = tuning[i] + fret;
    var pc = midi % 12;
    pcs[pc] = true;
    if (midiSeen[midi] && fret > 0 && midiSeen[midi] > 0) {
      issues.push('duplicate_fretted_midi');
    }
    midiSeen[midi] = fret > 0 ? 1 : -1;
    if (midi < lowestMidi) {
      lowestMidi = midi;
      lowestPC = pc;
    }
  }

  var span = (fMin <= fMax) ? fMax - fMin + 1 : 0;
  if (span > maxSpan) issues.push('span_too_wide');
  if (!pcs[rootPC]) issues.push('missing_root');

  var has3 = false;
  var has4 = false;
  var chordAbsPCS = {};
  var has7or6 = false;
  var hasMajor7thInChord = false;
  var hasNatural5th = false;
  var hasAltered5th = false;
  for (var ci = 0; ci < chordPCS.length; ci++) {
    var iv = chordPCS[ci] % 12;
    if (iv === 3) has3 = true;
    if (iv === 4) has4 = true;
    if (iv === 7) hasNatural5th = true;
    if (iv === 6 || iv === 8) hasAltered5th = true;
    if (iv === 9 || iv === 10 || iv === 11) has7or6 = true;
    if (iv === 11) hasMajor7thInChord = true;
    chordAbsPCS[(rootPC + iv) % 12] = true;
  }
  var third3PC = (rootPC + 3) % 12;
  var third4PC = (rootPC + 4) % 12;
  if ((has3 || has4) && !pcs[third3PC] && !pcs[third4PC]) issues.push('missing_third');

  var fifthPC = (rootPC + 7) % 12;
  var alteredFifthIsChordTone = hasAltered5th && !hasNatural5th;
  var fifthIsOptional = has7or6 && !alteredFifthIsChordTone;
  for (var pc in chordAbsPCS) {
    var p = parseInt(pc);
    if (fifthIsOptional && p === fifthPC) continue;
    if (!pcs[p]) issues.push('missing_required_note_' + ((p - rootPC + 12) % 12));
  }

  if (lowestPC === fifthPC && lowestPC !== rootPC) issues.push('fifth_in_bass');

  var fingerData = padEstimateGuitarFingerUnits(frets);
  if (fingerData.fingerUnits > maxFingerUnits) issues.push('too_many_finger_units');
  if (fingerData.isBrokenBarre) issues.push('broken_barre');

  var gaps = 0;
  for (var gi = hiStr + 1; gi < loStr; gi++) {
    if (frets[gi] === null) gaps++;
  }
  if (gaps > 0) issues.push('interior_gap');
  if (openCount > 0 && gaps > 0) issues.push('open_mute_difficulty');
  if (sounding <= 3 && fMin >= 3) issues.push('thin_high_position');
  if (sounding >= 6 && span >= 5) issues.push('overcrowded');
  if (openCount > 0 &&
      frets.length === 6 && frets[0] === null && frets[1] !== null &&
      frets[5] === null && frets[4] !== null) {
    issues.push('edge_mute_difficulty');
  }
  if (frets.length === 6 && frets[0] === 0 &&
      frets[1] !== null && frets[1] > 0 &&
      fMax >= 4) {
    issues.push('open_high_string_conflict');
  }
  if (frets.length === 6 && frets[0] !== null && frets[1] === null) {
    issues.push('high_string_gap');
  }
  if (hasMajor7thInChord && openCount >= 2) {
    issues.push('major7_open_cluster');
  }
  if (has7or6 && openCount === 0 && span >= 4 && fMin <= 1) {
    issues.push('low_position_wide_stretch');
  }
  if (frets.length === 6 && lowestPC === rootPC && has7or6 &&
      frets[5] !== null && frets[5] > 0 &&
      frets[4] !== null && frets[4] > 0 &&
      frets[4] < frets[5]) {
    issues.push('root6_lower_a_string');
  }

  return {
    issues: issues,
    bassPC: lowestPC,
    rootInBass: lowestPC === rootPC,
    fifthInBass: lowestPC === fifthPC && lowestPC !== rootPC,
    stringCount: sounding,
    span: span,
    fingerUnits: fingerData.fingerUnits,
    isBrokenBarre: fingerData.isBrokenBarre,
  };
}

function padEstimateGuitarFingerUnits(frets) {
  var fretGroups = {};
  var minFrettedFret = Infinity;
  for (var i = 0; i < frets.length; i++) {
    if (frets[i] !== null && frets[i] > 0) {
      if (!fretGroups[frets[i]]) fretGroups[frets[i]] = [];
      fretGroups[frets[i]].push(i);
      if (frets[i] < minFrettedFret) minFrettedFret = frets[i];
    }
  }
  var fingerUnits = 0;
  var isBrokenBarre = false;
  for (var fret in fretGroups) {
    var strs = fretGroups[fret].slice().sort(function(a, b) { return a - b; });
    if (parseInt(fret) === minFrettedFret && strs.length >= 2) {
      if (strs.length === 2) {
        fingerUnits += 2;
        for (var bi2 = strs[0] + 1; bi2 < strs[1]; bi2++) {
          if (frets[bi2] === null) { isBrokenBarre = true; break; }
        }
        continue;
      }
      var barreFirst = strs[0];
      var barreLast = strs[strs.length - 1];
      var barreValid = true;
      for (var bi = barreFirst + 1; bi < barreLast; bi++) {
        if (frets[bi] === 0) { barreValid = false; break; }
      }
      if (barreValid) {
        fingerUnits += 1;
        for (var mi = barreFirst + 1; mi < barreLast; mi++) {
          if (frets[mi] === null) { isBrokenBarre = true; break; }
        }
      } else {
        isBrokenBarre = true;
        var groups = 1;
        for (var gi = 1; gi < strs.length; gi++) {
          if (strs[gi] !== strs[gi - 1] + 1) groups++;
        }
        fingerUnits += groups;
      }
    } else if (parseInt(fret) === minFrettedFret && strs.length === 1) {
      fingerUnits += 1;
    } else {
      var groups2 = 1;
      for (var gi2 = 1; gi2 < strs.length; gi2++) {
        if (strs[gi2] !== strs[gi2 - 1] + 1) groups2++;
      }
      fingerUnits += groups2;
    }
  }
  return { fingerUnits: fingerUnits, isBrokenBarre: isBrokenBarre };
}

// ======== FINGER ASSIGNMENT ========
// Assigns finger numbers (1-4) to fretted strings based on JGuitar conventions.
// Input: frets array (null=muted, 0=open, 1+=fretted). Index 0=high E, 5=low E.
// Returns: {fingers: [null/0/1/2/3/4 per string], barre: {fret, from, to} | null}
//
// Rules:
// - Finger 1 (index) = lowest fretted note. Barre when physically needed.
// - Barre when: fretted notes > 4 (can't cover with individual fingers)
//   or 3+ strings at minFret (natural barre position).
// - Remaining fretted notes get fingers 2, 3, 4 in order of fret ascending.
// - Same fret: bass-side string (higher index) gets lower finger number.

function padAssignFingers(frets) {
  var numStrings = frets.length;
  var fingers = new Array(numStrings);
  var frettedPositions = [];

  for (var i = 0; i < numStrings; i++) {
    if (frets[i] === null) {
      fingers[i] = null;
    } else if (frets[i] === 0) {
      fingers[i] = 0;
    } else {
      fingers[i] = -1; // placeholder: to be assigned
      frettedPositions.push({string: i, fret: frets[i]});
    }
  }

  if (frettedPositions.length === 0) {
    return {fingers: fingers, barre: null};
  }

  // Find minimum fretted fret
  var minFret = Infinity;
  for (var i = 0; i < frettedPositions.length; i++) {
    if (frettedPositions[i].fret < minFret) minFret = frettedPositions[i].fret;
  }

  // Strings at minimum fret
  var minFretStrings = [];
  for (var i = 0; i < frettedPositions.length; i++) {
    if (frettedPositions[i].fret === minFret) {
      minFretStrings.push(frettedPositions[i].string);
    }
  }
  minFretStrings.sort(function(a, b) { return a - b; });

  // Determine barre: used when physically needed or when 3+ strings at minFret
  var barre = null;
  var useBarre = minFretStrings.length >= 2 &&
    (frettedPositions.length > 4 || minFretStrings.length >= 3);

  if (useBarre) {
    var fromStr = minFretStrings[0];
    var toStr = minFretStrings[minFretStrings.length - 1];
    // Verify barre geometry: no lower fret between endpoints
    var valid = true;
    for (var s = fromStr + 1; s < toStr; s++) {
      if (frets[s] !== null && frets[s] > 0 && frets[s] < minFret) {
        valid = false;
        break;
      }
    }
    if (valid) {
      barre = {fret: minFret, from: fromStr, to: toStr};
      for (var i = 0; i < minFretStrings.length; i++) {
        fingers[minFretStrings[i]] = 1;
      }
    }
  }

  // If no barre, assign finger 1 to the bass-side string at minFret
  // (index finger naturally sits closer to bass end of the neck)
  if (!barre) {
    fingers[minFretStrings[minFretStrings.length - 1]] = 1;
  }

  // Collect remaining unassigned fretted positions
  var unassigned = [];
  for (var i = 0; i < numStrings; i++) {
    if (frets[i] !== null && frets[i] > 0 && fingers[i] === -1) {
      unassigned.push({string: i, fret: frets[i]});
    }
  }

  // Sort: fret ascending, then string descending (bass side gets lower finger number)
  unassigned.sort(function(a, b) {
    if (a.fret !== b.fret) return a.fret - b.fret;
    return b.string - a.string;
  });

  // Assign fingers 2, 3, 4
  var nextFinger = 2;
  for (var i = 0; i < unassigned.length; i++) {
    if (nextFinger <= 4) {
      fingers[unassigned[i].string] = nextFinger;
      nextFinger++;
    } else {
      // Overflow: more fretted notes than fingers available.
      // Assign finger 4 (pinky shares duty in dense voicings).
      fingers[unassigned[i].string] = 4;
    }
  }

  return {fingers: fingers, barre: barre};
}

// ======== CHORD DETECTION ========
// Detect chord name from MIDI notes. Returns array of {name, rootPC, score} sorted by score.
// Uses CHORD_DETECT_DB, TRIAD_DETECT_DB, TETRAD_DETECT_DB from data.js.

function padChordIntervalNoteName(rootPC, notePC) {
  var interval = ((notePC - rootPC) + 12) % 12;
  return (interval === 1 || interval === 3 || interval === 6 || interval === 8 || interval === 10)
    ? NOTE_NAMES_FLAT[notePC]
    : NOTE_NAMES_SHARP[notePC];
}

function padPreferredRootNoteName(pc, spellingKey) {
  var key = spellingKey;
  if (key === null || key === undefined) key = 0;
  return (KEY_SPELLINGS[key] || NOTE_NAMES_FLAT)[pc];
}

function padShellScoreBonus(intervals) {
  var hasThird = intervals[3] || intervals[4];
  var hasSeventh = intervals[10] || intervals[11];
  if (hasThird && hasSeventh) return 80;
  if (hasThird) return 20;
  return 0;
}

function padHasBassShell(pcs, bassPC) {
  var intervals = {};
  for (var i = 0; i < pcs.length; i++) intervals[((pcs[i] - bassPC) + 12) % 12] = true;
  return (intervals[3] || intervals[4]) && (intervals[10] || intervals[11]);
}

function padDetectedPc8Role(chordName, chordPCS, intervals) {
  var name = chordName || '';
  var pcs = chordPCS || [];
  if (name.indexOf('b13') >= 0) return 'b13';
  if (!intervals[8] || pcs.indexOf(8) >= 0) return null;
  // With an actual flat seventh, pc8 may function as altered b13.
  if (pcs.indexOf(10) >= 0) return 'b13';
  // Over a plain major/minor triad, the same pc is a lower-sixth color,
  // not a thirteenth. This keeps line-cliche spelling distinct.
  if (name === 'Maj' || name === 'm' || name === 'maj' || name === '') return 'b6';
  return null;
}

function padAppendDetectedPc8Role(chordName, chordPCS, intervals) {
  var role = padDetectedPc8Role(chordName, chordPCS, intervals);
  var name = chordName || '';
  if (!role || name.indexOf(role) >= 0) return name;
  if (role === 'b6' && (name === 'Maj' || name === 'maj' || name === '')) return '(b6)';
  var trailing = name.match(/^(.*)\(([^()]*)\)$/);
  if (trailing) return trailing[1] + '(' + trailing[2] + ',' + role + ')';
  return name + '(' + role + ')';
}

function padPc8SemanticPenalty(chordName, chordPCS, intervals) {
  var name = chordName || '';
  var pcs = chordPCS || [];
  var role = padDetectedPc8Role(name, pcs, intervals);
  var penalty = (role === 'b6' || role === 'b13') ? 40 : 0;
  // #5/aug is structural only when the natural fifth is not simultaneously
  // defining the observed collection. Do not let subset matching hide 5+#5.
  var isAugmented = name.indexOf('aug') >= 0 || name.indexOf('#5') >= 0 || name === '+';
  if (isAugmented && pcs.indexOf(8) >= 0 && pcs.indexOf(7) < 0 && intervals[7]) penalty += 60;
  return penalty;
}

function padAugAlteredPenalty(chordName, intervals) {
  if ((chordName || '').indexOf('aug') < 0) return 0;
  var hasDominantSeventh = intervals[10];
  var hasAlteredDominantColor = intervals[1] || intervals[3] || intervals[6] || intervals[8];
  return hasDominantSeventh && hasAlteredDominantColor ? 140 : 0;
}

function padRejectDominantSlashOverBassShell(chordName, rootPC, lowestPC, lowestHasShell) {
  return lowestHasShell
    && rootPC !== lowestPC
    && /^7/.test(chordName || '');
}

function padIsUnnameableMajorSplitThirdColor(pcs, bassPC) {
  var intervals = {};
  for (var i = 0; i < pcs.length; i++) intervals[((pcs[i] - bassPC) + 12) % 12] = true;
  return !!((intervals[10] && intervals[11])
    || (intervals[3] && intervals[4] && intervals[11] && !intervals[10]));
}

function padIsAllowedSlashChordCandidate(qualityName, qualityPcs, upperRootPC, bassPC) {
  var bassFromUpper = ((bassPC - upperRootPC) + 12) % 12;
  if (qualityPcs.indexOf(bassFromUpper) !== -1) return true;

  var upperFromBass = ((upperRootPC - bassPC) + 12) % 12;
  if (qualityName === 'Maj') {
    return upperFromBass === 6   // bV / bass: altered/condim dominant color
      || upperFromBass === 7     // V / bass: transparent no3 major color
      || upperFromBass === 10;   // bVII / bass: sus/pedal-dominant color
  }
  if (qualityName === 'm') {
    return upperFromBass === 10; // bVIIm / bass: dark sus/phrygian color
  }
  if (qualityName === 'Maj7') {
    return upperFromBass === 10; // bVIIMaj7 / bass: sus13 or minor 9/11 color
  }
  if (qualityName === 'm7') {
    return upperFromBass === 10; // bVIIm7 / bass: phrygian-sus hybrid
  }
  if (qualityName === 'm6') {
    return upperFromBass === 1   // bIIm6 / bass: altered dominant candidate
      || upperFromBass === 10;   // bVIIm6 / bass: phrygian-sus candidate
  }
  if (qualityName === 'dim7') {
    return upperFromBass === 1;  // bIIdim7 / bass: condim dominant candidate
  }
  return false;
}

function padDetectChord(midiNotes, spellingKey) {
  if (midiNotes.length < 2) return [];
  var pcs = [];
  var seen = {};
  for (var i = 0; i < midiNotes.length; i++) {
    var pc = midiNotes[i] % 12;
    if (!seen[pc]) { seen[pc] = true; pcs.push(pc); }
  }
  pcs.sort(function(a, b) { return a - b; });
  if (pcs.length < 2) return [];
  var lowestPC = midiNotes[0];
  for (var i = 1; i < midiNotes.length; i++) {
    if (midiNotes[i] < lowestPC) lowestPC = midiNotes[i];
  }
  lowestPC = lowestPC % 12;
  if (padIsUnnameableMajorSplitThirdColor(pcs, lowestPC)) return [];
  var candidates = [];
  var lowestHasShell = padHasBassShell(pcs, lowestPC);
  function padPushOrBumpCandidate(name, rootPC, score, details) {
    details = details || padSimpleDetectDetails('unknown', []);
    for (var ci = 0; ci < candidates.length; ci++) {
      if (candidates[ci].name === name) {
        var previousScore = candidates[ci].score || 0;
        var previousTensions = Array.isArray(candidates[ci].tensionLabels) ? candidates[ci].tensionLabels.length : 0;
        var incomingTensions = details && Array.isArray(details.tensionLabels) ? details.tensionLabels.length : 0;
        // A display-derived pc8 role can create the same canonical name before
        // the richer registered b13 entry is visited. Keep the highest-scoring
        // structural realization, and on a tie prefer metadata that actually
        // carries the named tensions. This makes PushOrBump live up to its name.
        if (score > previousScore || (score === previousScore && incomingTensions > previousTensions)) {
          candidates[ci].score = score;
          if (details) Object.assign(candidates[ci], details);
        }
        return;
      }
    }
    candidates.push(Object.assign({ name: name, rootPC: rootPC, score: score }, details));
  }

  function padSimpleDetectDetails(quality, chordPCS) {
    var pcs = (chordPCS || []).slice().sort(function(a, b) { return a - b; });
    return {
      quality: quality,
      tensionLabels: [], chordPCS: pcs, chordIntervals: pcs.slice(),
      tensionPCS: [], tensionIntervals: [],
      register: { explicit: false, intervals: [] }, explicitIntent: false,
    };
  }

  function padDetectDetails(chord) {
    return {
      quality: chord.quality,
      tensionLabels: chord.tensionLabels.slice(),
      chordPCS: chord.chordPCS.slice(),
      chordIntervals: chord.chordIntervals.slice(),
      tensionPCS: chord.tensionPCS.slice(),
      tensionIntervals: chord.tensionIntervals.slice(),
      register: { explicit: false, intervals: [] },
      explicitIntent: false,
    };
  }

  for (var ri = 0; ri < pcs.length; ri++) {
    var rootPC = pcs[ri];
    var intervals = {};
    for (var j = 0; j < pcs.length; j++) {
      intervals[((pcs[j] - rootPC) + 12) % 12] = true;
    }
    for (var ci = 0; ci < CHORD_DETECT_DB.length; ci++) {
      var chord = CHORD_DETECT_DB[ci];
      // Exact match (allow 1 extra note)
      if (chord.pcs.length <= pcs.length + 1) {
        var matched = 0;
        for (var k = 0; k < chord.pcs.length; k++) {
          if (intervals[chord.pcs[k]]) matched++;
        }
        if (matched === chord.pcs.length) {
          if (padRejectDominantSlashOverBassShell(chord.name, rootPC, lowestPC, lowestHasShell)) continue;
          var extra = pcs.length - chord.pcs.length;
          var isRootPosition = rootPC === lowestPC;
          var score = (isRootPosition ? 100 : 0) + chord.pcs.length * 10 - extra
            + padShellScoreBonus(intervals) - padAugAlteredPenalty(chord.name, intervals)
            - padPc8SemanticPenalty(chord.name, chord.pcs, intervals);
          var rootName = padPreferredRootNoteName(rootPC, spellingKey);
          var bass = lowestPC !== rootPC ? ' / ' + padChordIntervalNoteName(rootPC, lowestPC) : '';
          var displayQuality = padAppendDetectedPc8Role(chord.name, chord.pcs, intervals);
          var name = rootName + displayQuality + bass;
          padPushOrBumpCandidate(name, rootPC, score, padDetectDetails(chord));
        }
      }
      // Omit5 match: 4+ note chords containing 5th (7) — also check without 5th
      if (chord.pcs.length >= 4 && chord.pcs.indexOf(7) !== -1) {
        if (/^m?add/.test(chord.name || '')) continue;
        if (chord.name === 'm6(11)') continue;
        var omit5pcs = [];
        for (var k = 0; k < chord.pcs.length; k++) {
          if (chord.pcs[k] !== 7) omit5pcs.push(chord.pcs[k]);
        }
        if (omit5pcs.length <= pcs.length + 1) {
          var matched = 0;
          for (var k = 0; k < omit5pcs.length; k++) {
            if (intervals[omit5pcs[k]]) matched++;
          }
          if (matched === omit5pcs.length) {
              if (padRejectDominantSlashOverBassShell(chord.name, rootPC, lowestPC, lowestHasShell)) continue;
            var extra = pcs.length - omit5pcs.length;
            var isRootPosition = rootPC === lowestPC;
            var rootBonus = (isRootPosition && extra === 0) ? 100 : 0;
            var extraPenalty = extra > 0 ? extra * 35 : 0;
            var score = rootBonus + chord.pcs.length * 10 - extra - 5 - extraPenalty
              + padShellScoreBonus(intervals) - padAugAlteredPenalty(chord.name, intervals)
            - padPc8SemanticPenalty(chord.name, chord.pcs, intervals);
            var rootName = padPreferredRootNoteName(rootPC, spellingKey);
            var bass = lowestPC !== rootPC ? ' / ' + padChordIntervalNoteName(rootPC, lowestPC) : '';
            var hasShell = (intervals[3] || intervals[4]) && (intervals[10] || intervals[11]);
            var omitLabel = (chord.pcs.length >= 5 || hasShell) ? '' : '(omit5)';
            var displayQuality = padAppendDetectedPc8Role(chord.name, chord.pcs, intervals);
            var name = rootName + displayQuality + omitLabel + bass;
            padPushOrBumpCandidate(name, rootPC, score, padDetectDetails(chord));
          }
        }
      }
    }
  }

  // Bass + Triad detection
  if (pcs.length >= 3) {
    var upperPCs = [];
    for (var i = 0; i < pcs.length; i++) {
      if (pcs[i] !== lowestPC) upperPCs.push(pcs[i]);
    }
    if (upperPCs.length >= 3) {
      for (var ti = 0; ti < upperPCs.length; ti++) {
        var triadRoot = upperPCs[ti];
        var triadIntervals = {};
        for (var j = 0; j < upperPCs.length; j++) {
          triadIntervals[((upperPCs[j] - triadRoot) + 12) % 12] = true;
        }
        for (var di = 0; di < TRIAD_DETECT_DB.length; di++) {
          var triad = TRIAD_DETECT_DB[di];
          var matched = 0;
          for (var k = 0; k < triad.pcs.length; k++) {
            if (triadIntervals[triad.pcs[k]]) matched++;
          }
          if (matched === triad.pcs.length) {
            if (!padIsAllowedSlashChordCandidate(triad.name, triad.pcs, triadRoot, lowestPC)) continue;
            var triadName = padPreferredRootNoteName(triadRoot, spellingKey) + (triad.name === 'Maj' ? '' : triad.name);
            var bassName = padChordIntervalNoteName(triadRoot, lowestPC);
            var name = triadName + ' / ' + bassName;
            var isTriadRoot = triadRoot === lowestPC;
            var isSlashInversion = triad.pcs.indexOf(((lowestPC - triadRoot) + 12) % 12) !== -1;
            var isB7OverBassHybrid = ((triadRoot - lowestPC + 12) % 12) === 10;
            if (!(lowestHasShell && isB7OverBassHybrid)) {
              var score = isTriadRoot ? 125 : (!isSlashInversion ? 144 : 25);
              padPushOrBumpCandidate(name, triadRoot, score, padSimpleDetectDetails(triad.name, triad.pcs));
            }
          }
        }
      }
    }
  }

  // Some b7-over-bass upper-structure triads (especially minor triads like Fm/G)
  // can be swallowed by richer exact matches. Keep the hybrid spelling visible
  // because players commonly think and write these as slash chords.
  if (pcs.length >= 4 && !lowestHasShell) {
    var hybridRoot = (lowestPC + 10) % 12;
    var hybridUpperSet = {};
    for (var hi = 0; hi < pcs.length; hi++) {
      if (pcs[hi] !== lowestPC) hybridUpperSet[pcs[hi]] = true;
    }
    [
      { suffix: '', third: 4 },
      { suffix: 'm', third: 3 }
    ].forEach(function(hybridQuality) {
      var rootPC2 = hybridRoot;
      var thirdPC = (hybridRoot + hybridQuality.third) % 12;
      var fifthPC = (hybridRoot + 7) % 12;
      if (hybridUpperSet[rootPC2] && hybridUpperSet[thirdPC] && hybridUpperSet[fifthPC]) {
        var hybridName = padPreferredRootNoteName(hybridRoot, spellingKey) + hybridQuality.suffix + ' / ' + padChordIntervalNoteName(hybridRoot, lowestPC);
        var hybridAlreadyListed = candidates.some(function(c) { return c.name === hybridName; });
        if (!hybridAlreadyListed) {
          padPushOrBumpCandidate(hybridName, hybridRoot, 144,
            padSimpleDetectDetails(hybridQuality.suffix || 'Maj', [0, hybridQuality.third, 7]));
        }
      }
    });
  }
  var bassIntervalsForHybrid = {};
  for (var bhi = 0; bhi < pcs.length; bhi++) {
    bassIntervalsForHybrid[((pcs[bhi] - lowestPC) + 12) % 12] = true;
  }
  function ensureB7HybridFromBass(suffix, thirdFromBass) {
    if (lowestHasShell) return;
    if (!bassIntervalsForHybrid[10] || !bassIntervalsForHybrid[5] || !bassIntervalsForHybrid[thirdFromBass]) return;
    var rootPC3 = (lowestPC + 10) % 12;
    var name3 = padPreferredRootNoteName(rootPC3, spellingKey) + suffix + ' / ' + padChordIntervalNoteName(rootPC3, lowestPC);
    if (!candidates.some(function(c) { return c.name === name3; })) {
      padPushOrBumpCandidate(name3, rootPC3, 144,
        padSimpleDetectDetails(suffix || 'Maj', [0, thirdFromBass === 2 ? 4 : 3, 7]));
    }
  }
  ensureB7HybridFromBass('', 2);
  ensureB7HybridFromBass('m', 1);

  // Bass + Tetrad detection
  if (pcs.length >= 4) {
    var upperPCs = [];
    for (var i = 0; i < pcs.length; i++) {
      if (pcs[i] !== lowestPC) upperPCs.push(pcs[i]);
    }
    if (upperPCs.length >= 4) {
      for (var ti = 0; ti < upperPCs.length; ti++) {
        var tetRoot = upperPCs[ti];
        var tetIntervals = {};
        for (var j = 0; j < upperPCs.length; j++) {
          tetIntervals[((upperPCs[j] - tetRoot) + 12) % 12] = true;
        }
        for (var di = 0; di < TETRAD_DETECT_DB.length; di++) {
          var tet = TETRAD_DETECT_DB[di];
          var matched = 0;
          for (var k = 0; k < tet.pcs.length; k++) {
            if (tetIntervals[tet.pcs[k]]) matched++;
          }
          if (matched === tet.pcs.length) {
            if (!padIsAllowedSlashChordCandidate(tet.name, tet.pcs, tetRoot, lowestPC)) continue;
            var tetName = padPreferredRootNoteName(tetRoot, spellingKey) + tet.name;
            var bassName = padChordIntervalNoteName(tetRoot, lowestPC);
            if (tetRoot === lowestPC) continue;
            if (lowestHasShell && tet.name === '7') continue;
            var name = tetName + ' / ' + bassName;
            var isSlashInversion = tet.pcs.indexOf(((lowestPC - tetRoot) + 12) % 12) !== -1;
            var score = isSlashInversion ? 30 + tet.pcs.length * 5 : 144;
            padPushOrBumpCandidate(name, tetRoot, score, padSimpleDetectDetails(tet.name, tet.pcs));
          }
        }
      }
    }
  }

  // Chord-detect DB candidates already carry canonical semantic metadata.
  // Do not rewrite only display names here: that would desynchronize name,
  // quality, and exact tension intervals while also creating duplicates.

  candidates.sort(function(a, b) { return b.score - a.score; });
  function pinB7HybridNearTop(suffix, thirdFromBass) {
    if (lowestHasShell) return;
    var bassIntervals = {};
    for (var pi = 0; pi < pcs.length; pi++) bassIntervals[((pcs[pi] - lowestPC) + 12) % 12] = true;
    if (!bassIntervals[10] || !bassIntervals[5] || !bassIntervals[thirdFromBass]) return;
    var root = (lowestPC + 10) % 12;
    var pinnedName = padPreferredRootNoteName(root, spellingKey) + suffix + ' / ' + padChordIntervalNoteName(root, lowestPC);
    var existingIdx = candidates.findIndex(function(c) { return c.name === pinnedName; });
    var pinned = existingIdx >= 0 ? candidates.splice(existingIdx, 1)[0] : { name: pinnedName, rootPC: root, score: 144 };
    pinned.score = Math.max(pinned.score || 0, 144);
    candidates.splice(Math.min(1, candidates.length), 0, pinned);
  }
  pinB7HybridNearTop('', 2);
  pinB7HybridNearTop('m', 1);

  // Every candidate keeps the exact observed pitch set even when its local
  // harmonic spelling/ranking differs. Consumers must not reconstruct this.
  for (var oi = 0; oi < candidates.length; oi++) {
    candidates[oi].observedPCS = pcs.slice();
    candidates[oi].observedPitchClasses = pcs.slice();
    candidates[oi].observedBassPC = lowestPC;
  }

  return candidates.slice(0, 8);
}

// ======== STOCK VOICING MATCHING ========
// Parse stock-voicings.json into flat array of entries with semitone arrays.
// Input: raw JSON object (parsed stock-voicings.json).
// Output: array of { id, name, label, category, subtype, lhSemitones, rhSemitones, allSemitones, pcCount }

function padParseStockVoicings(jsonData) {
  var entries = [];
  var categories = Object.keys(jsonData);
  for (var ci = 0; ci < categories.length; ci++) {
    var cat = categories[ci];
    if (cat === '_meta') continue;
    var subtypes = Object.keys(jsonData[cat]);
    for (var si = 0; si < subtypes.length; si++) {
      var sub = subtypes[si];
      var voicings = jsonData[cat][sub];
      for (var vi = 0; vi < voicings.length; vi++) {
        var v = voicings[vi];
        if ((!v.LH || v.LH.length === 0) && (!v.RH || v.RH.length === 0)) continue;
        var lh = [], rh = [];
        for (var i = 0; i < (v.LH || []).length; i++) {
          var s = DEGREE_TO_SEMITONE[v.LH[i]];
          if (s !== undefined) lh.push(s);
        }
        for (var i = 0; i < (v.RH || []).length; i++) {
          var s = DEGREE_TO_SEMITONE[v.RH[i]];
          if (s !== undefined) rh.push(s);
        }
        var seen = {};
        var all = [];
        for (var i = 0; i < lh.length; i++) {
          if (!seen[lh[i]]) { seen[lh[i]] = true; all.push(lh[i]); }
        }
        for (var i = 0; i < rh.length; i++) {
          if (!seen[rh[i]]) { seen[rh[i]] = true; all.push(rh[i]); }
        }
        entries.push({
          id: v.id, name: v.name, label: v.label,
          category: cat, subtype: sub,
          lhSemitones: lh, rhSemitones: rh,
          allSemitones: all, pcCount: all.length,
        });
      }
    }
  }
  return entries;
}

// Match MIDI notes against stock voicing patterns.
// rootPC: 0-11 (pitch class of root). midiNotes: array of MIDI values.
// stockEntries: output of padParseStockVoicings().
// Returns array of { id, name, label, category, subtype, score, matched, total } sorted by score.

function padMatchStockVoicing(rootPC, midiNotes, stockEntries) {
  if (!midiNotes || midiNotes.length < 2 || !stockEntries) return [];

  // Convert MIDI notes to interval set (semitones from root, mod 12)
  var intervalSet = {};
  var intervalCount = 0;
  for (var i = 0; i < midiNotes.length; i++) {
    var iv = ((midiNotes[i] % 12) - rootPC + 12) % 12;
    if (!intervalSet[iv]) { intervalSet[iv] = true; intervalCount++; }
  }

  var results = [];
  for (var i = 0; i < stockEntries.length; i++) {
    var entry = stockEntries[i];
    var all = entry.allSemitones;
    if (all.length === 0) continue;

    // Count how many of the stock voicing's degrees are in our input
    var matched = 0;
    for (var j = 0; j < all.length; j++) {
      if (intervalSet[all[j]]) matched++;
    }
    if (matched === 0) continue;

    // Jaccard similarity: intersection / union
    var union = intervalCount + all.length - matched;
    var score = matched / union;

    // Exact match bonus
    if (matched === all.length && all.length === intervalCount) score = 1.0;

    if (score < 0.5) continue;

    results.push({
      id: entry.id, name: entry.name, label: entry.label,
      category: entry.category, subtype: entry.subtype,
      score: Math.round(score * 100) / 100,
      matched: matched, total: all.length,
    });
  }

  results.sort(function(a, b) {
    return b.score - a.score || b.matched - a.matched;
  });
  return results.slice(0, 8);
}

// ======== PITCH CLASS CLASSIFICATION ========

/**
 * Classify a pitch class by its role in the current chord context.
 * Returns: 'root' | 'bass' | 'guide3' | 'guide7' | 'tension' | 'inactive'
 * Pure function — no global state reads.
 */
function padClassifyPC(pc, rootPC, bassPC, activePCS, guide3Set, guide7Set) {
  if (!activePCS || !activePCS.has(pc)) return 'inactive';
  if (pc === rootPC) return 'root';
  if (bassPC !== null && bassPC !== undefined && pc === bassPC && pc !== rootPC) return 'bass';
  if (guide3Set && guide3Set.has(pc)) return 'guide3';
  if (guide7Set && guide7Set.has(pc)) return 'guide7';
  return 'tension';
}

/**
 * Get the color for a pitch class classification from a theme object.
 */
function padClassifyColor(classification, theme) {
  return (theme || PAD_THEME_OKABE_ITO)[classification] || (theme || PAD_THEME_OKABE_ITO).inactive;
}

// Conditional exports for Node.js (Vitest) — ignored in browser
if (typeof module !== 'undefined') module.exports = {
  padParseRoot, padParseChordName,
  padPitchClass, padGetParentMajorKey, padPcName, padNoteNameForKey,
  padFifthsDistance, padApplyTension, padBuildChordPayload,
  padCalcVoicingOffsets, padGetBassCase, padApplyOnChordBass,
  padGetShellIntervals, padCalcAllVoicingPositions, padFindCompactPositions,
  padNearestLayout, padSerialToRowCol, padRowColToSerial, padPitchAtSerial,
  padChooseNearestPositions, padResolveNearestSequence,
  padEnumPerformancePositions, padResolvePerformanceSequence,
  padChordContextKey, padGetBuilderChordName,
  padGetDiatonicTetrads, padFindParentScales,
  padEnumGuitarChordForms, padAnalyzeGuitarFormQuality,
  padEncodeGuitarFretKey, padDecodeGuitarFretKey,
  padGetGuitarTuningName, padGetGuitarChordKey,
  padGetGuitarFormKnowledge, padGetGuitarPositionFamily,
  padEstimateGuitarFingerUnits, padAssignFingers, padDetectChord,
  padParseStockVoicings, padMatchStockVoicing,
  padClassifyPC, padClassifyColor,
  DIATONIC_CHORD_DB,
};
