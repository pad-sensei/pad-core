#!/usr/bin/env python3
"""Run the detection-transparency patch with indentation-tolerant rejection removal."""

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


module.replace_all_checked = flexible_replace
module.main()
