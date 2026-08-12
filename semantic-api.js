// ========================================
// PAD-CORE — Minimal semantic public API v0
//
// Compatibility adapter only. Musical semantics remain in data.js, theory.js,
// and observed-structure.js. Load this after those classic scripts.
// ========================================

function padRequireSemanticFunction(name, value) {
  if (typeof value !== 'function') {
    throw new Error('pad-core semantic API prerequisite missing: ' + name);
  }
  return value;
}

function padCreateSemanticApi() {
  return Object.freeze({
    version: '0',
    pitchClass: padRequireSemanticFunction('padPitchClass', typeof padPitchClass !== 'undefined' ? padPitchClass : null),
    pcName: padRequireSemanticFunction('padPcName', typeof padPcName !== 'undefined' ? padPcName : null),
    parseChord: padRequireSemanticFunction('padParseChordName', typeof padParseChordName !== 'undefined' ? padParseChordName : null),
    detectChord: padRequireSemanticFunction('padDetectChord', typeof padDetectChord !== 'undefined' ? padDetectChord : null),
    applyTension: padRequireSemanticFunction('padApplyTension', typeof padApplyTension !== 'undefined' ? padApplyTension : null),
    findParentScales: padRequireSemanticFunction('padFindParentScales', typeof padFindParentScales !== 'undefined' ? padFindParentScales : null),
    dim7AvailableTensionPCs: padRequireSemanticFunction(
      'padGetDim7AvailableTensionPCs',
      typeof padGetDim7AvailableTensionPCs !== 'undefined' ? padGetDim7AvailableTensionPCs : null
    ),
    analyzeObservedShellUst: padRequireSemanticFunction(
      'padAnalyzeObservedShellUst',
      typeof padAnalyzeObservedShellUst !== 'undefined' ? padAnalyzeObservedShellUst : null
    ),
  });
}

var PadSenseiTheory = padCreateSemanticApi();

if (typeof globalThis !== 'undefined') {
  globalThis.PadSenseiTheory = PadSenseiTheory;
}

if (typeof module !== 'undefined') module.exports = {
  padCreateSemanticApi,
  PadSenseiTheory,
};
