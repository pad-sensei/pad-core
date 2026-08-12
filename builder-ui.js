// ========================================
// PAD-CORE — Builder UI (Shared Components)
// Pure DOM generation + visual state management. No application state reads.
// ========================================

// Node.js: load dependencies (browser: already global via script tag)
if (typeof require !== 'undefined' && typeof BUILDER_QUALITIES === 'undefined') {
  Object.assign(globalThis, require('./data.js'));
  Object.assign(globalThis, require('./theory.js'));
}

// ======== PIANO KEYBOARD ========

function padBuildPianoKeyboard(container, onSelect) {
  if (!container) return { highlight: function() {}, clear: function() {} };
  container.innerHTML = '';

  var whites = [{pc:0,name:'C'},{pc:2,name:'D'},{pc:4,name:'E'},{pc:5,name:'F'},{pc:7,name:'G'},{pc:9,name:'A'},{pc:11,name:'B'}];
  var whiteDiv = document.createElement('div');
  whiteDiv.className = 'piano-white';
  whites.forEach(function(w) {
    var key = document.createElement('div');
    key.className = 'piano-white-key';
    key.dataset.pc = w.pc;
    key.textContent = w.name;
    key.onclick = function() { onSelect(w.pc); };
    whiteDiv.appendChild(key);
  });
  container.appendChild(whiteDiv);

  var blackDiv = document.createElement('div');
  blackDiv.className = 'piano-black-keys';
  var blacks = [
    {pc:1, name:'C#', pos:0},
    {pc:3, name:'D#', pos:1},
    {pc:6, name:'F#', pos:3},
    {pc:8, name:'G#', pos:4},
    {pc:10, name:'A#', pos:5},
  ];
  blacks.forEach(function(b) {
    var key = document.createElement('div');
    key.className = 'piano-black-key';
    key.dataset.pc = b.pc;
    key.textContent = b.name;
    key.style.position = 'absolute';
    key.style.left = 'calc(' + ((b.pos + 1) / 7 * 100) + '% - 18px)';
    key.onclick = function(e) { e.stopPropagation(); onSelect(b.pc); };
    blackDiv.appendChild(key);
  });
  container.appendChild(blackDiv);

  return {
    highlight: function(pc) {
      container.querySelectorAll('.piano-white-key, .piano-black-key').forEach(function(k) {
        k.classList.toggle('selected', parseInt(k.dataset.pc) === pc);
      });
    },
    clear: function() {
      container.querySelectorAll('.selected').forEach(function(k) { k.classList.remove('selected'); });
    },
  };
}

// ======== QUALITY GRID ========

function padBuildQualityGrid(container, onSelect) {
  if (!container) return { highlight: function() {}, clear: function() {} };
  container.innerHTML = '';

  BUILDER_QUALITIES.forEach(function(row) {
    row.forEach(function(q) {
      var btn = document.createElement('button');
      btn.className = 'quality-btn' + (!q ? ' empty' : '');
      if (q) {
        btn.textContent = q.label;
        btn.onclick = function() { onSelect(q); };
      }
      container.appendChild(btn);
    });
  });

  return {
    highlight: function(quality) {
      container.querySelectorAll('.quality-btn').forEach(function(btn) {
        btn.classList.toggle('selected', btn.textContent === quality.label);
      });
    },
    clear: function() {
      container.querySelectorAll('.quality-btn.selected').forEach(function(b) { b.classList.remove('selected'); });
    },
  };
}

// ======== TENSION GRID ========

function padBuildTensionGrid(container, onToggle) {
  if (!container) return { clear: function() {}, getBtns: function() { return []; } };
  container.innerHTML = '';

  var _tensionOrd = 0;
  TENSION_ROWS.forEach(function(row) {
    row.forEach(function(t) {
      if (!t) return;
      var btn = document.createElement('button');
      btn.className = 'tension-btn';
      btn._tension = t;
      btn._tensionOrder = _tensionOrd++;
      btn.textContent = t.label;
      btn.onclick = (function(tension, el) {
        return function() { onToggle(tension, el); };
      })(t, btn);
      container.appendChild(btn);
    });
  });

  return {
    clear: function() {
      container.querySelectorAll('.tension-btn.selected').forEach(function(b) { b.classList.remove('selected'); });
    },
    getBtns: function() {
      return container.querySelectorAll('.tension-btn');
    },
  };
}

// ======== TENSION VISIBILITY (8 Categories A-H) ========
// Pure visibility logic — updates CSS classes on tension buttons.
// Does NOT modify any application state.
// applyTensionFn: (pcs, mods) => sortedPCS — typically padApplyTension

