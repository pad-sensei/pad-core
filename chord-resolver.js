// ========================================
// PAD-CORE — Chord Resolution Policy
//
// padDetectChord() remains the transparent candidate generator: it may retain
// partial/unusual readings as long as every observed pitch is preserved in
// metadata. This resolver owns the user-facing preference policy shared by
// 64 Pad Explorer and Push.
// ========================================

function padResolverPitchClass(value) {
  return ((value % 12) + 12) % 12;
}

function padResolverUniquePitchClasses(values) {
  var seen = {};
  var out = [];
  for (var i = 0; i < (values || []).length; i++) {
    var pc = padResolverPitchClass(values[i]);
    if (!seen[pc]) {
      seen[pc] = true;
      out.push(pc);
    }
  }
  return out.sort(function(a, b) { return a - b; });
}

function padResolverLowestPitchClass(midiNotes) {
  if (!midiNotes || midiNotes.length === 0) return null;
  var lowest = midiNotes[0];
  for (var i = 1; i < midiNotes.length; i++) {
    if (midiNotes[i] < lowest) lowest = midiNotes[i];
  }
  return padResolverPitchClass(lowest);
}

function padResolverCandidatePitchClasses(candidate, bassPC) {
  if (!candidate || candidate.rootPC === null || candidate.rootPC === undefined) return [];
  var rel = padResolverUniquePitchClasses(candidate.chordPCS || []);
  if (rel.length === 0) return [];
  var abs = rel.map(function(pc) {
    return padResolverPitchClass(candidate.rootPC + pc);
  });

  // A slash spelling explicitly accounts for the played bass even when that
  // pitch is not part of the upper structure's chordPCS. This keeps complete
  // pedal/slash interpretations such as F/G from being mistaken for partials.
  if (bassPC !== null && String(candidate.name || '').indexOf(' / ') >= 0) {
    abs.push(bassPC);
  }
  return padResolverUniquePitchClasses(abs);
}

function padResolveChordCandidateList(midiNotes, rawCandidates) {
  var observed = padResolverUniquePitchClasses(midiNotes || []);
  if (observed.length < 2) return [];
  var bassPC = padResolverLowestPitchClass(midiNotes || []);
  var candidates = (rawCandidates || []).map(function(candidate, index) {
    var copy = Object.assign({}, candidate);
    var explained = padResolverCandidatePitchClasses(copy, bassPC);
    var explainedSet = {};
    for (var i = 0; i < explained.length; i++) explainedSet[explained[i]] = true;
    var observedSet = {};
    for (var j = 0; j < observed.length; j++) observedSet[observed[j]] = true;

    var unexplained = observed.filter(function(pc) { return !explainedSet[pc]; });
    var unplayed = explained.filter(function(pc) { return !observedSet[pc]; });
    var exact = unexplained.length === 0 && unplayed.length === 0;

    copy.resolutionCompleteness = exact ? 'exact' : 'partial';
    copy.resolutionExplainedPCS = explained;
    copy.resolutionUnexplainedPCS = unexplained;
    copy.resolutionUnplayedPCS = unplayed;
    copy.resolutionOriginalIndex = index;
    return copy;
  });

  var hasExact = candidates.some(function(candidate) {
    return candidate.resolutionCompleteness === 'exact';
  });

  // When a complete supported harmony exists, a three-note root-position
  // subset with an observed extra is not a competing user-facing chord name.
  // The raw detector still retains it for transparent/debug/theory inspection.
  if (hasExact) {
    candidates = candidates.filter(function(candidate) {
      var cardinality = padResolverUniquePitchClasses(candidate.chordPCS || []).length;
      var incompleteTriad = cardinality === 3
        && candidate.resolutionCompleteness !== 'exact'
        && candidate.resolutionUnexplainedPCS.length > 0;
      return !incompleteTriad;
    });
  }

  candidates.sort(function(a, b) {
    var aExact = a.resolutionCompleteness === 'exact' ? 1 : 0;
    var bExact = b.resolutionCompleteness === 'exact' ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    var aScore = Number(a.score) || 0;
    var bScore = Number(b.score) || 0;
    if (aScore !== bScore) return bScore - aScore;
    return a.resolutionOriginalIndex - b.resolutionOriginalIndex;
  });

  if (candidates.length === 0) return [];

  var rankGroup = 0;
  var previousCompleteness = null;
  var previousScore = null;
  for (var ci = 0; ci < candidates.length; ci++) {
    var current = candidates[ci];
    var currentScore = Number(current.score) || 0;
    if (current.resolutionCompleteness !== previousCompleteness || currentScore !== previousScore) {
      rankGroup++;
      previousCompleteness = current.resolutionCompleteness;
      previousScore = currentScore;
    }
    current.resolutionRankGroup = rankGroup;
    current.isTopRanked = rankGroup === 1;
  }

  var topGroupSize = candidates.filter(function(candidate) { return candidate.isTopRanked; }).length;
  for (var ti = 0; ti < candidates.length; ti++) {
    candidates[ti].topGroupSize = topGroupSize;
    delete candidates[ti].resolutionOriginalIndex;
  }

  return candidates.slice(0, 8);
}

function padResolveChordCandidates(midiNotes, spellingKey) {
  var detector = typeof padDetectChord === 'function' ? padDetectChord : null;
  if (!detector && typeof require !== 'undefined') {
    detector = require('./theory.js').padDetectChord;
  }
  if (typeof detector !== 'function') {
    throw new Error('pad-core chord resolver prerequisite missing: padDetectChord');
  }
  return padResolveChordCandidateList(midiNotes, detector(midiNotes, spellingKey));
}

if (typeof globalThis !== 'undefined') {
  globalThis.padResolveChordCandidateList = padResolveChordCandidateList;
  globalThis.padResolveChordCandidates = padResolveChordCandidates;
}

if (typeof module !== 'undefined') module.exports = {
  padResolveChordCandidateList,
  padResolveChordCandidates,
};
