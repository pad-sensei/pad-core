#!/usr/bin/env python3
"""Run the detection-transparency patch with compatibility fixups."""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

module_path = Path(__file__).with_name("patch_detection_transparency.py")
spec = importlib.util.spec_from_file_location("detection_patch", module_path)
if spec is None or spec.loader is None:
    raise SystemExit("cannot load patch_detection_transparency.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
original = module.replace_all_checked


def flexible_replace(text: str, old: str, new: str, expected: int, label: str) -> str:
    if label != "remove hard exact/omit rejection":
        return original(text, old, new, expected, label)

    patterns = [
        r"^[ \t]*if \(padRejectMinorSeventhFlat13\(chord\.name, intervals\)\) continue;\n",
        r"^[ \t]*if \(padRejectDominantSlashOverBassShell\(chord\.name, rootPC, lowestPC, lowestHasShell\)\) continue;\n",
    ]
    for pattern in patterns:
        text, count = re.subn(pattern, "", text, flags=re.MULTILINE)
        if count != expected:
            raise SystemExit(f"{label}: expected {expected} matches for {pattern}, found {count}")
    return text


def postprocess_detector(root: Path) -> None:
    path = root / "theory.js"
    text = path.read_text()

    old_merge = """      if (candidates[ci].name === name) {
        candidates[ci].score = Math.max(candidates[ci].score || 0, score);
        if (details) Object.assign(candidates[ci], details);
        return;
      }
"""
    new_merge = """      if (candidates[ci].name === name) {
        var existingScore = candidates[ci].score || 0;
        var existingRichness = ((candidates[ci].tensionLabels || []).length * 100)
          + ((candidates[ci].chordIntervals || []).length * 10)
          + ((candidates[ci].chordPCS || []).length);
        var newRichness = ((details.tensionLabels || []).length * 100)
          + ((details.chordIntervals || []).length * 10)
          + ((details.chordPCS || []).length);
        // Base-chord + observed-extra matching and generated exact-tension matching
        // can converge on the same visible name. Keep the richer structured
        // producer so exact pitch/register semantics are never overwritten.
        if (newRichness > existingRichness
            || (newRichness === existingRichness && score > existingScore)) {
          Object.assign(candidates[ci], details);
        }
        candidates[ci].score = Math.max(existingScore, score);
        return;
      }
"""
    if text.count(old_merge) != 1:
        raise SystemExit(f"duplicate merge anchor mismatch: {text.count(old_merge)}")
    text = text.replace(old_merge, new_merge, 1)

    guarded = "if (!seenNames[name]) padPushOrBumpCandidate(name, rootPC, score, padDetectDetails(chord));"
    count = text.count(guarded)
    if count != 2:
        raise SystemExit(f"generated candidate guard mismatch: {count}")
    text = text.replace(guarded, "padPushOrBumpCandidate(name, rootPC, score, padDetectDetails(chord));")

    old_omit_score = """            var extraPenalty = extra > 0 ? extra * 35 : 0;
            var score = rootBonus + chord.pcs.length * 10 - extra - 5 - extraPenalty
              + padShellScoreBonus(intervals) - padAugAlteredPenalty(chord.name, intervals)
              - padMinorSeventhFlat13Penalty(chord.name, intervals)
              - padDominantSlashOverBassShellPenalty(chord.name, rootPC, lowestPC, lowestHasShell);
"""
    new_omit_score = """            var extraPenalty = extra > 0 ? extra * 35 : 0;
            // Formerly hidden add/m6-derived omit readings remain visible, but an
            // exact dim/aug/triad identity must rank ahead of the derived spelling.
            var derivedOmitPenalty = (/^m?add/.test(chord.name || '') || chord.name === 'm6(11)') ? 30 : 0;
            var score = rootBonus + chord.pcs.length * 10 - extra - 5 - extraPenalty - derivedOmitPenalty
              + padShellScoreBonus(intervals) - padAugAlteredPenalty(chord.name, intervals)
              - padMinorSeventhFlat13Penalty(chord.name, intervals)
              - padDominantSlashOverBassShellPenalty(chord.name, rootPC, lowestPC, lowestHasShell);
"""
    if text.count(old_omit_score) != 1:
        raise SystemExit(f"omit ranking anchor mismatch: {text.count(old_omit_score)}")
    text = text.replace(old_omit_score, new_omit_score, 1)
    path.write_text(text)


module.replace_all_checked = flexible_replace
module.main()
postprocess_detector(Path(sys.argv[1]).resolve())
print("detection transparency compatibility fixups: PASS")
