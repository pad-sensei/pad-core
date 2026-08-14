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
          '13': 21, 'b13': 20, '7': 23,
          '#5': 8, 'b5': 6,
        };
        var baseIntervals = PAD_QUALITY_INTERVALS[baseQ].slice();
        var tensions = tensionStr.split(',').map(function(s) { return s.trim(); });
        var valid = true;
        for (var t = 0; t < tensions.length; t++) {
          var iv = TENSION_MAP[tensions[t]];
          if (iv === undefined) { valid = false; break; }
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

function padAugAlteredPenalty(chordName, intervals) {
  if ((chordName || '').indexOf('aug') < 0) return 0;
  var hasDominantSeventh = intervals[10];
  var hasAlteredDominantColor = intervals[1] || intervals[3] || intervals[6] || intervals[8];
  return hasDominantSeventh && hasAlteredDominantColor ? 140 : 0;
}


// Detection is descriptive: every returned candidate carries the exact pitch
// classes that were played. Candidate-local labels may interpret an otherwise
// unrepresented color (for example b3 over a major-3rd identity as #9), but
// never delete the competing observed reading.
function padDetectionObservedLabel(interval, candidatePCS) {
  var set = {};
  for (var i = 0; i < (candidatePCS || []).length; i++) {
    set[((candidatePCS[i] % 12) + 12) % 12] = true;
  }
  switch (((interval % 12) + 12) % 12) {
    case 1: return 'b9';
    case 2: return '9';
    case 3: return set[4] ? '#9' : 'b3';
    case 4: return '3';
    case 5: return '11';
    case 6: return set[7] ? '#11' : 'b5';
    case 7: return '5';
    case 8: return set[7] ? 'b13' : '#5';
    case 9: return '13';
    case 10: return 'b7';
    case 11: return 'Maj7';
    default: return null;
  }
}

function padDetectionCompoundInterval(label) {
  var map = {
    'b9': 13, '9': 14, '#9': 15,
    '11': 17, '#11': 18,
    'b13': 20, '13': 21,
  };
  return map[label];
}

function padAppendDetectionObservedLabels(name, labels) {
  if (!labels || labels.length === 0) return name;
  var slash = '';
  var slashIdx = name.indexOf(' / ');
  if (slashIdx >= 0) {
    slash = name.slice(slashIdx);
    name = name.slice(0, slashIdx);
  }
  var omit5 = '';
  if (name.slice(-7) === '(omit5)') {
    omit5 = '(omit5)';
    name = name.slice(0, -7);
  }

  var values = [];
  var trailing = name.match(/^(.*)\(([^()]*)\)$/);
  if (trailing) {
    name = trailing[1];
    values = trailing[2].split(',').map(function(value) { return value.trim(); }).filter(Boolean);
  }
  for (var i = 0; i < labels.length; i++) {
    if (values.indexOf(labels[i]) < 0) values.push(labels[i]);
  }
  if (values.length > 0) name += '(' + values.join(',') + ')';
  return name + omit5 + slash;
}

function padDetectionCoverageBonus(candidate, observedPCS, lowestPC) {
  var observed = {};
  for (var i = 0; i < observedPCS.length; i++) observed[observedPCS[i]] = true;
  var chordPCS = candidate.chordPCS || [];
  var matched = 0;
  var missing = 0;
  for (var ci = 0; ci < chordPCS.length; ci++) {
    var absolutePC = (candidate.rootPC + chordPCS[ci]) % 12;
    if (observed[absolutePC]) matched++;
    else missing++;
  }
  var bonus = matched * 16 - missing * 12;
  if (matched >= 4) bonus += 28;
  if (candidate.rootPC === lowestPC) bonus += 10;
  return bonus;
}

function padFinalizeObservedCandidate(candidate, observedPCS, lowestPC) {
  var exactObserved = observedPCS.slice().sort(function(a, b) { return a - b; });
  candidate.observedPCS = exactObserved;
  candidate.observedPitchClasses = exactObserved.slice();
  candidate.observedBassPC = lowestPC;

  var observedIntervals = exactObserved.map(function(pc) {
    return ((pc - candidate.rootPC) + 12) % 12;
  }).sort(function(a, b) { return a - b; });
  candidate.observedIntervals = observedIntervals;

  var represented = {};
  var candidatePCS = candidate.chordPCS || [];
  for (var i = 0; i < candidatePCS.length; i++) {
    represented[((candidatePCS[i] % 12) + 12) % 12] = true;
  }
  if (candidate.name.indexOf(' / ') >= 0 && candidate.rootPC !== lowestPC) {
    represented[((lowestPC - candidate.rootPC) + 12) % 12] = true;
  }

  var extraIntervals = [];
  var extraLabels = [];
  for (var oi = 0; oi < observedIntervals.length; oi++) {
    var interval = observedIntervals[oi];
    if (represented[interval]) continue;
    extraIntervals.push(interval);
    var label = padDetectionObservedLabel(interval, candidatePCS);
    if (label && extraLabels.indexOf(label) < 0) extraLabels.push(label);
  }
  candidate.observedExtraIntervals = extraIntervals;
  candidate.observedExtraLabels = extraLabels.slice();
  candidate.name = padAppendDetectionObservedLabels(candidate.name, extraLabels);

  if (!candidate.tensionLabels) candidate.tensionLabels = [];
  if (!candidate.tensionPCS) candidate.tensionPCS = [];
  if (!candidate.tensionIntervals) candidate.tensionIntervals = [];
  for (var li = 0; li < extraLabels.length; li++) {
    var compound = padDetectionCompoundInterval(extraLabels[li]);
    if (compound === undefined) continue;
    if (candidate.tensionLabels.indexOf(extraLabels[li]) < 0) candidate.tensionLabels.push(extraLabels[li]);
    var tensionPC = compound % 12;
    if (candidate.tensionPCS.indexOf(tensionPC) < 0) candidate.tensionPCS.push(tensionPC);
    if (candidate.tensionIntervals.indexOf(compound) < 0) candidate.tensionIntervals.push(compound);
  }
  candidate.tensionPCS.sort(function(a, b) { return a - b; });
  candidate.tensionIntervals.sort(function(a, b) { return a - b; });
  return candidate;
}

function padIsPreferredSlashChordCandidate(qualityName, qualityPcs, upperRootPC, bassPC) {
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
  var candidates = [];
  var seenNames = {};
  var lowestHasShell = padHasBassShell(pcs, lowestPC);
  function padPushOrBumpCandidate(name, rootPC, score, details) {
    details = details || padSimpleDetectDetails('unknown', []);
    for (var ci = 0; ci < candidates.length; ci++) {
      if (candidates[ci].name === name) {
        candidates[ci].score = Math.max(candidates[ci].score || 0, score);
        if (details) Object.assign(candidates[ci], details);
        return;
      }
    }
    seenNames[name] = true;
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
          var extra = pcs.length - chord.pcs.length;
          var isRootPosition = rootPC === lowestPC;
          var score = (isRootPosition ? 100 : 0) + chord.pcs.length * 10 - extra
            + padShellScoreBonus(intervals) - padAugAlteredPenalty(chord.name, intervals);
          var rootName = padPreferredRootNoteName(rootPC, spellingKey);
          var bass = lowestPC !== rootPC ? ' / ' + padChordIntervalNoteName(rootPC, lowestPC) : '';
          var name = rootName + chord.name + bass;
          if (!seenNames[name]) padPushOrBumpCandidate(name, rootPC, score, padDetectDetails(chord));
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
                var extra = pcs.length - omit5pcs.length;
            var isRootPosition = rootPC === lowestPC;
            var rootBonus = (isRootPosition && extra === 0) ? 100 : 0;
            var extraPenalty = extra > 0 ? extra * 35 : 0;
            var score = rootBonus + chord.pcs.length * 10 - extra - 5 - extraPenalty
              + padShellScoreBonus(intervals) - padAugAlteredPenalty(chord.name, intervals);
            var rootName = padPreferredRootNoteName(rootPC, spellingKey);
            var bass = lowestPC !== rootPC ? ' / ' + padChordIntervalNoteName(rootPC, lowestPC) : '';
            var omitLabel = '(omit5)';
            var name = rootName + chord.name + omitLabel + bass;
            if (!seenNames[name]) padPushOrBumpCandidate(name, rootPC, score, padDetectDetails(chord));
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
            var slashPreferencePenalty = padIsPreferredSlashChordCandidate(triad.name, triad.pcs, triadRoot, lowestPC) ? 0 : 80;
            var triadName = padPreferredRootNoteName(triadRoot, spellingKey) + (triad.name === 'Maj' ? '' : triad.name);
            var bassName = padChordIntervalNoteName(triadRoot, lowestPC);
            var name = triadName + ' / ' + bassName;
            var isTriadRoot = triadRoot === lowestPC;
            var isSlashInversion = triad.pcs.indexOf(((lowestPC - triadRoot) + 12) % 12) !== -1;
            var score = (isTriadRoot ? 125 : (!isSlashInversion ? 144 : 25)) - slashPreferencePenalty;
            padPushOrBumpCandidate(name, triadRoot, score, padSimpleDetectDetails(triad.name, triad.pcs));
          }
        }
      }
    }
  }

  // Some b7-over-bass upper-structure triads (especially minor triads like Fm/G)
  // can be swallowed by richer exact matches. Keep the hybrid spelling visible
  // because players commonly think and write these as slash chords.
  if (pcs.length >= 4) {
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
          seenNames[hybridName] = true;
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
    if (!bassIntervalsForHybrid[10] || !bassIntervalsForHybrid[5] || !bassIntervalsForHybrid[thirdFromBass]) return;
    var rootPC3 = (lowestPC + 10) % 12;
    var name3 = padPreferredRootNoteName(rootPC3, spellingKey) + suffix + ' / ' + padChordIntervalNoteName(rootPC3, lowestPC);
    if (!candidates.some(function(c) { return c.name === name3; })) {
      seenNames[name3] = true;
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
            var slashPreferencePenalty = padIsPreferredSlashChordCandidate(tet.name, tet.pcs, tetRoot, lowestPC) ? 0 : 80;
            var tetName = padPreferredRootNoteName(tetRoot, spellingKey) + tet.name;
            var bassName = padChordIntervalNoteName(tetRoot, lowestPC);
            if (tetRoot === lowestPC) continue;
            var name = tetName + ' / ' + bassName;
            var isSlashInversion = tet.pcs.indexOf(((lowestPC - tetRoot) + 12) % 12) !== -1;
            var score = (isSlashInversion ? 30 + tet.pcs.length * 5 : 144) - slashPreferencePenalty;
            padPushOrBumpCandidate(name, tetRoot, score, padSimpleDetectDetails(tet.name, tet.pcs));
          }
        }
      }
    }
  }

  // Chord-detect DB candidates already carry canonical semantic metadata.
  // Do not rewrite only display names here: that would desynchronize name,
  // quality, and exact tension intervals while also creating duplicates.

  for (var ri = 0; ri < candidates.length; ri++) {
    candidates[ri].score += padDetectionCoverageBonus(candidates[ri], pcs, lowestPC);
  }
  candidates.sort(function(a, b) { return b.score - a.score; });
  function pinB7HybridNearTop(suffix, thirdFromBass) {
    var bassIntervals = {};
    for (var pi = 0; pi < pcs.length; pi++) bassIntervals[((pcs[pi] - lowestPC) + 12) % 12] = true;
    if (!bassIntervals[10] || !bassIntervals[5] || !bassIntervals[thirdFromBass]) return;
    var root = (lowestPC + 10) % 12;
    var pinnedName = padPreferredRootNoteName(root, spellingKey) + suffix + ' / ' + padChordIntervalNoteName(root, lowestPC);
    var existingIdx = candidates.findIndex(function(c) { return c.name === pinnedName; });
    var pinned = existingIdx >= 0 ? candidates.splice(existingIdx, 1)[0] : Object.assign(
      { name: pinnedName, rootPC: root, score: 144 },
      padSimpleDetectDetails(suffix || 'Maj', [0, thirdFromBass === 2 ? 4 : 3, 7])
    );
    pinned.score = Math.max(pinned.score || 0, 144);
    candidates.splice(Math.min(1, candidates.length), 0, pinned);
  }
  pinB7HybridNearTop('', 2);
  pinB7HybridNearTop('m', 1);
  var finalized = [];
  var seenFinal = {};
  for (var oi = 0; oi < candidates.length; oi++) {
    var candidate = padFinalizeObservedCandidate(candidates[oi], pcs, lowestPC);
    var finalKey = candidate.rootPC + '|' + candidate.name;
    if (seenFinal[finalKey]) continue;
    seenFinal[finalKey] = true;
    finalized.push(candidate);
  }
  return finalized.slice(0, 8);
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
