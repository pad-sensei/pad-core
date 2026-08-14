const fs = require('fs');

const theoryPath = 'theory.js';
const theoryTestPath = 'tests/theory.test.js';
const regressionPath = 'tests/v17-detection-transparency.test.js';

let theory = fs.readFileSync(theoryPath, 'utf8');
let theoryTest = fs.readFileSync(theoryTestPath, 'utf8');

function replaceOnce(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  return text.replace(from, to);
}

function replaceRegexOnce(text, regex, to, label) {
  const matches = text.match(regex);
  if (!matches) throw new Error(`${label}: no match`);
  const remainder = text.slice(matches.index + matches[0].length);
  if (remainder.match(regex)) throw new Error(`${label}: more than one match`);
  return text.replace(regex, to);
}

function removeExactCount(text, needle, expected, label) {
  const count = text.split(needle).length - 1;
  if (count !== expected) {
    throw new Error(`${label}: expected ${expected} matches, found ${count}`);
  }
  return text.split(needle).join('');
}

// Remove theory-based hard suppression helpers. The detector may rank candidates,
// but it must not erase an observed pitch or a candidate merely because the
// interpretation is unusual.
theory = replaceRegexOnce(
  theory,
  /function padRejectMinorSeventhFlat13\(chordName, intervals\) \{[\s\S]*?\n\}\n\n/,
  '',
  'remove minor7-b13 rejection helper'
);
theory = replaceRegexOnce(
  theory,
  /function padRejectDominantSlashOverBassShell\(chordName, rootPC, lowestPC, lowestHasShell\) \{[\s\S]*?\n\}\n\n/,
  '',
  'remove dominant slash rejection helper'
);
theory = replaceRegexOnce(
  theory,
  /function padIsUnnameableMajorSplitThirdColor\(pcs, bassPC\) \{[\s\S]*?\n\}\n\n/,
  '',
  'remove split-third early rejection helper'
);
theory = replaceRegexOnce(
  theory,
  /function padIsAllowedSlashChordCandidate\(qualityName, qualityPcs, upperRootPC, bassPC\) \{[\s\S]*?\n\}\n\n/,
  '',
  'remove slash whitelist helper'
);

const augHelper = `function padAugAlteredPenalty(chordName, intervals) {
  if ((chordName || '').indexOf('aug') < 0) return 0;
  var hasDominantSeventh = intervals[10];
  var hasAlteredDominantColor = intervals[1] || intervals[3] || intervals[6] || intervals[8];
  return hasDominantSeventh && hasAlteredDominantColor ? 140 : 0;
}
`;

const transparencyHelpers = `

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
  var trailing = name.match(/^(.*)\\(([^()]*)\\)$/);
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

function padFinalizeObservedCandidate(candidate, observedPCS, lowestPC) {
  var exactObserved = observedPCS.slice().sort(function(a, b) { return a - b; });
  candidate.observedPCS = exactObserved;
  // Long-form alias for consumers that prefer an explicit field name.
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

  // A non-chord-tone slash bass is already explicitly represented by /Bass;
  // do not duplicate it as a tension label.
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
`;

theory = replaceOnce(theory, augHelper, augHelper + transparencyHelpers, 'insert transparency helpers');

theory = replaceOnce(
  theory,
  '  if (padIsUnnameableMajorSplitThirdColor(pcs, lowestPC)) return [];\n',
  '',
  'remove split-third early return'
);

theory = removeExactCount(
  theory,
  '          if (padRejectMinorSeventhFlat13(chord.name, intervals)) continue;\n',
  2,
  'remove minor7-b13 call sites'
);
theory = removeExactCount(
  theory,
  '          if (padRejectDominantSlashOverBassShell(chord.name, rootPC, lowestPC, lowestHasShell)) continue;\n',
  2,
  'remove dominant slash call sites'
);
theory = replaceOnce(
  theory,
  "            var hasShell = (intervals[3] || intervals[4]) && (intervals[10] || intervals[11]);\n            var omitLabel = (chord.pcs.length >= 5 || hasShell) ? '' : '(omit5)';\n",
  "            var omitLabel = '(omit5)';\n",
  'make omit5 factual'
);
theory = removeExactCount(
  theory,
  '            if (!padIsAllowedSlashChordCandidate(triad.name, triad.pcs, triadRoot, lowestPC)) continue;\n',
  1,
  'remove triad slash whitelist'
);
theory = replaceOnce(
  theory,
  "            var isB7OverBassHybrid = ((triadRoot - lowestPC + 12) % 12) === 10;\n            if (!(lowestHasShell && isB7OverBassHybrid)) {\n              var score = isTriadRoot ? 125 : (!isSlashInversion ? 144 : 25);\n              padPushOrBumpCandidate(name, triadRoot, score, padSimpleDetectDetails(triad.name, triad.pcs));\n            }\n",
  "            var score = isTriadRoot ? 125 : (!isSlashInversion ? 144 : 25);\n            padPushOrBumpCandidate(name, triadRoot, score, padSimpleDetectDetails(triad.name, triad.pcs));\n",
  'remove bass-shell hybrid suppression'
);
theory = replaceOnce(
  theory,
  '  if (pcs.length >= 4 && !lowestHasShell) {\n',
  '  if (pcs.length >= 4) {\n',
  'allow b7 hybrids over shell bass'
);
theory = removeExactCount(
  theory,
  '    if (lowestHasShell) return;\n',
  2,
  'remove lowest-shell guards'
);
theory = removeExactCount(
  theory,
  '            if (!padIsAllowedSlashChordCandidate(tet.name, tet.pcs, tetRoot, lowestPC)) continue;\n',
  1,
  'remove tetrad slash whitelist'
);
theory = removeExactCount(
  theory,
  "            if (lowestHasShell && tet.name === '7') continue;\n",
  1,
  'remove dominant tetrad shell suppression'
);
theory = replaceOnce(
  theory,
  "    var pinned = existingIdx >= 0 ? candidates.splice(existingIdx, 1)[0] : { name: pinnedName, rootPC: root, score: 144 };\n",
  "    var pinned = existingIdx >= 0 ? candidates.splice(existingIdx, 1)[0] : Object.assign(\n      { name: pinnedName, rootPC: root, score: 144 },\n      padSimpleDetectDetails(suffix || 'Maj', [0, thirdFromBass === 2 ? 4 : 3, 7])\n    );\n",
  'keep pinned hybrid schema complete'
);
theory = replaceOnce(
  theory,
  "  pinB7HybridNearTop('', 2);\n  pinB7HybridNearTop('m', 1);\n  return candidates.slice(0, 8);\n",
  "  pinB7HybridNearTop('', 2);\n  pinB7HybridNearTop('m', 1);\n  for (var oi = 0; oi < candidates.length; oi++) {\n    padFinalizeObservedCandidate(candidates[oi], pcs, lowestPC);\n  }\n  return candidates.slice(0, 8);\n",
  'attach exact observed pitch classes to every candidate'
);