function padUpdateTensionVisibility(btns, quality, applyTensionFn, opts) {
  if (!quality || !btns || btns.length === 0) return;
  var isTriad = quality.pcs.length <= 3;
  var has7th = quality.pcs.indexOf(10) >= 0 || quality.pcs.indexOf(11) >= 0 ||
               (quality.pcs.indexOf(9) >= 0 && quality.pcs.indexOf(6) >= 0);
  var has6th = quality.pcs.indexOf(9) >= 0 && !has7th;

  // Reset
  btns.forEach(function(btn) { btn.classList.remove('quality-hidden'); btn.classList.remove('tension-uncommon'); });

  // Category D: Without 7th, no altered tensions
  if (!has7th) {
    btns.forEach(function(btn) {
      if (!btn._tension) return;
      var m = btn._tension.mods;
      if (m.replace3 !== undefined && !isTriad) { btn.classList.add('quality-hidden'); return; }
      if (m.sharp5 || m.flat5) { btn.classList.add('quality-hidden'); return; }
      if (m.add) {
        for (var i = 0; i < m.add.length; i++) {
          if (m.add[i] === 1 || m.add[i] === 3) { btn.classList.add('quality-hidden'); return; }
        }
      }
      var label = btn._tension.label;
      if (label.indexOf('13') >= 0 && label.indexOf('b13') < 0) { btn.classList.add('quality-hidden'); return; }
    });
  }

  // Category E: With 7th, hide "6" labels (use "13" instead)
  if (has7th) {
    var sixLabels = { '6': 1, '6(9)': 1, '6(9,#11)': 1 };
    btns.forEach(function(btn) {
      if (btn._tension && sixLabels[btn._tension.label]) btn.classList.add('quality-hidden');
    });
  }

  // Category F: sus4 only for dominant 7
  if (has7th) {
    var isDom7F = quality.pcs.indexOf(4) >= 0 && quality.pcs.indexOf(10) >= 0 && quality.pcs.indexOf(11) < 0;
    if (!isDom7F) {
      btns.forEach(function(btn) {
        if (btn._tension && btn._tension.mods.replace3 !== undefined) btn.classList.add('quality-hidden');
      });
    }
  }

  // Category B+C: PCS-based no-op and duplicate detection
  var basePCS = quality.pcs.slice().sort(function(a, b) { return a - b; });
  var baseKey = basePCS.join(',');

  var entries = [];
  btns.forEach(function(btn) {
    if (!btn._tension || btn.classList.contains('quality-hidden')) { entries.push(null); return; }
    var result = applyTensionFn(quality.pcs.slice(), btn._tension.mods);
    var resultKey = result.join(',');
    var m = btn._tension.mods;
    var complexity = 0;
    if (m.add) complexity += m.add.length;
    if (m.sharp5) complexity++;
    if (m.flat5) complexity++;
    if (m.replace3 !== undefined) complexity++;
    if (m.omit5) complexity++;
    if (m.omit3) complexity++;
    if (m.rootless) complexity++;
    entries.push({ btn: btn, resultKey: resultKey, complexity: complexity, isNoOp: resultKey === baseKey });
  });

  var groups = {};
  entries.forEach(function(e) {
    if (!e || e.isNoOp) return;
    if (!groups[e.resultKey]) groups[e.resultKey] = [];
    groups[e.resultKey].push(e.complexity);
  });

  entries.forEach(function(e) {
    if (!e) return;
    if (e.isNoOp) { e.btn.classList.add('quality-hidden'); return; }
    var group = groups[e.resultKey];
    var minComplexity = Math.min.apply(null, group);
    if (group.length > 1 && e.complexity > minComplexity) e.btn.classList.add('quality-hidden');
  });

  // Category G: Dim uncommon tensions for non-dominant 7th chords
  if (has7th) {
    var isDom7G = quality.pcs.indexOf(4) >= 0 && quality.pcs.indexOf(10) >= 0 && quality.pcs.indexOf(11) < 0;
    if (isDom7G) {
      btns.forEach(function(btn) {
        if (!btn._tension || btn.classList.contains('quality-hidden')) return;
        var m = btn._tension.mods;
        if (m.replace3 !== undefined) return;
        // On dominants, hide 5th alterations: aug (#5) duplicates b13, and
        // b5 duplicates #11. Use b13 / #11 (extension tensions) instead.
        if (m.sharp5) { btn.classList.add('quality-hidden'); return; }
        if (m.flat5) { btn.classList.add('quality-hidden'); return; }
        if (m.add && m.add.indexOf(5) >= 0) btn.classList.add('quality-hidden');
      });
    } else {
      var isMinor = quality.pcs.indexOf(3) >= 0;
      var isMaj7E = quality.pcs.indexOf(4) >= 0 && quality.pcs.indexOf(11) >= 0;
      var isDim7 = isMinor && quality.pcs.indexOf(6) >= 0 && quality.pcs.indexOf(9) >= 0 && quality.pcs.indexOf(10) < 0;
      var dim7AvailablePCS = isDim7 ? new Set(padGetDim7AvailableTensionPCs(quality.pcs)) : null;
      var isMM7 = isMinor && quality.pcs.indexOf(11) >= 0;
      btns.forEach(function(btn) {
        if (!btn._tension || btn.classList.contains('quality-hidden')) return;
        var m = btn._tension.mods;
        if (m.replace3 !== undefined) return;
        // maj7 takes only natural tensions (9 / #11 / 13). Altered notes
        // (b9/#9/b13) and 5th alterations (aug=#5, b5) are not maj7 tensions — hide them.
        if (isMaj7E && (m.sharp5 || m.flat5 ||
              (m.add && (m.add.indexOf(1) >= 0 || m.add.indexOf(3) >= 0 || m.add.indexOf(8) >= 0)))) {
          btn.classList.add('quality-hidden'); return;
        }
        // dim7 v1.7: available tensions are exactly +M2 above each chord tone.
        // Chord-tone duplicates are handled as no-ops above; any genuinely added pc
        // outside that set is not an available dim7 tension and stays out of Builder UI.
        if (isDim7 && m.add) {
          var basePcs = new Set(quality.pcs.map(function(pc) { return ((pc % 12) + 12) % 12; }));
          for (var di = 0; di < m.add.length; di++) {
            var dpc = ((m.add[di] % 12) + 12) % 12;
            if (!basePcs.has(dpc) && !dim7AvailablePCS.has(dpc)) {
              btn.classList.add('quality-hidden'); return;
            }
          }
        }
        // dim7: aug (#5) duplicates the b13 pitch and is redundant on a symmetric
        // diminished chord — hide it (b5 is already a chord tone → no-op hidden).
        if (isDim7 && m.sharp5) { btn.classList.add('quality-hidden'); return; }
        if (m.sharp5 || m.flat5) { btn.classList.add('tension-uncommon'); return; }
        if (m.add) {
          if (isMM7 && m.add.indexOf(6) >= 0) { btn.classList.add('quality-hidden'); return; }
          if (isMinor && !isDim7 && m.add.indexOf(8) >= 0) { btn.classList.add('quality-hidden'); return; }
          for (var i = 0; i < m.add.length; i++) {
            if (m.add[i] === 1 || m.add[i] === 3) { btn.classList.add('tension-uncommon'); return; }
            if (m.add[i] === 8 && !isDim7) { btn.classList.add('tension-uncommon'); return; }
            if (m.add[i] === 6 && isMinor) { btn.classList.add('tension-uncommon'); return; }
          }
        }
      });
    }
  }

  // Category G2: 11th avoid on all chords with major 3rd
  if (quality.pcs.indexOf(4) >= 0) {
    btns.forEach(function(btn) {
      if (!btn._tension || btn.classList.contains('quality-hidden')) return;
      var m = btn._tension.mods;
      if (m.replace3 !== undefined) return;
      if (m.add && m.add.indexOf(5) >= 0) btn.classList.add('quality-hidden');
    });
  }

  // Category G3: Minor non-7th + #11 restrictions
  if (quality.pcs.indexOf(3) >= 0 && !has7th) {
    btns.forEach(function(btn) {
      if (!btn._tension || btn.classList.contains('quality-hidden')) return;
      var m = btn._tension.mods;
      if (m.add && m.add.indexOf(6) >= 0) {
        if (m.add.indexOf(9) >= 0 || has6th) {
          btn.classList.add('quality-hidden');
        } else {
          btn.classList.add('tension-uncommon');
        }
      }
    });
  }

  // Category G4: b13 on 6th chords → hide
  if (has6th) {
    btns.forEach(function(btn) {
      if (!btn._tension || btn.classList.contains('quality-hidden')) return;
      var m = btn._tension.mods;
      if (m.add && m.add.indexOf(8) >= 0) btn.classList.add('quality-hidden');
    });
  }

  // Category H: add9 vs 9 context
  if (has7th || has6th) {
    btns.forEach(function(btn) {
      if (btn._tension && btn._tension.label === 'add9') btn.classList.add('quality-hidden');
    });
  } else {
    btns.forEach(function(btn) {
      if (btn._tension && btn._tension.label === '9') btn.classList.add('quality-hidden');
    });
  }

  // Category D2: Triad-specific tension whitelist (64PE extension, safe for MRC)
  if (isTriad && !has7th && !has6th) {
    var isMajOrMin = quality.pcs.indexOf(7) >= 0;
    // Augmented triad (maj3 + #5, no P5): whole-tone tensions = 9, #11.
    var isAugTriad = quality.pcs.indexOf(4) >= 0 && quality.pcs.indexOf(8) >= 0 && quality.pcs.indexOf(7) < 0;
    var allowedLabels = { 'add9': 1 };
    if (isMajOrMin) { allowedLabels['6'] = 1; allowedLabels['6(9)'] = 1; }
    if (isAugTriad) { allowedLabels['#11'] = 1; }

    btns.forEach(function(btn) {
      if (!btn._tension || btn.classList.contains('quality-hidden')) return;
      var m = btn._tension.mods;
      if (m.replace3 !== undefined) {
        if (!isMajOrMin) btn.classList.add('quality-hidden');
        return;
      }
      if (!allowedLabels[btn._tension.label]) btn.classList.add('quality-hidden');
    });
  }

  // Optional callbacks
  if (opts && opts.onTriad) {
    opts.onTriad(isTriad && !has7th && !has6th, quality);
  }
}

