#!/usr/bin/env python3
"""Apply the v1.7 transparent observed-detection ruling to a pad-core worktree."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one anchor, found {count}")
    return text.replace(old, new, 1)


def replace_all_checked(text: str, old: str, new: str, expected: int, label: str) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{label}: expected {expected} anchors, found {count}")
    return text.replace(old, new)


def patch_theory(root: Path) -> None:
    path = root / "theory.js"
    text = path.read_text()

    text = replace_once(
        text,
        """function padRejectMinorSeventhFlat13(chordName, intervals) {
  return /^m7/.test(chordName || '')
    && (chordName || '').indexOf('b5') < 0
    && intervals[8];
}
""",
        """function padMinorSeventhFlat13Penalty(chordName, intervals) {
  // Keep the candidate visible, but conventional readings may rank ahead.
  return /^m7/.test(chordName || '')
    && (chordName || '').indexOf('b5') < 0
    && intervals[8] ? 180 : 0;
}
""",
        "minor7-b13 penalty",
    )

    text = replace_once(
        text,
        """function padRejectDominantSlashOverBassShell(chordName, rootPC, lowestPC, lowestHasShell) {
  return lowestHasShell
    && rootPC !== lowestPC
    && /^7/.test(chordName || '');
}
""",
        """function padDominantSlashOverBassShellPenalty(chordName, rootPC, lowestPC, lowestHasShell) {
  // A bass-owned shell lowers this reading; it no longer deletes it.
  return lowestHasShell
    && rootPC !== lowestPC
    && /^7/.test(chordName || '') ? 160 : 0;
}
""",
        "dominant shell penalty",
    )

    helpers = r'''

var PAD_OBSERVED_LABEL_INTERVALS = {
  'b5': 6, '5': 7, '#5': 8, '6': 9, 'b7': 10, '7': 23,
  'b9': 13, '9': 14, '#9': 15, 'b11': 16, '11': 17, '#11': 18,
  'b13': 20, '13': 21,
};
var PAD_OBSERVED_LABEL_ORDER = {
  'b5': 0, '5': 1, '#5': 2,
  'b9': 10, '9': 11, '#9': 12,
  'b11': 20, '11': 21, '#11': 22,
  'b13': 30, '13': 31,
  '6': 40, 'b7': 41, '7': 42,
};

function padObservedExtraLabel(interval, declaredSet) {
  switch (interval) {
    case 1: return 'b9';
    case 2: return '9';
    // Candidate-local interpretation: when both thirds sound, the minor third
    // is #9 against a major-third candidate. No observed pitch is discarded.
    case 3: return '#9';
    case 4: return 'b11';
    case 5: return '11';
    case 6: return declaredSet[7] ? '#11' : 'b5';
    case 7: return '5';
    case 8: return declaredSet[7] ? 'b13' : '#5';
    case 9: return (declaredSet[10] || declaredSet[11]) ? '13' : '6';
    case 10: return 'b7';
    case 11: return '7';
    default: return null;
  }
}

function padMergeObservedLabels(first, second) {
  var seen = {};
  var labels = [];
  (first || []).concat(second || []).forEach(function(label) {
    if (!label || seen[label]) return;
    seen[label] = true;
    labels.push(label);
  });
  labels.sort(function(a, b) {
    var ao = PAD_OBSERVED_LABEL_ORDER[a];
    var bo = PAD_OBSERVED_LABEL_ORDER[b];
    if (ao === undefined) ao = 999;
    if (bo === undefined) bo = 999;
    return ao - bo;
  });
  return labels;
}

function padAddObservedLabelsToName(name, extraLabels) {
  if (!extraLabels || extraLabels.length === 0) return name;
  var slashAt = name.indexOf(' / ');
  var bass = slashAt >= 0 ? name.slice(slashAt) : '';
  var main = slashAt >= 0 ? name.slice(0, slashAt) : name;
  var structural = '';
  var structuralMatch = main.match(/(\(omit[35]\))$/);
  if (structuralMatch) {
    structural = structuralMatch[1];
    main = main.slice(0, -structural.length);
  }

  var existing = [];
  var group = main.match(/\(([^()]*)\)$/);
  if (group) {
    var tokens = group[1].split(',').map(function(token) { return token.trim(); }).filter(Boolean);
    var isObservedGroup = tokens.length > 0 && tokens.every(function(token) {
      return PAD_OBSERVED_LABEL_INTERVALS[token] !== undefined;
    });
    if (isObservedGroup) {
      existing = tokens;
      main = main.slice(0, group.index);
    }
  }
  var merged = padMergeObservedLabels(existing, extraLabels);
  return main + '(' + merged.join(',') + ')' + structural + bass;
}

function padEnrichObservedDetection(name, rootPC, lowestPC, observedPCS, details) {
  details = Object.assign({}, details || {});
  var observedIntervals = observedPCS.map(function(pc) {
    return ((pc - rootPC) + 12) % 12;
  }).sort(function(a, b) { return a - b; });
  var declaredSet = {};
  (details.chordPCS || []).forEach(function(interval) {
    declaredSet[((interval % 12) + 12) % 12] = true;
  });
  var slashBassInterval = name.indexOf(' / ') >= 0
    ? ((lowestPC - rootPC) + 12) % 12 : null;
  var extraIntervals = observedIntervals.filter(function(interval) {
    return !declaredSet[interval] && interval !== slashBassInterval;
  });
  var extraLabels = padMergeObservedLabels([], extraIntervals.map(function(interval) {
    return padObservedExtraLabel(interval, declaredSet);
  }).filter(Boolean));

  details.observedPCS = observedPCS.slice();
  details.observedIntervals = observedIntervals;
  details.extraIntervals = extraIntervals;
  details.extraLabels = extraLabels;
  details.tensionLabels = padMergeObservedLabels(details.tensionLabels || [], extraLabels);

  var tensionIntervals = (details.tensionIntervals || []).slice();
  extraLabels.forEach(function(label) {
    var interval = PAD_OBSERVED_LABEL_INTERVALS[label];
    if (interval !== undefined && tensionIntervals.indexOf(interval) < 0) tensionIntervals.push(interval);
  });
  tensionIntervals.sort(function(a, b) { return a - b; });
  details.tensionIntervals = tensionIntervals;
  details.tensionPCS = Array.from(new Set(tensionIntervals.map(function(interval) {
    return ((interval % 12) + 12) % 12;
  }))).sort(function(a, b) { return a - b; });

  return { name: padAddObservedLabelsToName(name, extraLabels), details: details };
}
'''

    text = replace_once(
        text,
        "\nfunction padDetectChord(midiNotes, spellingKey) {",
        helpers + "\nfunction padDetectChord(midiNotes, spellingKey) {",
        "transparent helper insertion",
    )

    text = replace_once(
        text,
        "  if (padIsUnnameableMajorSplitThirdColor(pcs, lowestPC)) return [];\n",
        "  // Transparent observation: split thirds / dual sevenths remain detectable.\n",
        "remove early empty",
    )

    text = replace_once(
        text,
        """  function padPushOrBumpCandidate(name, rootPC, score, details) {
    details = details || padSimpleDetectDetails('unknown', []);
    for (var ci = 0; ci < candidates.length; ci++) {
""",
        """  function padPushOrBumpCandidate(name, rootPC, score, details) {
    details = details || padSimpleDetectDetails('unknown', []);
    var enriched = padEnrichObservedDetection(name, rootPC, lowestPC, pcs, details);
    name = enriched.name;
    details = enriched.details;
    for (var ci = 0; ci < candidates.length; ci++) {
""",
        "candidate enrichment",
    )

    text = replace_all_checked(
        text,
        """          if (padRejectMinorSeventhFlat13(chord.name, intervals)) continue;
          if (padRejectDominantSlashOverBassShell(chord.name, rootPC, lowestPC, lowestHasShell)) continue;
""",
        "",
        2,
        "remove hard exact/omit rejection",
    )

    text = replace_once(
        text,
        """          var score = (isRootPosition ? 100 : 0) + chord.pcs.length * 10 - extra
            + padShellScoreBonus(intervals) - padAugAlteredPenalty(chord.name, intervals);
""",
        """          var score = (isRootPosition ? 100 : 0) + chord.pcs.length * 10 - extra
            + padShellScoreBonus(intervals) - padAugAlteredPenalty(chord.name, intervals)
            - padMinorSeventhFlat13Penalty(chord.name, intervals)
            - padDominantSlashOverBassShellPenalty(chord.name, rootPC, lowestPC, lowestHasShell);
""",
        "exact penalties",
    )

    text = replace_once(
        text,
        """        if (/^m?add/.test(chord.name || '')) continue;
        if (chord.name === 'm6(11)') continue;
""",
        "",
        "remove omit-family suppression",
    )

    text = replace_once(
        text,
        """            var score = rootBonus + chord.pcs.length * 10 - extra - 5 - extraPenalty
              + padShellScoreBonus(intervals) - padAugAlteredPenalty(chord.name, intervals);
""",
        """            var score = rootBonus + chord.pcs.length * 10 - extra - 5 - extraPenalty
              + padShellScoreBonus(intervals) - padAugAlteredPenalty(chord.name, intervals)
              - padMinorSeventhFlat13Penalty(chord.name, intervals)
              - padDominantSlashOverBassShellPenalty(chord.name, rootPC, lowestPC, lowestHasShell);
""",
        "omit penalties",
    )

    text = replace_once(
        text,
        """            if (!padIsAllowedSlashChordCandidate(triad.name, triad.pcs, triadRoot, lowestPC)) continue;
            var triadName = padPreferredRootNoteName(triadRoot, spellingKey) + (triad.name === 'Maj' ? '' : triad.name);
""",
        """            var slashPenalty = padIsAllowedSlashChordCandidate(triad.name, triad.pcs, triadRoot, lowestPC) ? 0 : 90;
            var triadName = padPreferredRootNoteName(triadRoot, spellingKey) + (triad.name === 'Maj' ? '' : triad.name);
""",
        "triad slash penalty",
    )

    text = replace_once(
        text,
        """            var isB7OverBassHybrid = ((triadRoot - lowestPC + 12) % 12) === 10;
            if (!(lowestHasShell && isB7OverBassHybrid)) {
              var score = isTriadRoot ? 125 : (!isSlashInversion ? 144 : 25);
              padPushOrBumpCandidate(name, triadRoot, score, padSimpleDetectDetails(triad.name, triad.pcs));
            }
""",
        """            var isB7OverBassHybrid = ((triadRoot - lowestPC + 12) % 12) === 10;
            var shellHybridPenalty = lowestHasShell && isB7OverBassHybrid ? 120 : 0;
            var score = (isTriadRoot ? 125 : (!isSlashInversion ? 144 : 25))
              - slashPenalty - shellHybridPenalty;
            padPushOrBumpCandidate(name, triadRoot, score, padSimpleDetectDetails(triad.name, triad.pcs));
""",
        "triad no suppression",
    )

    text = replace_once(
        text,
        """            if (!padIsAllowedSlashChordCandidate(tet.name, tet.pcs, tetRoot, lowestPC)) continue;
            var tetName = padPreferredRootNoteName(tetRoot, spellingKey) + tet.name;
""",
        """            var tetSlashPenalty = padIsAllowedSlashChordCandidate(tet.name, tet.pcs, tetRoot, lowestPC) ? 0 : 90;
            var tetName = padPreferredRootNoteName(tetRoot, spellingKey) + tet.name;
""",
        "tetrad slash penalty",
    )

    text = replace_once(
        text,
        """            if (tetRoot === lowestPC) continue;
            if (lowestHasShell && tet.name === '7') continue;
            var name = tetName + ' / ' + bassName;
            var isSlashInversion = tet.pcs.indexOf(((lowestPC - tetRoot) + 12) % 12) !== -1;
            var score = isSlashInversion ? 30 + tet.pcs.length * 5 : 144;
""",
        """            if (tetRoot === lowestPC) continue;
            var name = tetName + ' / ' + bassName;
            var isSlashInversion = tet.pcs.indexOf(((lowestPC - tetRoot) + 12) % 12) !== -1;
            var shellDominantPenalty = lowestHasShell && tet.name === '7' ? 160 : 0;
            var score = (isSlashInversion ? 30 + tet.pcs.length * 5 : 144)
              - tetSlashPenalty - shellDominantPenalty;
""",
        "tetrad no suppression",
    )

    path.write_text(text)


def patch_legacy_tests(root: Path) -> None:
    path = root / "tests" / "theory.test.js"
    text = path.read_text()

    text = replace_once(
        text,
        """    it('does not force a chord name onto major seventh split-third colors', () => {
      expect(padDetectChord([60, 63, 64, 69, 71])).toEqual([]);
    });
    it('does not force a chord name when flat seventh and major seventh coexist', () => {
      expect(padDetectChord([60, 64, 67, 70, 71])).toEqual([]);
    });
""",
        """    it('keeps split-third colors and interprets the minor third as candidate-local #9', () => {
      const results = padDetectChord([60, 63, 64, 69, 71]);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(result => result.name.indexOf('#9') >= 0)).toBe(true);
    });
    it('keeps simultaneous flat and major sevenths observable', () => {
      const results = padDetectChord([60, 64, 67, 70, 71]);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(result => result.observedPCS.join(',') === '0,4,7,10,11')).toBe(true);
    });
""",
        "split-third legacy tests",
    )

    text = replace_once(
        text,
        """    it('B,G,A,D is Gadd9 / B, not Bm7(b13)', () => {
      const results = padDetectChord([59, 67, 69, 74]);
      expect(results[0].name).toBe('Gadd9 / B');
      expect(results.some(r => r.name.indexOf('Bm7(b13)') >= 0)).toBe(false);
    });
""",
        """    it('B,G,A,D keeps Gadd9 / B useful while retaining Bm7(b13)', () => {
      const results = padDetectChord([59, 67, 69, 74]);
      expect(results[0].name).toBe('Gadd9 / B');
      expect(results.some(r => r.name.indexOf('Bm7(b13)') >= 0)).toBe(true);
    });
""",
        "minor7-b13 legacy test",
    )

    text = replace_once(
        text,
        """    it('does not list non-functional pedal triads as slash candidates', () => {
      const results = padDetectChord([60, 62, 66, 69]);
      expect(results.some(r => r.name === 'D / C')).toBe(false);
    });
""",
        """    it('retains non-functional pedal triads as lower-ranked slash candidates', () => {
      const results = padDetectChord([60, 62, 66, 69]);
      expect(results.some(r => r.name === 'D / C')).toBe(true);
    });
""",
        "pedal slash legacy test",
    )

    path.write_text(text)


def add_transparency_tests(root: Path) -> None:
    path = root / "tests" / "v17-detection-transparency.test.js"
    if path.exists():
        raise SystemExit("transparency test file already exists")
    path.write_text(r'''import { describe, it, expect } from 'vitest';

const sortedPCs = (notes) => [...new Set(notes.map(note => ((note % 12) + 12) % 12))].sort((a, b) => a - b);

describe('v1.7 transparent observed detection', () => {
  it('does not hide a played b9 behind a rounded Maj7(13) name', () => {
    const notes = [48, 49, 52, 57, 59]; // C Db E A B
    const candidate = padDetectChord(notes).find(result => result.name === 'CMaj7(b9,13)');
    expect(candidate).toBeDefined();
    expect(candidate.tensionLabels).toEqual(['b9', '13']);
    expect(candidate.tensionPCS).toEqual([1, 9]);
    expect(candidate.tensionIntervals).toEqual([13, 21]);
    expect(candidate.observedPCS).toEqual([0, 1, 4, 9, 11]);
    expect(candidate.extraLabels).toEqual(['b9']);
  });

  it('treats a played minor third as #9 for a major-third candidate without erasing it', () => {
    const notes = [60, 63, 64, 69, 71]; // C Eb E A B
    const candidate = padDetectChord(notes).find(result => result.name === 'CMaj7(#9,13)');
    expect(candidate).toBeDefined();
    expect(candidate.tensionLabels).toEqual(['#9', '13']);
    expect(candidate.observedIntervals).toEqual([0, 3, 4, 9, 11]);
  });

  it('returns candidates for dual-seventh collections instead of early-empty suppression', () => {
    const notes = [60, 64, 67, 70, 71];
    const results = padDetectChord(notes);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(result => result.observedPCS.join(',') === '0,4,7,10,11')).toBe(true);
  });

  it('retains an unconventional minor-seven-flat-thirteen reading behind the useful alternative', () => {
    const results = padDetectChord([59, 67, 69, 74]); // B G A D
    expect(results[0].name).toBe('Gadd9 / B');
    expect(results.some(result => result.name === 'Bm7(b13)')).toBe(true);
  });

  it('retains non-functional slash candidates and records the same observed set on every result', () => {
    const notes = [60, 62, 66, 69]; // C D F# A
    const expected = sortedPCs(notes);
    const results = padDetectChord(notes);
    expect(results.some(result => result.name === 'D / C')).toBe(true);
    for (const result of results) expect(result.observedPCS).toEqual(expected);
  });

  it('never fabricates an observed pitch while enriching candidate labels', () => {
    const fixtures = [
      [48, 49, 52, 57, 59],
      [60, 63, 64, 69, 71],
      [60, 64, 67, 70, 71],
      [59, 67, 69, 74],
      [60, 62, 66, 69],
    ];
    for (const notes of fixtures) {
      const expected = sortedPCs(notes);
      for (const result of padDetectChord(notes)) {
        expect(result.observedPCS).toEqual(expected);
        expect(result.observedIntervals)
          .toEqual(expected.map(pc => ((pc - result.rootPC) + 12) % 12).sort((a, b) => a - b));
      }
    }
  });
});
''')


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch_detection_transparency.py <pad-core-worktree>")
    root = Path(sys.argv[1]).resolve()
    patch_theory(root)
    patch_legacy_tests(root)
    add_transparency_tests(root)
    print("detection transparency patch: PASS")


if __name__ == "__main__":
    main()
