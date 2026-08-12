// ========================================
// PAD-CORE — Observed physical Shell / UST analysis
// v1.7: actual source notes are authoritative; never synthesize notes.
// ========================================

var PAD_OBSERVED_SHELL_RULES = {
  '7':        { required: [4, 10] },
  'Maj7':     { required: [4, 11] },
  'maj7':     { required: [4, 11] },
  '\u25B37': { required: [4, 11] },
  'm7':       { required: [3, 10] },
  'm7(b5)':   { required: [3, 6, 10] },
  'm7b5':     { required: [3, 6, 10] },
  'm7-5':     { required: [3, 6, 10] },
};

function padObservedMod12(value) {
  return ((value % 12) + 12) % 12;
}

function padObservedDegreeName(interval, quality) {
  var iv = padObservedMod12(interval);
  var isMinor = quality === 'm7' || quality === 'm7(b5)' || quality === 'm7b5' || quality === 'm7-5';
  var names = {
    0: 'R', 1: 'b9', 2: '9', 3: isMinor ? 'm3' : '#9', 4: '3', 5: '11',
    6: quality === 'm7(b5)' || quality === 'm7b5' || quality === 'm7-5' ? 'b5' : '#11',
    7: '5', 8: 'b13', 9: '13', 10: 'b7', 11: '7'
  };
  return names[iv];
}

function padObservedQuartalName(interval) {
  var names = ['Q1','Qb2','Q2','Qb3','Q3','Q4','Qb5','Q5','Qb6','Q6','Qb7','Q7'];
  return names[padObservedMod12(interval)];
}

function padNormalizeObservedNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes.map(function(note, index) {
    var source = typeof note === 'number' ? { midi: note } : (note || {});
    var midi = Number(source.midi);
    if (!Number.isFinite(midi)) return null;
    return {
      midi: midi,
      pc: padObservedMod12(midi),
      row: Number.isInteger(source.row) ? source.row : null,
      col: Number.isInteger(source.col) ? source.col : null,
      physicalPadId: source.physicalPadId != null ? String(source.physicalPadId) : null,
      sourceId: source.sourceId != null ? String(source.sourceId) : null,
      deviceId: source.deviceId != null ? String(source.deviceId) : null,
      rawNote: Number.isFinite(Number(source.rawNote)) ? Number(source.rawNote) : null,
      mappedMidi: Number.isFinite(Number(source.mappedMidi)) ? Number(source.mappedMidi) : midi,
      positionConfidence: source.positionConfidence === 'exact' || source.positionConfidence === 'reconstructed'
        ? source.positionConfidence : 'none',
      _sourceIndex: index,
    };
  }).filter(Boolean);
}

function padObservedOutputNote(note, rootPC, quality) {
  return {
    midi: note.midi,
    pc: note.pc,
    degree: padObservedDegreeName(note.pc - rootPC, quality),
    row: note.row,
    col: note.col,
    physicalPadId: note.physicalPadId,
    sourceId: note.sourceId,
    deviceId: note.deviceId,
    rawNote: note.rawNote,
    mappedMidi: note.mappedMidi,
    positionConfidence: note.positionConfidence,
  };
}

function padObservedPositionLevel(notes) {
  if (!notes.length) return 'none';
  if (notes.every(function(n) { return n.positionConfidence === 'exact' && n.row !== null && n.col !== null; })) return 'exact';
  if (notes.every(function(n) { return n.positionConfidence !== 'none' && n.row !== null && n.col !== null; })) return 'reconstructed';
  return 'none';
}

function padObservedSelectShell(notes, rootPC, quality) {
  var rule = PAD_OBSERVED_SHELL_RULES[quality];
  if (!rule) return null;
  var byInterval = {};
  notes.forEach(function(note) {
    var iv = padObservedMod12(note.pc - rootPC);
    if (!byInterval[iv]) byInterval[iv] = [];
    byInterval[iv].push(note);
  });
  rule.required.forEach(function(iv) {
    if (byInterval[iv]) byInterval[iv].sort(function(a, b) { return a.midi - b.midi || a._sourceIndex - b._sourceIndex; });
  });
  if (!rule.required.every(function(iv) { return byInterval[iv] && byInterval[iv].length; })) return null;

  // Own the lowest actually-held occurrence of each characteristic shell degree.
  // This leaves duplicated upper degrees available to the UST layer rather than
  // collapsing source identity into a pitch-class Set.
  var owned = rule.required.map(function(iv) { return byInterval[iv][0]; });
  var maxRequiredMidi = Math.max.apply(null, owned.map(function(n) { return n.midi; }));
  var roots = (byInterval[0] || []).slice().sort(function(a, b) { return a.midi - b.midi || a._sourceIndex - b._sourceIndex; });
  if (roots.length && roots[0].midi <= maxRequiredMidi) owned.push(roots[0]);
  owned.sort(function(a, b) { return a.midi - b.midi || a._sourceIndex - b._sourceIndex; });

  return {
    owned: owned,
    sourceIndexes: new Set(owned.map(function(n) { return n._sourceIndex; })),
  };
}

