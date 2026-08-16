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
  // Duplicated upper degrees stay available to the UST layer as distinct sources.
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
  return (b.mappedMidi - a.mappedMidi) === ((b.row - a.row) * 5 + (b.col - a.col));
}

function padObservedQuartalGeometryIsCompact(stack, positionLevel) {
  if (positionLevel === 'none') return true;
  for (var i = 0; i < stack.length; i++) {
    for (var j = i + 1; j < stack.length; j++) {
      if (!padObservedGridPairIsConsistent(stack[i], stack[j])) return false;
    }
  }
  var rows = stack.map(function(n) { return n.row; });
  var cols = stack.map(function(n) { return n.col; });
  var rowSpan = Math.max.apply(null, rows) - Math.min.apply(null, rows);
  var colSpan = Math.max.apply(null, cols) - Math.min.apply(null, cols);
  return rowSpan <= 2 && colSpan <= 2;
}

function padObservedQuartalGeneratorPC(stack) {
  var pcs = new Set(stack.map(function(note) { return note.pc; }));
  if (pcs.size !== 3) return null;
  var values = Array.from(pcs);
  for (var i = 0; i < values.length; i++) {
    var base = values[i];
    if (pcs.has(padObservedMod12(base + 5)) && pcs.has(padObservedMod12(base + 10))) return base;
  }
  return null;
}

function padObservedOrderQuartalStack(stack, generatorPC) {
  var order = [generatorPC, padObservedMod12(generatorPC + 5), padObservedMod12(generatorPC + 10)];
  return order.map(function(pc) {
    return stack.filter(function(note) { return note.pc === pc; })
      .sort(function(a, b) { return a.midi - b.midi || a._sourceIndex - b._sourceIndex; })[0];
  });
}

function padObservedFindRegisterQuartalStack(notes) {
  var ordered = notes.slice().sort(function(a, b) { return a.midi - b.midi || a._sourceIndex - b._sourceIndex; });
  var candidates = [];
  for (var i = 0; i < ordered.length; i++) {
    for (var j = i + 1; j < ordered.length; j++) {
      if (ordered[j].midi - ordered[i].midi !== 5) continue;
      for (var k = j + 1; k < ordered.length; k++) {
        if (ordered[k].midi - ordered[j].midi !== 5) continue;
        candidates.push({ stack: [ordered[i], ordered[j], ordered[k]], generatorPC: ordered[i].pc });
      }
    }
  }
  if (!candidates.length) return null;
  candidates.sort(function(a, b) {
    var aMin = Math.min.apply(null, a.stack.map(function(n) { return n.midi; }));
    var bMin = Math.min.apply(null, b.stack.map(function(n) { return n.midi; }));
    if (aMin !== bMin) return bMin - aMin;
    return a.stack[0]._sourceIndex - b.stack[0]._sourceIndex;
  });
  return candidates[0];
}

function padObservedFindPhysicalQuartalStack(notes, positionLevel) {
  var candidates = [];
  for (var i = 0; i < notes.length; i++) {
    for (var j = i + 1; j < notes.length; j++) {
      for (var k = j + 1; k < notes.length; k++) {
        var stack = [notes[i], notes[j], notes[k]];
        var generatorPC = padObservedQuartalGeneratorPC(stack);
        if (generatorPC === null || !padObservedQuartalGeometryIsCompact(stack, positionLevel)) continue;
        candidates.push({
          stack: padObservedOrderQuartalStack(stack, generatorPC),
          generatorPC: generatorPC,
          minMidi: Math.min(stack[0].midi, stack[1].midi, stack[2].midi),
          rowSpan: Math.max(stack[0].row, stack[1].row, stack[2].row) - Math.min(stack[0].row, stack[1].row, stack[2].row),
          colSpan: Math.max(stack[0].col, stack[1].col, stack[2].col) - Math.min(stack[0].col, stack[1].col, stack[2].col),
        });
      }
    }
  }
  if (!candidates.length) return null;
  candidates.sort(function(a, b) {
    // Use the highest compact physical group. For equal register, prefer the
    // tighter geometry and then deterministic source order.
    if (a.minMidi !== b.minMidi) return b.minMidi - a.minMidi;
    var aSpan = a.rowSpan + a.colSpan;
    var bSpan = b.rowSpan + b.colSpan;
    if (aSpan !== bSpan) return aSpan - bSpan;
    return a.stack[0]._sourceIndex - b.stack[0]._sourceIndex;
  });
  return candidates[0];
}

function padObservedFindQuartalStack(notes, positionLevel) {
  if (positionLevel === 'none') return padObservedFindRegisterQuartalStack(notes);
  return padObservedFindPhysicalQuartalStack(notes, positionLevel);
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

  // Mixed physical/generic evidence must not silently downgrade to register inference.
  var upperPositionLevel = padObservedPositionLevel(upper);
  var hasAnyPositionEvidence = upper.some(function(n) { return n.positionConfidence !== 'none'; });
  if (hasAnyPositionEvidence && upperPositionLevel === 'none') return result;

  var quartal = padObservedFindQuartalStack(upper, upperPositionLevel);
  if (!quartal) return result;
  result.ust = {
    kind: 'quartal',
    name: padObservedQuartalName(quartal.generatorPC - rootPC),
    base: chord.name || quality,
    notes: quartal.stack.map(function(n) { return padObservedOutputNote(n, rootPC, quality); }),
    degrees: quartal.stack.map(function(n) { return padObservedDegreeName(n.pc - rootPC, quality); }),
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