const oldBm7Test = `    it('B,G,A,D is Gadd9 / B, not Bm7(b13)', () => {
      const results = padDetectChord([59, 67, 69, 74]);
      expect(results[0].name).toBe('Gadd9 / B');
      expect(results.some(r => r.name.indexOf('Bm7(b13)') >= 0)).toBe(false);
    });`;
const newBm7Test = `    it('B,G,A,D keeps Gadd9 / B first while retaining Bm7(b13)', () => {
      const results = padDetectChord([59, 67, 69, 74]);
      expect(results[0].name).toBe('Gadd9 / B');
      expect(results.some(r => r.name.startsWith('Bm7(b13)'))).toBe(true);
    });`;
theoryTest = replaceOnce(theoryTest, oldBm7Test, newBm7Test, 'update Bm7(b13) regression ruling');

const regression = `import { describe, it, expect } from 'vitest';

describe('v1.7 detection transparency', () => {
  function observedPCS(notes) {
    return Array.from(new Set(notes.map(note => ((note % 12) + 12) % 12))).sort((a, b) => a - b);
  }

  function expectExactObservation(notes, candidates) {
    const expected = observedPCS(notes);
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.observedPCS).toEqual(expected);
      expect(candidate.observedPitchClasses).toEqual(expected);
    }
  }

  it('keeps a played b9 visible on a C sixth-family candidate', () => {
    const notes = [60, 61, 64, 69, 74]; // C Db E A D
    const candidates = padDetectChord(notes);
    const sixth = candidates.find(candidate =>
      candidate.rootPC === 0 && candidate.name.startsWith('C6') && candidate.name.includes('b9')
    );
    expect(sixth).toBeTruthy();
    expect(sixth.tensionLabels).toContain('b9');
    expect(sixth.observedExtraLabels).toContain('b9');
    expectExactObservation(notes, candidates);
  });

  it('does not return empty for split thirds and interprets b3 locally as #9 on major-third candidates', () => {
    const notes = [60, 63, 64, 69, 71]; // C Eb E A B
    const candidates = padDetectChord(notes);
    expect(candidates.some(candidate => candidate.rootPC === 0 && candidate.name.includes('#9'))).toBe(true);
    expectExactObservation(notes, candidates);
  });

  it('does not return empty for simultaneous b7 and Maj7', () => {
    const notes = [60, 64, 67, 70, 71]; // C E G Bb B
    const candidates = padDetectChord(notes);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some(candidate => candidate.rootPC === 0 &&
      (candidate.name.includes('b7') || candidate.name.includes('Maj7')))).toBe(true);
    expectExactObservation(notes, candidates);
  });

  it('retains Bm7(b13) behind the preferred Gadd9 / B reading', () => {
    const notes = [59, 67, 69, 74]; // B G A D
    const candidates = padDetectChord(notes);
    expect(candidates[0].name).toBe('Gadd9 / B');
    expect(candidates.some(candidate => candidate.name.startsWith('Bm7(b13)'))).toBe(true);
    expectExactObservation(notes, candidates);
  });

  it('retains non-functional slash/pedal candidates such as D / C', () => {
    const notes = [60, 62, 66, 69]; // C D F# A
    const candidates = padDetectChord(notes);
    expect(candidates.some(candidate => candidate.name === 'D / C')).toBe(true);
    expectExactObservation(notes, candidates);
  });
});
`;

fs.writeFileSync(theoryPath, theory);
fs.writeFileSync(theoryTestPath, theoryTest);
fs.writeFileSync(regressionPath, regression);
console.log('Detection transparency patch applied.');