function padObservedGridPairIsConsistent(a, b) {
  if (a.row === null || a.col === null || b.row === null || b.col === null) return false;
  // Fourths-grid invariant: mapped MIDI delta must agree with 5-semitone rows + columns.
  return (b.mappedMidi - a.mappedMidi) === ((b.row - a.row) * 5 + (b.col - a.col));
}

function padObservedQuartalGeometryIsCompact(stack, positionLevel) {
  if (positionLevel === 'none') return true;
  for (var i = 1; i < stack.length; i++) {
    if (!padObservedGridPairIsConsistent(stack[i - 1], stack[i])) return false;
  }
  var rows = stack.map(function(n) { return n.row; });
  var cols = stack.map(function(n) { return n.col; });
  var rowSpan = Math.max.apply(null, rows) - Math.min.apply(null, rows);
  var colSpan = Math.max.apply(null, cols) - Math.min.apply(null, cols);
  return rowSpan <= 2 && colSpan <= 2;
}

function padObservedFindQuartalStack(notes, positionLevel) {
  var ordered = notes.slice().sort(function(a, b) { return a.midi - b.midi || a._sourceIndex - b._sourceIndex; });
  var candidates = [];
  for (var i = 0; i < ordered.length; i++) {
    for (var j = i + 1; j < ordered.length; j++) {
      if (ordered[j].midi - ordered[i].midi !== 5) continue;
      for (var k = j + 1; k < ordered.length; k++) {
        if (ordered[k].midi - ordered[j].midi !== 5) continue;
        var stack = [ordered[i], ordered[j], ordered[k]];
        if (!padObservedQuartalGeometryIsCompact(stack, positionLevel)) continue;
        candidates.push(stack);
      }
    }
  }
  if (!candidates.length) return null;
  // After shell partition, prefer the actual uppermost compact stack. Never pull an
  // owned shell source back in merely because it would make another dictionary label.
  candidates.sort(function(a, b) {
    var aMin = a[0].midi, bMin = b[0].midi;
    if (aMin !== bMin) return bMin - aMin;
    return a[0]._sourceIndex - b[0]._sourceIndex;
  });
  return candidates[0];
}

function padAnalyzeObservedShellUst(input) {
  input = input || {};
  var chord = input.chord || {};
  var rootPC = Number.isFinite(Number(chord.rootPC)) ? padObservedMod12(Number(chord.rootPC)) : null;
  var quality = chord.quality || null;
  var notes = padNormalizeObservedNotes(input.notes || []);
  var positionLevel = padObservedPositionLevel(notes);
  var result = {
    chord: { rootPC: rootPC, quality: quality, name: chord.name || null },
    notes: notes.map(function(n) { return padObservedOutputNote(n, rootPC == null ? 0 : rootPC, quality); }),
    shell: null,
    ust: null,
    positionEvidence: positionLevel,
  };
  if (rootPC === null || !quality || notes.length < 2) return result;

  var shellSelection = padObservedSelectShell(notes, rootPC, quality);
  if (!shellSelection) return result;
  var shellNotes = shellSelection.owned;
  result.shell = {
    notes: shellNotes.map(function(n) { return padObservedOutputNote(n, rootPC, quality); }),
    degrees: shellNotes.map(function(n) { return padObservedDegreeName(n.pc - rootPC, quality); }),
    confidence: positionLevel === 'exact' ? 'physical' : (positionLevel === 'reconstructed' ? 'physical' : 'register'),
    positionConfidence: positionLevel,
  };

  var upper = notes.filter(function(n) { return !shellSelection.sourceIndexes.has(n._sourceIndex); });
  if (upper.length < 3) return result;

  // If any position-aware evidence was supplied, do not silently downgrade a failed
  // physical shape to pitch-class/register inference. Generic MIDI is the explicit
  // `none` path and retains a register-based fallback.
  var upperPositionLevel = padObservedPositionLevel(upper);
  var hasAnyPositionEvidence = upper.some(function(n) { return n.positionConfidence !== 'none'; });
  if (hasAnyPositionEvidence && upperPositionLevel === 'none') return result;

  var quartal = padObservedFindQuartalStack(upper, upperPositionLevel);
  if (!quartal) return result;
  result.ust = {
    kind: 'quartal',
    name: padObservedQuartalName(quartal[0].pc - rootPC),
    base: chord.name || quality,
    notes: quartal.map(function(n) { return padObservedOutputNote(n, rootPC, quality); }),
    degrees: quartal.map(function(n) { return padObservedDegreeName(n.pc - rootPC, quality); }),
    confidence: upperPositionLevel === 'exact' ? 'physical' : (upperPositionLevel === 'reconstructed' ? 'physical' : 'register'),
    positionConfidence: upperPositionLevel,
  };
  return result;
}

if (typeof module !== 'undefined') module.exports = {
  PAD_OBSERVED_SHELL_RULES,
  padNormalizeObservedNotes,
  padObservedDegreeName,
  padObservedQuartalName,
  padAnalyzeObservedShellUst,
};