// ======== VOICING CONTROLS ========

function padBuildVoicingControls(container, callbacks) {
  if (!container) return { update: function() {} };

  // Expects HTML structure already in container with these IDs:
  // btn-omit5, btn-rootless, btn-omit3, btn-shell137, btn-shell173,
  // btn-shell-ext1, btn-shell-ext2, btn-inv0..3, btn-drop2, btn-drop3
  var el = function(id) { return container.querySelector('#' + id) || document.getElementById(id); };

  if (callbacks.onOmit5) el('btn-omit5')?.addEventListener('click', callbacks.onOmit5);
  if (callbacks.onRootless) el('btn-rootless')?.addEventListener('click', callbacks.onRootless);
  if (callbacks.onOmit3) el('btn-omit3')?.addEventListener('click', callbacks.onOmit3);
  if (callbacks.onShell137) el('btn-shell137')?.addEventListener('click', callbacks.onShell137);
  if (callbacks.onShell173) el('btn-shell173')?.addEventListener('click', callbacks.onShell173);
  if (callbacks.onShellExt1) el('btn-shell-ext1')?.addEventListener('click', callbacks.onShellExt1);
  if (callbacks.onShellExt2) el('btn-shell-ext2')?.addEventListener('click', callbacks.onShellExt2);
  for (var i = 0; i < 4; i++) {
    if (callbacks.onInversion) {
      (function(inv) {
        var b = el('btn-inv' + inv);
        if (b) b.addEventListener('click', function() { callbacks.onInversion(inv); });
      })(i);
    }
  }
  if (callbacks.onDrop2) el('btn-drop2')?.addEventListener('click', callbacks.onDrop2);
  if (callbacks.onDrop3) el('btn-drop3')?.addEventListener('click', callbacks.onDrop3);

  return {
    update: function(voicingState) {
      el('btn-omit5')?.classList.toggle('active', voicingState.omit5);
      el('btn-rootless')?.classList.toggle('active', voicingState.rootless);
      el('btn-omit3')?.classList.toggle('active', voicingState.omit3);
      el('btn-shell137')?.classList.toggle('active', voicingState.shell === '137');
      el('btn-shell173')?.classList.toggle('active', voicingState.shell === '173');
      el('btn-shell-ext1')?.classList.toggle('active', voicingState.shellExtension === 1);
      el('btn-shell-ext2')?.classList.toggle('active', voicingState.shellExtension === 2);
      for (var i = 0; i < 4; i++) {
        el('btn-inv' + i)?.classList.toggle('active', voicingState.inversion === i);
      }
      el('btn-drop2')?.classList.toggle('active', voicingState.drop === 'drop2');
      el('btn-drop3')?.classList.toggle('active', voicingState.drop === 'drop3');
    },
    toggleTriadControls: function(isTriad) {
      var shellBar = el('shell-bar');
      var inv3 = el('btn-inv3');
      var dropBar = el('drop-bar');
      if (shellBar) shellBar.classList.toggle('hidden', isTriad);
      if (inv3) inv3.classList.toggle('hidden', isTriad);
      if (dropBar) dropBar.classList.toggle('hidden', isTriad);
    },
  };
}

// Conditional exports for Node.js (Vitest) — ignored in browser
if (typeof module !== 'undefined') module.exports = {
  padBuildPianoKeyboard, padBuildQualityGrid,
  padBuildTensionGrid, padUpdateTensionVisibility,
  padBuildVoicingControls,
};
