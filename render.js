// ========================================
// PAD-CORE — SVG Rendering (Pure Functions)
// All rendering functions produce SVG elements without reading global state.
// ========================================

// Node.js: load dependencies into global scope (browser: already global via script tag)
if (typeof require !== 'undefined' && typeof GRID === 'undefined') {
  Object.assign(globalThis, require('./data.js'));
  Object.assign(globalThis, require('./theory.js'));
}

// ======== GRID MATH ========

var PAD = GRID;

function padBaseMidi(octaveShift) {
  return PAD.BASE_MIDI + (octaveShift || 0) * 12;
}

function padMidiNote(row, col, octaveShift) {
  return padBaseMidi(octaveShift) + row * PAD.ROW_INTERVAL + col * PAD.COL_INTERVAL;
}

function padNoteName(midi) {
  return NOTE_NAMES_SHARP[padPitchClass(midi)] + (Math.floor(midi / 12) - 2);
}

// ======== DEGREE NAME ========

function padDegreeName(interval, qualityPCS) {
  switch (interval) {
    case 0: return 'R';
    case 1: return 'b9';
    case 2: return '9';
    case 3:
      if (qualityPCS && qualityPCS.includes(4)) return '#9';
      return 'm3';
    case 4: return '3';
    case 5:
      if (qualityPCS && !qualityPCS.includes(3) && !qualityPCS.includes(4)) return '4';
      return '11';
    case 6:
      if (qualityPCS && qualityPCS.includes(6)) return 'b5';
      return '#11';
    case 7: return '5';
    case 8:
      if (qualityPCS && qualityPCS.includes(8)) return '#5';
      return 'b13';
    case 9:
      if (qualityPCS && qualityPCS.includes(3) && qualityPCS.includes(6) &&
          qualityPCS.includes(9) && !qualityPCS.includes(10)) return 'bb7';
      if (qualityPCS && qualityPCS.includes(9) && !qualityPCS.includes(10) && !qualityPCS.includes(11)) return '6';
      return '13';
    case 10: return 'b7';
    case 11: return '\u25B37';
    case 21: return '13';
  }
  return '';
}

// ======== SVG VIEWBOX ========

function padGridViewBox(cols, rows, padSize, padGap, margin) {
  if (cols === undefined) { cols = PAD.COLS; rows = PAD.ROWS; padSize = PAD.PAD_SIZE; padGap = PAD.PAD_GAP; margin = PAD.MARGIN; }
  var w = margin * 2 + cols * (padSize + padGap) - padGap;
  var h = margin * 2 + rows * (padSize + padGap) - padGap;
  return { w: w, h: h };
}

// ======== COMPUTE VOICING BOXES ========

function padComputeBoxes(offsets, targetPC, octaveShift, maxRS, maxCS) {
  var boxes = [];
  var bm = padBaseMidi(octaveShift);
  for (var row = 0; row < PAD.ROWS; row++) {
    for (var col = 0; col < PAD.COLS; col++) {
      var midi = padMidiNote(row, col, octaveShift);
      if (padPitchClass(midi) !== targetPC) continue;
      var allVP = padCalcAllVoicingPositions(row, col, offsets, PAD.ROWS, PAD.COLS, bm, PAD.ROW_INTERVAL);
      if (allVP.length === 0) continue;
      var filtered = maxRS ? allVP.filter(function(vp) {
        var rs = vp.maxRow - vp.minRow + 1, cs = vp.maxCol - vp.minCol + 1;
        return rs <= maxRS && cs <= maxCS;
      }) : allVP;
      if (filtered.length === 0) continue;
      boxes.push({ midi: midi, row: row, col: col, alternatives: filtered });
    }
  }
  boxes.sort(function(a, b) { return a.midi - b.midi; });
  return boxes;
}

// ======== RENDER GRID ========

function padRenderGrid(svg, activePCS, rootPC, bassPC, qualityPCS, octaveShift, selectedBox) {
  var selMidi = selectedBox ? new Set(selectedBox.midiNotes) : null;
  var S = PAD.PAD_SIZE, G = PAD.PAD_GAP, M = PAD.MARGIN;

  for (var row = 0; row < PAD.ROWS; row++) {
    for (var col = 0; col < PAD.COLS; col++) {
      var midi = padMidiNote(row, col, octaveShift);
      var pc = padPitchClass(midi);
      var x = M + col * (S + G);
      var y = M + (PAD.ROWS - 1 - row) * (S + G);
      var interval = ((pc - rootPC) + 12) % 12;
      var isRoot = pc === rootPC;
      var isBass = bassPC !== null && pc === bassPC && pc !== rootPC;
      var isActive = activePCS.has(pc);

      var isGuide3 = [3, 4].some(function(iv) { return (rootPC + iv) % 12 === pc; }) && isActive && !isRoot;
      var isGuide7 = [10, 11].some(function(iv) { return (rootPC + iv) % 12 === pc; }) && isActive && !isRoot;
      var is6thGuide = qualityPCS && qualityPCS.includes(9) &&
        !qualityPCS.includes(10) && !qualityPCS.includes(11) &&
        (rootPC + 9) % 12 === pc && isActive && !isRoot;
      var isGuide = isGuide3 || isGuide7 || is6thGuide;

      var fill = '#2a2a3e', textColor = '#666';
      if (isRoot && isActive) { fill = '#E69F00'; textColor = '#000'; }
      else if (isBass) { fill = '#ff9800'; textColor = '#000'; }
      else if (isGuide3) { fill = '#009E73'; textColor = '#fff'; }
      else if (isGuide7 || is6thGuide) { fill = '#CC79A7'; textColor = '#fff'; }
      else if (isActive) { fill = '#56B4E9'; textColor = '#000'; }

      var isDimmed = selMidi && !selMidi.has(midi) && fill !== '#2a2a3e';

      var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x); rect.setAttribute('y', y);
      rect.setAttribute('width', S); rect.setAttribute('height', S);
      rect.setAttribute('rx', 5); rect.setAttribute('fill', fill);
      rect.setAttribute('stroke', isActive ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.05)');
      rect.setAttribute('stroke-width', isActive ? 1.5 : 0.5);
      if (isDimmed) rect.setAttribute('opacity', '0.3');
      svg.appendChild(rect);

      var showDegree = rootPC !== null && isActive;
      var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x + S / 2);
      text.setAttribute('y', showDegree ? y + 11 : y + S / 2 - 3);
      text.setAttribute('text-anchor', 'middle'); text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', textColor);
      text.setAttribute('font-size', '8px');
      text.setAttribute('font-weight', showDegree ? '600' : '400');
      text.setAttribute('font-family', 'system-ui, sans-serif');
      text.textContent = NOTE_NAMES_SHARP[pc];
      if (isDimmed) text.setAttribute('opacity', '0.3');
      svg.appendChild(text);

      if (showDegree) {
        var degName = padDegreeName(interval, qualityPCS);
        var degText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        degText.setAttribute('x', x + S / 2);
        degText.setAttribute('y', y + 25);
        degText.setAttribute('text-anchor', 'middle'); degText.setAttribute('dominant-baseline', 'middle');
        degText.setAttribute('fill', textColor);
        degText.setAttribute('font-size', '11px'); degText.setAttribute('font-weight', '700');
        degText.setAttribute('font-family', 'system-ui, sans-serif');
        degText.textContent = degName;
        if (isDimmed) degText.setAttribute('opacity', '0.3');
        svg.appendChild(degText);
      }

      var octText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      octText.setAttribute('x', x + S / 2);
      octText.setAttribute('y', showDegree ? y + 38 : y + S / 2 + 9);
      octText.setAttribute('text-anchor', 'middle'); octText.setAttribute('dominant-baseline', 'middle');
      octText.setAttribute('fill', textColor);
      octText.setAttribute('font-size', '7px'); octText.setAttribute('opacity', isDimmed ? '0.15' : '0.5');
      octText.setAttribute('font-family', 'system-ui, sans-serif');
      octText.textContent = padNoteName(midi);
      svg.appendChild(octText);
    }
  }
}

// ======== DRAW VOICING BOXES ========

function padDrawBoxes(svg, boxes, selectedIdx, cycleIndices, octaveShift, onSelect) {
  var S = PAD.PAD_SIZE, G = PAD.PAD_GAP, M = PAD.MARGIN;
  var hasSelection = selectedIdx !== null;
  var bm = padBaseMidi(octaveShift);

  var lastBoxes = boxes.map(function(b, idx) {
    var altIdx = (cycleIndices && cycleIndices[idx]) || 0;
    var safeIdx = altIdx < b.alternatives.length ? altIdx : 0;
    var currentVP = b.alternatives[safeIdx];
    return {
      rootRow: b.row, rootCol: b.col,
      midiNotes: currentVP.positions.map(function(p) { return bm + p.row * PAD.ROW_INTERVAL + p.col; }).sort(function(a, b2) { return a - b2; }),
      alternatives: b.alternatives,
      currentAlt: safeIdx
    };
  });

  var cycleableSet = new Set();
  boxes.forEach(function(b, idx) { if (b.alternatives.length > 1) cycleableSet.add(idx); });

  boxes.forEach(function(b, idx) {
    var sel = selectedIdx === idx;
    if (hasSelection && !sel) return;

    var safeIdx = lastBoxes[idx].currentAlt;
    var vp = b.alternatives[safeIdx];
    var isCycleable = cycleableSet.has(idx);

    var bx = M + vp.minCol * (S + G) - 3;
    var by = M + (PAD.ROWS - 1 - vp.maxRow) * (S + G) - 3;
    var bw = (vp.maxCol - vp.minCol + 1) * (S + G) - G + 6;
    var bh = (vp.maxRow - vp.minRow + 1) * (S + G) - G + 6;
    var boxRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    boxRect.setAttribute('x', bx); boxRect.setAttribute('y', by);
    boxRect.setAttribute('width', bw); boxRect.setAttribute('height', bh);
    boxRect.setAttribute('rx', 6); boxRect.setAttribute('fill', 'none');
    boxRect.setAttribute('stroke', sel ? '#fff' : 'rgba(255,255,255,0.6)');
    boxRect.setAttribute('stroke-width', sel ? 2.5 : 1.5);
    boxRect.setAttribute('stroke-dasharray', '5 3');
    boxRect.setAttribute('opacity', sel ? '1' : '0.7');
    svg.appendChild(boxRect);

    if (sel) {
      vp.positions.forEach(function(pos) {
        var px = M + pos.col * (S + G) - 2;
        var py = M + (PAD.ROWS - 1 - pos.row) * (S + G) - 2;
        var padRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        padRect.setAttribute('x', px); padRect.setAttribute('y', py);
        padRect.setAttribute('width', S + 4); padRect.setAttribute('height', S + 4);
        padRect.setAttribute('rx', 5); padRect.setAttribute('fill', 'none');
        padRect.setAttribute('stroke', '#fff'); padRect.setAttribute('stroke-width', 2);
        svg.appendChild(padRect);
      });
    }

    var bassPos = vp.positions[0];
    var bsz = isCycleable ? 22 : 16;
    var bX = M + bassPos.col * (S + G);
    var bY = M + (PAD.ROWS - 1 - bassPos.row) * (S + G);
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.style.cursor = 'pointer';
    if (onSelect) g.addEventListener('click', (function(i) { return function() { onSelect(i); }; })(idx));

    var br = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    br.setAttribute('x', bX); br.setAttribute('y', bY);
    br.setAttribute('width', bsz); br.setAttribute('height', bsz);
    br.setAttribute('rx', 3);
    br.setAttribute('fill', sel ? '#000' : '#fff');
    br.setAttribute('opacity', '0.9');
    g.appendChild(br);

    var bt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    bt.setAttribute('x', bX + bsz / 2); bt.setAttribute('y', bY + bsz / 2 + 1);
    bt.setAttribute('text-anchor', 'middle'); bt.setAttribute('dominant-baseline', 'middle');
    bt.setAttribute('fill', sel ? '#fff' : '#000');
    bt.setAttribute('font-weight', '800');
    bt.setAttribute('font-family', 'system-ui, sans-serif');
    var boxLetter = String.fromCharCode(65 + idx);
    if (isCycleable && sel) {
      var box = lastBoxes[idx];
      bt.setAttribute('font-size', '9px');
      bt.textContent = boxLetter + (box.currentAlt + 1) + '/' + box.alternatives.length;
    } else {
      bt.setAttribute('font-size', '11px');
      bt.textContent = boxLetter;
    }
    g.appendChild(bt);
    svg.appendChild(g);
  });

  return lastBoxes;
}

// ======== FRETBOARD RENDERING (Guitar / Bass) ========

/**
 * Render a fretboard diagram (guitar or bass) into an SVG element.
 * Pure function — all state passed via opts. No global reads.
 *
 * @param {SVGElement} svg - Target SVG element (will be cleared)
 * @param {Object} opts
 *   Required:
 *     tuning:       number[]  - open string MIDI values, high to low
 *     stringNames:  string[]  - string name labels
 *     rootPC:       number    - root pitch class (0-11)
 *   Optional:
 *     pcsSet:       Set       - active pitch classes (default: empty)
 *     bassPC:       number|null - bass note PC
 *     overlayPCS:   Set|null  - overlay scale PCS
 *     overlayCharPCS: Set|null - characteristic notes in overlay
 *     renderState:  Object    - { guide3PCS, guide7PCS, tensionPCS, avoidPCS, omittedPCS }
 *     positionState: Object   - { enabled, alternatives, currentAlt }
 *     selectedFrets: number[] - per-string selected fret (null = not selected)
 *     labelFn:      function(pc, interval) => string  - custom label function
 *     chordMode:    boolean   - true when in chord mode (enables guide/tension coloring)
 *     solo:         boolean   - solo display mode (larger)
 *     width:        number    - diagram width (default: 564)
 *     isMobile:     boolean
 *     isLandscape:  boolean
 *     padRange:     {lo,hi}|null - MIDI range for pad highlight
 *     colors:       Object    - color palette (default: PAD_INST_COLORS)
 *     onFretClick:  function(stringIdx, fret)|null - click callback
 *     ghostForms:   Array|null - alternative voicing forms for ghost dots
 *     currentFretSet: Set|null - current voicing fret keys (stringIdx*100+fret) for ghost exclusion
 */
function padRenderFretboard(svg, opts) {
  var o = opts || {};
  var tuning = o.tuning;
  var strNames = o.stringNames;
  var numStr = tuning.length;
  var rootPC = o.rootPC != null ? o.rootPC : 0;
  var pcsSet = o.pcsSet || new Set();
  var bassPC = o.bassPC != null ? o.bassPC : null;
  var ovlPCS = o.overlayPCS || null;
  var ovlCharPCS = o.overlayCharPCS || null;
  var rs = o.renderState || {};
  var ps = o.positionState || {};
  var selFrets = o.selectedFrets || null;
  var labelFn = o.labelFn || function(pc, iv) { return SCALE_DEGREE_NAMES[iv]; };
  var chordMode = o.chordMode || false;
  var colorOff = !!o.colorOff;
  var solo = o.solo || false;
  var W = o.width || 564;
  var mobile = o.isMobile || false;
  var landscape = o.isLandscape || false;
  var padRange = o.padRange || null;
  var C = o.colors || PAD_INST_COLORS;
  var onClick = o.onFretClick || null;
  var ghostForms = o.ghostForms || null;
  var curFretSet = o.currentFretSet || null;

  // Derived
  var numFrets = 21;
  var leftM = 16;
  var topM = solo ? 10 : 6;
  var fretW = Math.floor((W - leftM - 12) / numFrets);
  var strH = solo ? (numStr <= 4 ? 28 : 22) : 14;
  var nutX = leftM;
  var maxStrIdx = numStr - 1;
  var H = topM + maxStrIdx * strH + (solo ? 30 : 22);
  var thickFrom = numStr - 2;

  var ivPcsSet = pcsSet.size > 0
    ? new Set(Array.from(pcsSet).map(function(pc) { return ((pc - rootPC) % 12 + 12) % 12; }))
    : null;

  var g3 = rs.guide3PCS || new Set();
  var g7 = rs.guide7PCS || new Set();
  var tp = rs.tensionPCS || new Set();
  var av = rs.avoidPCS || new Set();
  var om = rs.omittedPCS || new Set();
  var posActive = ps.enabled || false;
  var alternatives = ps.alternatives || [];
  var currentAlt = ps.currentAlt || 0;

  var NS = 'http://www.w3.org/2000/svg';

  // Clear
  svg.innerHTML = '';

  // ViewBox
  var vbX = posActive ? -3 : 0;
  svg.setAttribute('viewBox', vbX + ' 0 ' + (W - vbX) + ' ' + H);
  if (mobile || landscape) {
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.style.width = '100%'; svg.style.height = 'auto';
  } else {
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.style.width = ''; svg.style.height = '';
  }

  // --- Nut ---
  var nutLine = document.createElementNS(NS, 'line');
  nutLine.setAttribute('x1', nutX); nutLine.setAttribute('y1', topM);
  nutLine.setAttribute('x2', nutX); nutLine.setAttribute('y2', topM + maxStrIdx * strH);
  nutLine.setAttribute('stroke', '#ccc'); nutLine.setAttribute('stroke-width', 4);
  svg.appendChild(nutLine);

  // --- Fret lines ---
  for (var f = 1; f <= numFrets; f++) {
    var fx = nutX + f * fretW;
    var line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', fx); line.setAttribute('y1', topM);
    line.setAttribute('x2', fx); line.setAttribute('y2', topM + maxStrIdx * strH);
    line.setAttribute('stroke', '#555'); line.setAttribute('stroke-width', 1);
    svg.appendChild(line);
  }

  // --- String lines ---
  for (var s = 0; s < numStr; s++) {
    var sy = topM + s * strH;
    var sLine = document.createElementNS(NS, 'line');
    sLine.setAttribute('x1', nutX); sLine.setAttribute('y1', sy);
    sLine.setAttribute('x2', nutX + numFrets * fretW); sLine.setAttribute('y2', sy);
    sLine.setAttribute('stroke', '#888');
    sLine.setAttribute('stroke-width', s >= thickFrom ? 2 : (numStr <= 4 ? 1.5 : 1));
    svg.appendChild(sLine);
  }

  // --- Fret markers ---
  var markerFrets = [3, 5, 7, 9, 15, 17, 19, 21];
  var doubleMarker = [12];
  var midStr = maxStrIdx / 2;
  markerFrets.forEach(function(mf) {
    var mx = nutX + (mf - 0.5) * fretW;
    var dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', mx); dot.setAttribute('cy', topM + midStr * strH);
    dot.setAttribute('r', 2.5); dot.setAttribute('fill', '#444');
    svg.appendChild(dot);
  });
  doubleMarker.forEach(function(mf) {
    var mx = nutX + (mf - 0.5) * fretW;
    var offsets = numStr <= 4
      ? [topM + 0.5 * strH, topM + (maxStrIdx - 0.5) * strH]
      : [topM + 1.5 * strH, topM + 3.5 * strH];
    offsets.forEach(function(dy) {
      var dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', mx); dot.setAttribute('cy', dy);
      dot.setAttribute('r', 2.5); dot.setAttribute('fill', '#444');
      svg.appendChild(dot);
    });
  });

  // --- String names (with open-string colored circle indicator) ---
  for (var sn = 0; sn < numStr; sn++) {
    var snY = topM + sn * strH;
    var isOpen = posActive && selFrets && selFrets[sn] === 0;
    if (isOpen) {
      var openPC = tuning[sn] % 12;
      var dotColor = colorOff && chordMode ? C.chord
        : openPC === rootPC ? C.root
        : g3.has(openPC) ? C.guide3
        : g7.has(openPC) ? C.guide7
        : tp.has(openPC) ? C.tension
        : C.chord;
      var circ = document.createElementNS(NS, 'circle');
      circ.setAttribute('cx', nutX - 9); circ.setAttribute('cy', snY);
      circ.setAttribute('r', solo ? 9 : 7);
      circ.setAttribute('fill', dotColor);
      svg.appendChild(circ);
    }
    var nameT = document.createElementNS(NS, 'text');
    nameT.setAttribute('x', nutX - 9); nameT.setAttribute('y', snY + 4);
    nameT.setAttribute('text-anchor', 'middle');
    nameT.setAttribute('font-size', '10px');
    nameT.setAttribute('fill', isOpen ? '#fff' : '#aaa');
    nameT.setAttribute('font-weight', '700');
    nameT.textContent = strNames[sn];
    svg.appendChild(nameT);
  }

  // --- Fret numbers ---
  for (var fn = 1; fn <= numFrets; fn++) {
    var fnX = nutX + (fn - 0.5) * fretW;
    var fnT = document.createElementNS(NS, 'text');
    fnT.setAttribute('x', fnX); fnT.setAttribute('y', topM + maxStrIdx * strH + 14);
    fnT.setAttribute('text-anchor', 'middle');
    fnT.setAttribute('font-size', '8px'); fnT.setAttribute('fill', '#888');
    fnT.textContent = fn;
    svg.appendChild(fnT);
  }

  // --- Pad range highlight ---
  if (padRange) {
    for (var pr = 0; pr < numStr; pr++) {
      var prY = topM + pr * strH;
      var minF = null, maxF = null;
      for (var pf = 0; pf <= numFrets; pf++) {
        var midi = tuning[pr] + pf;
        if (midi >= padRange.lo && midi <= padRange.hi) {
          if (minF === null) minF = pf;
          maxF = pf;
        }
      }
      if (minF !== null) {
        var rx1 = minF === 0 ? 0 : nutX + (minF - 1) * fretW;
        var rx2 = nutX + maxF * fretW;
        var rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', rx1);
        rect.setAttribute('y', prY - strH / 2);
        rect.setAttribute('width', rx2 - rx1);
        rect.setAttribute('height', strH);
        rect.setAttribute('fill', C.padRange);
        rect.setAttribute('opacity', '0.1');
        svg.appendChild(rect);
      }
    }
  }

  // --- Note dots ---
  for (var ds = 0; ds < numStr; ds++) {
    var dsOpenPC = tuning[ds] % 12;
    var dsY = topM + ds * strH;
    for (var df = 0; df <= numFrets; df++) {
      var dpc = (dsOpenPC + df) % 12;
      var isBass = bassPC !== null && dpc === bassPC;
      var isOvl = !pcsSet.has(dpc) && !isBass && ovlPCS && ovlPCS.has(dpc);
      if (!pcsSet.has(dpc) && !isBass && !isOvl && !om.has(dpc)) continue;
      var isRoot = dpc === rootPC && !om.has(dpc);
      var isOmitted = om.has(dpc);
      var isGuide3 = chordMode && g3.has(dpc) && !isRoot && !tp.has(dpc);
      var isGuide7 = chordMode && g7.has(dpc) && !isRoot && !tp.has(dpc);
      var isTension = chordMode && tp.has(dpc) && !isRoot && !isGuide3 && !isGuide7;
      var isAvoid = chordMode && av.has(dpc) && !isRoot;
      var dfx = df === 0 ? nutX - 2 : nutX + (df - 0.5) * fretW;
      var dr = df === 0 ? (solo ? 7 : 5) : (solo ? 10 : 7);

      // Position mode: hide frets not in selected form
      if (posActive && selFrets && selFrets[ds] !== df) continue;
      // Position mode: skip fret-0 dot — string name indicator replaces it
      if (posActive && df === 0 && selFrets && selFrets[ds] === 0) continue;

      var ndot = document.createElementNS(NS, 'circle');
      ndot.setAttribute('cx', dfx); ndot.setAttribute('cy', dsY);
      ndot.setAttribute('r', dr);
      var dColor, dTextColor;
      if (isOvl) {
        var isChar = ovlCharPCS && ovlCharPCS.has(dpc);
        ndot.setAttribute('fill', isChar ? C.overlayChar : C.overlay);
        ndot.setAttribute('opacity', isChar ? '0.5' : '0.4');
        dTextColor = C.overlayText;
      } else if (colorOff && chordMode && (isRoot || isBass || isGuide3 || isGuide7 || isAvoid || isTension || pcsSet.has(dpc))) {
        dColor = C.chord; dTextColor = '#000';
        ndot.setAttribute('fill', dColor); ndot.setAttribute('opacity', '0.9');
      } else if (colorOff && !chordMode && isChar) {
        dColor = C.chord; dTextColor = '#000';
        ndot.setAttribute('fill', dColor); ndot.setAttribute('opacity', '0.9');
      } else if (isOmitted) {
        dColor = C.omitted; dTextColor = '#fff';
        ndot.setAttribute('fill', dColor); ndot.setAttribute('opacity', '0.5');
      } else if (isRoot) {
        dColor = C.root; dTextColor = C.rootText;
        ndot.setAttribute('fill', dColor); ndot.setAttribute('opacity', '0.9');
      } else if (isBass) {
        dColor = C.bass; dTextColor = C.bassText;
        ndot.setAttribute('fill', dColor); ndot.setAttribute('opacity', '0.9');
      } else if (isGuide3) {
        dColor = C.guide3; dTextColor = '#fff';
        ndot.setAttribute('fill', dColor); ndot.setAttribute('opacity', '0.9');
      } else if (isGuide7) {
        dColor = C.guide7; dTextColor = '#fff';
        ndot.setAttribute('fill', dColor); ndot.setAttribute('opacity', '0.9');
      } else if (isAvoid) {
        dColor = C.avoid; dTextColor = '#fff';
        ndot.setAttribute('fill', dColor); ndot.setAttribute('opacity', '0.9');
      } else if (isTension) {
        dColor = C.tension; dTextColor = '#fff';
        ndot.setAttribute('fill', dColor); ndot.setAttribute('opacity', '0.9');
      } else {
        dColor = C.chord; dTextColor = '#000';
        ndot.setAttribute('fill', dColor); ndot.setAttribute('opacity', '0.9');
      }
      svg.appendChild(ndot);

      // Label inside dot
      if (df > 0) {
        var div = ((dpc - rootPC) + 12) % 12;
        var labelText = labelFn(dpc, div);
        var lt = document.createElementNS(NS, 'text');
        lt.setAttribute('x', dfx); lt.setAttribute('y', dsY + (solo ? 4 : 3));
        lt.setAttribute('text-anchor', 'middle');
        var lfs = solo ? (labelText.length > 2 ? '7px' : '9px') : (labelText.length > 2 ? '5px' : '6px');
        lt.setAttribute('font-size', lfs);
        lt.setAttribute('fill', dTextColor);
        lt.setAttribute('font-weight', '700');
        lt.textContent = labelText;
        svg.appendChild(lt);
      }
    }
  }

  // --- Ghost alternative forms ---
  if (ghostForms && ghostForms.length > 0 && curFretSet) {
    var altRendered = new Set();
    ghostForms.forEach(function(form) {
      for (var gs = 0; gs < numStr; gs++) {
        if (form.frets[gs] === null) continue;
        var gKey = gs * 100 + form.frets[gs];
        if (curFretSet.has(gKey) || altRendered.has(gKey)) continue;
        altRendered.add(gKey);
        var gf = form.frets[gs];
        var gsy = topM + gs * strH;
        var gfx = gf === 0 ? nutX - 2 : nutX + (gf - 0.5) * fretW;
        var gpc = (tuning[gs] % 12 + gf) % 12;
        var gColor = colorOff && chordMode ? C.chord
          : gpc === rootPC ? C.root
          : g3.has(gpc) ? C.guide3
          : g7.has(gpc) ? C.guide7
          : tp.has(gpc) ? C.tension
          : C.chord;
        var gr = solo ? 7 : 5;
        var gDot = document.createElementNS(NS, 'circle');
        gDot.setAttribute('cx', gfx); gDot.setAttribute('cy', gsy);
        gDot.setAttribute('r', gr);
        gDot.setAttribute('fill', gColor);
        gDot.setAttribute('opacity', '0.25');
        svg.appendChild(gDot);
      }
    });
  }

  // --- Selected fret markers (white ring with label) ---
  if (selFrets) {
    for (var ss = 0; ss < numStr; ss++) {
      if (selFrets[ss] === null) continue;
      var sf = selFrets[ss];
      if (sf === 0 && posActive) continue; // open string handled by string name indicator
      var ssY = topM + ss * strH;
      var sfx = sf === 0 ? nutX - 2 : nutX + (sf - 0.5) * fretW;
      var ring = document.createElementNS(NS, 'circle');
      ring.setAttribute('cx', sfx); ring.setAttribute('cy', ssY);
      ring.setAttribute('r', solo ? 12 : 9);
      ring.setAttribute('fill', '#fff'); ring.setAttribute('opacity', '0.95');
      ring.setAttribute('stroke', '#333'); ring.setAttribute('stroke-width', 2);
      svg.appendChild(ring);
      var spc = (tuning[ss] % 12 + sf) % 12;
      var siv = ((spc - rootPC) + 12) % 12;
      var sLabel = labelFn(spc, siv);
      var slt = document.createElementNS(NS, 'text');
      slt.setAttribute('x', sfx); slt.setAttribute('y', ssY + (solo ? 5 : 4));
      slt.setAttribute('text-anchor', 'middle');
      var slfs = solo ? (sLabel.length > 2 ? '8px' : '10px') : (sLabel.length > 2 ? '6px' : '8px');
      slt.setAttribute('font-size', slfs); slt.setAttribute('fill', '#333');
      slt.setAttribute('font-weight', '700');
      slt.textContent = sLabel;
      svg.appendChild(slt);
    }
  }

  // --- Mute X marks (position mode) ---
  if (posActive && alternatives.length > 0) {
    var form = alternatives[currentAlt < alternatives.length ? currentAlt : 0];
    if (form && form.frets) {
      for (var ms = 0; ms < numStr; ms++) {
        if (form.frets[ms] !== null) continue;
        var msY = topM + ms * strH;
        var mx = nutX + fretW * 0.5;
        var sz = solo ? 6 : 4.5;
        var xl1 = document.createElementNS(NS, 'line');
        xl1.setAttribute('x1', mx - sz); xl1.setAttribute('y1', msY - sz);
        xl1.setAttribute('x2', mx + sz); xl1.setAttribute('y2', msY + sz);
        xl1.setAttribute('stroke', C.mute); xl1.setAttribute('stroke-width', 3);
        svg.appendChild(xl1);
        var xl2 = document.createElementNS(NS, 'line');
        xl2.setAttribute('x1', mx + sz); xl2.setAttribute('y1', msY - sz);
        xl2.setAttribute('x2', mx - sz); xl2.setAttribute('y2', msY + sz);
        xl2.setAttribute('stroke', C.mute); xl2.setAttribute('stroke-width', 3);
        svg.appendChild(xl2);
      }
    }
  }

  // --- Clickable hit areas ---
  if (onClick) {
    for (var hs = 0; hs < numStr; hs++) {
      var hsY = topM + hs * strH - strH / 2;
      for (var hf = 0; hf <= numFrets; hf++) {
        var hfx = hf === 0 ? 0 : nutX + (hf - 1) * fretW;
        var hfw = hf === 0 ? nutX : fretW;
        var hit = document.createElementNS(NS, 'rect');
        hit.setAttribute('x', hfx); hit.setAttribute('y', hsY);
        hit.setAttribute('width', hfw); hit.setAttribute('height', strH);
        hit.setAttribute('fill', 'transparent');
        hit.setAttribute('cursor', 'pointer');
        hit.dataset.string = hs;
        hit.dataset.fret = hf;
        hit.addEventListener('click', function() {
          onClick(parseInt(this.dataset.string), parseInt(this.dataset.fret));
        });
        svg.appendChild(hit);
      }
    }
  }
}

// ======== PIANO RENDERING ========

/**
 * Render a piano keyboard diagram into an SVG element.
 * Pure function — all state passed via opts. No global reads.
 *
 * @param {SVGElement} svg - Target SVG element (will be cleared)
 * @param {Object} opts
 *   Required:
 *     rootPC:       number    - root pitch class (0-11, or -1 for no root)
 *   Optional:
 *     pcsSet:       Set       - active pitch classes (default: empty)
 *     bassPC:       number|null - bass note PC
 *     renderState:  Object    - { guide3PCS, guide7PCS, tensionPCS, avoidPCS, charPCS }
 *     activeMidiSet:Set|null  - when set, only these exact MIDI notes are highlighted
 *     overlayPCS:   Set|null  - overlay scale PCS
 *     overlayCharPCS: Set|null - characteristic notes in overlay
 *     chordMode:    boolean   - true = chord mode (guide tones), false = scale mode (char notes)
 *     numOctaves:   number    - number of octaves to display (default: 4)
 *     startMidi:    number    - MIDI note of leftmost C (default: 48 = C3)
 *     selectedNotes: Set      - MIDI notes with selection markers
 *     solo:         boolean   - solo display mode (larger keys)
 *     width:        number    - diagram width (default: 564)
 *     isMobile:     boolean
 *     isLandscape:  boolean
 *     colors:       Object    - color palette (default: PAD_INST_COLORS)
 *     labelFn:      function(pc, midi) => string  - custom label function
 *     keyColorFn:   function(pc, isWhite, midi) => {fill, textColor, opacity, showLabel} | null
 *                   If provided, overrides default color logic entirely
 *     onKeyClick:   function(midi)|null - click callback
 */
function padRenderPiano(svg, opts) {
  var o = opts || {};
  var rootPC = o.rootPC != null ? o.rootPC : -1;
  var pcsSet = o.pcsSet || new Set();
  var bassPC = o.bassPC != null ? o.bassPC : null;
  var rs = o.renderState || {};
  var ovlPCS = o.overlayPCS || null;
  var ovlCharPCS = o.overlayCharPCS || null;
  var chordMode = o.chordMode || false;
  var colorOff = !!o.colorOff;
  var numOctaves = o.numOctaves || 4;
  var startMidi = o.startMidi != null ? o.startMidi : 48;
  var selectedNotes = o.selectedNotes || new Set();
  var activeMidiSet = o.activeMidiSet || null;
  var solo = o.solo || false;
  var W = o.width || 564;
  var mobile = o.isMobile || false;
  var landscape = o.isLandscape || false;
  var C = o.colors || PAD_INST_COLORS;
  var labelFn = o.labelFn || function(pc) { return SCALE_DEGREE_NAMES[((pc - rootPC) % 12 + 12) % 12]; };
  var keyColorFn = o.keyColorFn || null;
  var onClick = o.onKeyClick || null;

  var guide3 = rs.guide3PCS || new Set();
  var guide7 = rs.guide7PCS || new Set();
  var tp = rs.tensionPCS || new Set();
  var av = rs.avoidPCS || new Set();
  var charPCS = rs.charPCS || new Set();

  // No root when no active notes
  if (pcsSet.size === 0) rootPC = -1;

  var NS = 'http://www.w3.org/2000/svg';
  svg.innerHTML = '';

  // Dimensions
  var whiteH = solo ? 80 : 50;
  var blackH = solo ? 52 : 32;
  var numWhites = numOctaves * 7;
  var startX = 8, startY = 2;
  var whiteW = (W - startX - 15) / numWhites;
  var blackW = whiteW * 0.7;
  var H = whiteH + (solo ? 22 : 16);
  var startOctave = Math.floor(startMidi / 12) - 2;

  // ViewBox
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  if (mobile || landscape) {
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.style.width = '100%'; svg.style.height = 'auto';
  } else {
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.style.width = ''; svg.style.height = '';
  }

  var whiteNotes = [0,2,4,5,7,9,11];
  var blackNotes = [1,3,6,8,10];
  var blackPositions = [0, 1, 3, 4, 5];

  // Default color logic (used when keyColorFn is not provided)
  function defaultKeyColor(pc, isWhite, midi) {
    var inMidiScope = !activeMidiSet || activeMidiSet.has(midi);
    var isActive = inMidiScope && pcsSet.has(pc);
    var isRoot = inMidiScope && rootPC >= 0 && pc === rootPC;
    var isBass = inMidiScope && bassPC !== null && pc === bassPC && !isRoot;
    var isChar = inMidiScope && !chordMode && charPCS.has(pc) && !isRoot;
    var isGuide3 = inMidiScope && chordMode && guide3.has(pc) && !isRoot && !tp.has(pc);
    var isGuide7 = inMidiScope && chordMode && guide7.has(pc) && !isRoot && !tp.has(pc);
    var isTension = inMidiScope && chordMode && tp.has(pc) && !isRoot && !isGuide3 && !isGuide7;
    var isAvoid = inMidiScope && chordMode && av.has(pc) && !isRoot;
    var isOvl = !chordMode && !isActive && !isRoot && !isBass && ovlPCS && ovlPCS.has(pc);
    var isOvlChar = isOvl && ovlCharPCS && ovlCharPCS.has(pc);
    var baseOff = isWhite ? '#eee' : '#222';
    var fill, textColor, opacity = 1;
    if (colorOff && chordMode && (isRoot || isBass || isGuide3 || isGuide7 || isAvoid || isTension || isActive)) {
      fill = isWhite ? (C.pianoChordWhite || '#90CAF9') : (C.pianoChordBlack || '#4A90D9');
      textColor = isWhite ? '#333' : '#fff';
    }
    else if (colorOff && !chordMode && isChar) {
      fill = isWhite ? (C.pianoChordWhite || '#90CAF9') : (C.pianoChordBlack || '#4A90D9');
      textColor = isWhite ? '#333' : '#fff';
    }
    else if (isRoot)     { fill = C.root; textColor = '#fff'; }
    else if (isBass)     { fill = C.bass; textColor = '#000'; }
    else if (isGuide3)   { fill = C.guide3; textColor = '#fff'; }
    else if (isGuide7)   { fill = C.guide7; textColor = '#fff'; }
    else if (isChar)     { fill = C.charNote || C.overlayChar; textColor = '#000'; }
    else if (isAvoid)    { fill = C.avoid; textColor = '#fff'; }
    else if (isTension)  { fill = C.tension; textColor = '#fff'; }
    else if (isActive)   {
      fill = isWhite ? (C.pianoChordWhite || '#90CAF9') : (C.pianoChordBlack || '#4A90D9');
      textColor = isWhite ? '#333' : '#fff';
    }
    else if (isOvlChar)  {
      fill = isWhite ? (C.pianoOverlayCharWhite || '#e8dfa0') : (C.overlayChar || '#F0E442');
      textColor = '#666'; opacity = isWhite ? 1 : 0.6;
    }
    else if (isOvl)      {
      fill = isWhite ? (C.pianoOverlayWhite || '#b8d8ec') : (C.overlay || '#56B4E9');
      textColor = '#666'; opacity = isWhite ? 1 : 0.5;
    }
    else                 { fill = baseOff; textColor = null; }
    var showLabel = isActive || isRoot || isBass || isOvl;
    return { fill: fill, textColor: textColor, opacity: opacity, showLabel: showLabel };
  }

  var colorFn = keyColorFn || defaultKeyColor;

  // --- White keys ---
  var wx = startX;
  for (var oct = 0; oct < numOctaves; oct++) {
    for (var i = 0; i < 7; i++) {
      var pc = whiteNotes[i];
      var midi = startMidi + oct * 12 + pc;
      var k = colorFn(pc, true, midi);
      var rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', wx); rect.setAttribute('y', startY);
      rect.setAttribute('width', whiteW - 1); rect.setAttribute('height', whiteH);
      rect.setAttribute('rx', 1);
      rect.setAttribute('fill', k.fill);
      rect.setAttribute('stroke', '#bbb'); rect.setAttribute('stroke-width', 0.5);
      svg.appendChild(rect);
      if (k.showLabel) {
        var wLabel = document.createElementNS(NS, 'text');
        wLabel.setAttribute('x', wx + (whiteW - 1) / 2); wLabel.setAttribute('y', startY + whiteH - 6);
        wLabel.setAttribute('text-anchor', 'middle');
        wLabel.setAttribute('font-size', '10px');
        wLabel.setAttribute('fill', k.textColor || '#333');
        wLabel.setAttribute('font-weight', '700');
        wLabel.textContent = labelFn(pc, midi);
        svg.appendChild(wLabel);
      }
      wx += whiteW;
    }
  }

  // --- Black keys ---
  for (var boct = 0; boct < numOctaves; boct++) {
    for (var bi = 0; bi < 5; bi++) {
      var bpc = blackNotes[bi];
      var bmidi = startMidi + boct * 12 + bpc;
      var bk = colorFn(bpc, false, bmidi);
      var whiteIdx = blackPositions[bi] + boct * 7;
      var bx = startX + (whiteIdx + 1) * whiteW - blackW / 2;
      var bRect = document.createElementNS(NS, 'rect');
      bRect.setAttribute('x', bx); bRect.setAttribute('y', startY);
      bRect.setAttribute('width', blackW); bRect.setAttribute('height', blackH);
      bRect.setAttribute('rx', 1);
      bRect.setAttribute('fill', bk.fill);
      bRect.setAttribute('stroke', '#000'); bRect.setAttribute('stroke-width', 0.5);
      if (bk.opacity < 1) bRect.setAttribute('opacity', bk.opacity);
      svg.appendChild(bRect);
      if (bk.showLabel) {
        var bLabel = document.createElementNS(NS, 'text');
        bLabel.setAttribute('x', bx + blackW / 2); bLabel.setAttribute('y', startY + blackH - 3);
        bLabel.setAttribute('text-anchor', 'middle');
        bLabel.setAttribute('font-size', '8px'); bLabel.setAttribute('fill', bk.textColor || '#fff');
        bLabel.setAttribute('font-weight', '700');
        bLabel.textContent = labelFn(bpc, bmidi);
        svg.appendChild(bLabel);
      }
    }
  }

  // --- Selected note markers (white ring) ---
  var whitePC = [0,2,4,5,7,9,11];
  var pcToWhiteIdx = [0,0,1,1,2,3,3,4,4,5,5,6];
  var pcToBlackIdx = [0,0,1,0,0,0,2,0,3,0,4,0];
  for (var soct = 0; soct < numOctaves; soct++) {
    for (var si = 0; si < 12; si++) {
      var smidi = startMidi + soct * 12 + si;
      if (!selectedNotes.has(smidi)) continue;
      var sIsWhite = whitePC.indexOf(si) !== -1;
      var scx, scy;
      if (sIsWhite) {
        scx = startX + (soct * 7 + pcToWhiteIdx[si]) * whiteW + (whiteW - 1) / 2;
        scy = startY + whiteH - 12;
      } else {
        var sbPos = blackPositions[pcToBlackIdx[si]] + soct * 7;
        scx = startX + (sbPos + 1) * whiteW;
        scy = startY + blackH - 10;
      }
      var marker = document.createElementNS(NS, 'circle');
      marker.setAttribute('cx', scx); marker.setAttribute('cy', scy);
      marker.setAttribute('r', 5);
      marker.setAttribute('fill', '#fff');
      marker.setAttribute('stroke', '#333'); marker.setAttribute('stroke-width', 1.5);
      svg.appendChild(marker);
      var mLabel = document.createElementNS(NS, 'text');
      mLabel.setAttribute('x', scx); mLabel.setAttribute('y', scy + 3);
      mLabel.setAttribute('text-anchor', 'middle');
      mLabel.setAttribute('font-size', '6px'); mLabel.setAttribute('fill', '#333');
      mLabel.setAttribute('font-weight', '700');
      mLabel.textContent = NOTE_NAMES_SHARP[si];
      svg.appendChild(mLabel);
    }
  }

  // --- Click handlers (white keys — below black key area) ---
  if (onClick) {
    for (var coct = 0; coct < numOctaves; coct++) {
      for (var ci = 0; ci < 7; ci++) {
        var cpc = whiteNotes[ci];
        var cmidi = startMidi + coct * 12 + cpc;
        var ckx = startX + (coct * 7 + ci) * whiteW;
        var cHit = document.createElementNS(NS, 'rect');
        cHit.setAttribute('x', ckx); cHit.setAttribute('y', startY + blackH);
        cHit.setAttribute('width', whiteW); cHit.setAttribute('height', whiteH - blackH);
        cHit.setAttribute('fill', 'transparent'); cHit.setAttribute('cursor', 'pointer');
        cHit.dataset.midi = cmidi;
        cHit.addEventListener('click', function() { onClick(parseInt(this.dataset.midi)); });
        svg.appendChild(cHit);
      }
    }
    // Black keys on top
    for (var cboct = 0; cboct < numOctaves; cboct++) {
      for (var cbi = 0; cbi < 5; cbi++) {
        var cbpc = blackNotes[cbi];
        var cbmidi = startMidi + cboct * 12 + cbpc;
        var cbWhiteIdx = blackPositions[cbi] + cboct * 7;
        var cbx = startX + (cbWhiteIdx + 1) * whiteW - blackW / 2;
        var cbHit = document.createElementNS(NS, 'rect');
        cbHit.setAttribute('x', cbx); cbHit.setAttribute('y', startY);
        cbHit.setAttribute('width', blackW); cbHit.setAttribute('height', blackH);
        cbHit.setAttribute('fill', 'transparent'); cbHit.setAttribute('cursor', 'pointer');
        cbHit.dataset.midi = cbmidi;
        cbHit.addEventListener('click', function() { onClick(parseInt(this.dataset.midi)); });
        svg.appendChild(cbHit);
      }
    }
  }

  // --- Octave labels ---
  for (var lo = 0; lo < numOctaves; lo++) {
    var lox = startX + lo * 7 * whiteW;
    var lt = document.createElementNS(NS, 'text');
    lt.setAttribute('x', lox + 2); lt.setAttribute('y', startY + whiteH + 11);
    lt.setAttribute('font-size', '8px'); lt.setAttribute('fill', '#888');
    lt.textContent = 'C' + (startOctave + lo);
    svg.appendChild(lt);
  }
}

// ======== STAFF NOTATION HELPERS ========

var PAD_DIATONIC_SEMITONES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
var PAD_LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
var PAD_PC_TO_DIA_SHARP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
var PAD_PC_TO_DIA_FLAT  = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];

function padMidiToStaffPos(midi, flats) {
  var octave = Math.floor(midi / 12) - 1;
  var pc = midi % 12;
  if (flats) {
    var p =      [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
    var isFlat = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0][pc];
    return { pos: (octave - 4) * 7 + p[pc], accidental: isFlat ? 'flat' : null };
  }
  var pcToPos = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  var isSharp = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0][pc];
  return { pos: (octave - 4) * 7 + pcToPos[pc], accidental: isSharp ? 'sharp' : null };
}

function padDegreeToDiatonicOffset(degName) {
  if (degName === 'R') return 0;
  if (degName === 'b9' || degName === '9' || degName === '2' || degName === '#9') return 1;
  if (degName === 'm3' || degName === '3') return 2;
  if (degName === '4' || degName === '11' || degName === '#11') return 3;
  if (degName === 'b5' || degName === '5' || degName === '#5') return 4;
  if (degName === 'b13' || degName === '6' || degName === '13') return 5;
  if (degName === 'b7' || degName === '\u25B37') return 6;
  return null;
}

function padDegreeAwareStaffPos(midi, rootPC, degName, defaultFlats) {
  var diaOffset = padDegreeToDiatonicOffset(degName);
  if (diaOffset === null) return padMidiToStaffPos(midi, defaultFlats);
  var rootDia = defaultFlats ? PAD_PC_TO_DIA_FLAT[rootPC] : PAD_PC_TO_DIA_SHARP[rootPC];
  var targetDia = (rootDia + diaOffset) % 7;
  var targetSemitone = PAD_DIATONIC_SEMITONES[targetDia];
  var midiOctave = Math.floor(midi / 12) - 1;
  var bestOctave = midiOctave, minDiff = Infinity;
  for (var o = midiOctave - 1; o <= midiOctave + 1; o++) {
    var diff = Math.abs(midi - ((o + 1) * 12 + targetSemitone));
    if (diff < minDiff) { minDiff = diff; bestOctave = o; }
  }
  var pos = (bestOctave - 4) * 7 + targetDia;
  var accVal = midi - ((bestOctave + 1) * 12 + targetSemitone);
  if (accVal > 1 || accVal < -1) return padMidiToStaffPos(midi, defaultFlats);
  var accStr = accVal === 1 ? 'sharp' : accVal === -1 ? 'flat' : null;
  var noteName = PAD_LETTER_NAMES[targetDia] + (accVal === 1 ? '#' : accVal === -1 ? 'b' : '');
  return { pos: pos, accidental: accStr, noteName: noteName };
}

// ======== STAFF NOTATION RENDERER ========

function padRenderStaff(svg, opts) {
  var o = opts || {};
  var midiNotes = o.midiNotes || [];
  var rootPC = o.rootPC != null ? o.rootPC : -1;
  var defaultFlats = o.defaultFlats || false;
  var W = o.width || 564;
  var mobile = o.isMobile || false;
  var landscape = o.isLandscape || false;
  var C = o.colors || PAD_INST_COLORS;
  // noteInfoFn(midi, pc, interval) → { degName, staffRootPC?, useFlats?, noteName? }
  var noteInfoFn = o.noteInfoFn || null;

  var NS = 'http://www.w3.org/2000/svg';
  var staffLineGap = 8;
  var trebleTop = 20;
  var bassTop = trebleTop + 4 * staffLineGap + 30;
  var totalH = bassTop + 4 * staffLineGap + 30;

  svg.style.display = '';
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + totalH);
  if (mobile || landscape) {
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.style.width = '100%'; svg.style.height = 'auto';
  } else {
    svg.setAttribute('width', W);
    svg.setAttribute('height', totalH);
    svg.style.width = ''; svg.style.height = '';
  }
  svg.innerHTML = '';

  // Draw staff lines
  var staffLeft = 40, staffRight = W - 20;
  for (var i = 0; i < 5; i++) {
    var ty = trebleTop + i * staffLineGap;
    var tl = document.createElementNS(NS, 'line');
    tl.setAttribute('x1', staffLeft); tl.setAttribute('y1', ty);
    tl.setAttribute('x2', staffRight); tl.setAttribute('y2', ty);
    tl.setAttribute('stroke', '#666'); tl.setAttribute('stroke-width', 1);
    svg.appendChild(tl);
    var by = bassTop + i * staffLineGap;
    var bl = document.createElementNS(NS, 'line');
    bl.setAttribute('x1', staffLeft); bl.setAttribute('y1', by);
    bl.setAttribute('x2', staffRight); bl.setAttribute('y2', by);
    bl.setAttribute('stroke', '#666'); bl.setAttribute('stroke-width', 1);
    svg.appendChild(bl);
  }

  // Clef labels
  var trebleClef = document.createElementNS(NS, 'text');
  trebleClef.setAttribute('x', 14); trebleClef.setAttribute('y', trebleTop + 28);
  trebleClef.setAttribute('font-size', '36px'); trebleClef.setAttribute('fill', '#999');
  trebleClef.textContent = '\uD834\uDD1E';
  svg.appendChild(trebleClef);
  var bassClefEl = document.createElementNS(NS, 'text');
  bassClefEl.setAttribute('x', 14); bassClefEl.setAttribute('y', bassTop + 16);
  bassClefEl.setAttribute('font-size', '24px'); bassClefEl.setAttribute('fill', '#999');
  bassClefEl.textContent = '\uD834\uDD22';
  svg.appendChild(bassClefEl);

  // Staff pos 0 = C4 (middle C). Y coords:
  var middleCY = trebleTop + 5 * staffLineGap;
  function posToY(pos) {
    return middleCY - pos * (staffLineGap / 2);
  }

  // Draw notes
  var noteX = staffLeft + 80;
  var noteSpacing = 50;

  for (var idx = 0; idx < midiNotes.length; idx++) {
    var midi = midiNotes[idx];
    var pc = midi % 12;
    var interval = ((pc - rootPC) % 12 + 12) % 12;

    var useFlats = defaultFlats;
    var degName = SCALE_DEGREE_NAMES[interval];
    var staffResult;
    var degreeNoteName = null;

    if (noteInfoFn) {
      var info = noteInfoFn(midi, pc, interval);
      degName = info.degName || degName;
      if (info.staffRootPC != null) {
        staffResult = padDegreeAwareStaffPos(midi, info.staffRootPC, degName, defaultFlats);
        degreeNoteName = staffResult.noteName || null;
      } else {
        if (info.useFlats != null) useFlats = info.useFlats;
        staffResult = padMidiToStaffPos(midi, useFlats);
      }
      if (info.noteName) degreeNoteName = info.noteName;
    } else {
      staffResult = padMidiToStaffPos(midi, useFlats);
    }

    var pos = staffResult.pos;
    var accidental = staffResult.accidental;
    var ny = posToY(pos);
    var nx = noteX + idx * noteSpacing;

    // Ledger lines — between staves (middle C area)
    if (pos <= 0) {
      for (var lp = 0; lp >= pos; lp -= 2) {
        var ly = posToY(lp);
        if (ly > trebleTop + 4 * staffLineGap && ly < bassTop) {
          var ll = document.createElementNS(NS, 'line');
          ll.setAttribute('x1', nx - 10); ll.setAttribute('y1', ly);
          ll.setAttribute('x2', nx + 10); ll.setAttribute('y2', ly);
          ll.setAttribute('stroke', '#666'); ll.setAttribute('stroke-width', 1);
          svg.appendChild(ll);
        }
      }
    }
    // Above treble
    if (pos >= 12) {
      for (var lp2 = 12; lp2 <= pos; lp2 += 2) {
        var ly2 = posToY(lp2);
        if (ly2 < trebleTop) {
          var ll2 = document.createElementNS(NS, 'line');
          ll2.setAttribute('x1', nx - 10); ll2.setAttribute('y1', ly2);
          ll2.setAttribute('x2', nx + 10); ll2.setAttribute('y2', ly2);
          ll2.setAttribute('stroke', '#666'); ll2.setAttribute('stroke-width', 1);
          svg.appendChild(ll2);
        }
      }
    }
    // Below bass staff
    if (pos <= -7) {
      for (var lp3 = -7; lp3 >= pos; lp3 -= 2) {
        var ly3 = posToY(lp3);
        if (ly3 > bassTop + 4 * staffLineGap) {
          var ll3 = document.createElementNS(NS, 'line');
          ll3.setAttribute('x1', nx - 10); ll3.setAttribute('y1', ly3);
          ll3.setAttribute('x2', nx + 10); ll3.setAttribute('y2', ly3);
          ll3.setAttribute('stroke', '#666'); ll3.setAttribute('stroke-width', 1);
          svg.appendChild(ll3);
        }
      }
    }

    // Note head
    var noteEl = document.createElementNS(NS, 'ellipse');
    noteEl.setAttribute('cx', nx); noteEl.setAttribute('cy', ny);
    noteEl.setAttribute('rx', 5); noteEl.setAttribute('ry', 3.5);
    noteEl.setAttribute('fill', '#fff');
    noteEl.setAttribute('transform', 'rotate(-15 ' + nx + ' ' + ny + ')');
    svg.appendChild(noteEl);

    // Accidental
    if (accidental) {
      var sh = document.createElementNS(NS, 'text');
      sh.setAttribute('x', nx - 12); sh.setAttribute('y', ny + 4);
      sh.setAttribute('font-size', '12px'); sh.setAttribute('fill', '#ff9800');
      sh.textContent = accidental === 'sharp' ? '\u266F' : '\u266D';
      svg.appendChild(sh);
    }

    // Degree label above note
    var degEl = document.createElementNS(NS, 'text');
    degEl.setAttribute('x', nx); degEl.setAttribute('y', ny - 10);
    degEl.setAttribute('text-anchor', 'middle');
    degEl.setAttribute('font-size', '9px'); degEl.setAttribute('font-weight', '600');
    degEl.setAttribute('fill', interval === 0 ? (C.root || '#E69F00') : '#aaa');
    degEl.textContent = degName;
    svg.appendChild(degEl);

    // Note name label below
    var nameEl = document.createElementNS(NS, 'text');
    nameEl.setAttribute('x', nx); nameEl.setAttribute('y', totalH - 4);
    nameEl.setAttribute('text-anchor', 'middle');
    nameEl.setAttribute('font-size', '9px'); nameEl.setAttribute('fill', '#999');
    nameEl.textContent = degreeNoteName || (useFlats ? NOTE_NAMES_FLAT[pc] : NOTE_NAMES_SHARP[pc]);
    svg.appendChild(nameEl);
  }
}

// ======== RENDER STATE COMPUTATION ========

function padComputeRenderState(opts) {
  var o = opts || {};
  var mode = o.mode || 'chord';
  var key = o.key || 0;
  var scaleIdx = o.scaleIdx || 0;
  var builderRoot = o.builderRoot != null ? o.builderRoot : null;
  var qualityPCS = o.qualityPCS || null;
  var builderPCS = o.builderPCS || null;
  var chordName = o.chordName || '';
  var builderBass = o.builderBass != null ? o.builderBass : null;
  var inputNotes = o.inputNotes || [];
  var instrumentNotes = o.instrumentNotes || [];
  var detectChordFn = o.detectChordFn || null;
  var voicing = o.voicing || {};
  var tasty = o.tasty || {};
  var extNotes = o.extNotes || [];
  var selectedPS = o.selectedPS || null;
  var noRootLabel = o.noRootLabel || '...';

  // C-fixed mode (urinami "Pad OS" philosophy, 2026-04-14):
  // Scale mode の pad/LED だけを C Major に固定する override を state に埋め込む。
  // Chord mode でこれを適用すると Cm7(9) などのスケール外コード音が消えるため、
  // コード表示は常にコード音を優先する。
  // staff/guitar/bass/piano/info などは通常どおり key 連動で描画させるため、
  // early return ではなく state.padOverride として分離する。
  // Codex P1 fix (2026-04-14): 早期 return だと共有 render state を壊すので、
  // 呼び出し側（renderPads / updateLaunchpadLEDs）が padOverride を見る設計に。
  var _padOverride = (o.cFixed && mode === 'scale') ? {
    activePCS: new Set([0, 2, 4, 5, 7, 9, 11]),
    rootPC: 0,
    bassPC: null,
    omittedPCS: new Set(),
    guide3PCS: new Set(),
    guide7PCS: new Set(),
    tensionPCS: new Set(),
    qualityPCS: null,
    charPCS: new Set([11]),
  } : null;

  var activePCS, activeLabel, rootPC, bassPC = null;
  var charPCS = new Set();
  var omittedPCS = new Set();
  var guide3PCS = new Set();
  var guide7PCS = new Set();
  var tensionPCS = new Set();
  var avoidPCS = new Set();

  if (mode === 'input') {
    var notes = inputNotes.slice();
    activePCS = new Set(notes.map(function(n) { return n % 12; }));
    if (instrumentNotes.length > 0) {
      var merged = new Set(instrumentNotes.concat(notes));
      notes = Array.from(merged).sort(function(a, b) { return a - b; });
      instrumentNotes.forEach(function(n) { activePCS.add(n % 12); });
    }
    rootPC = null;
    if (notes.length >= 2 && detectChordFn) {
      var candidates = detectChordFn(notes);
      if (candidates.length > 0) rootPC = candidates[0].rootPC;
    }
    activeLabel = '';
    return { activePCS: activePCS, activeLabel: activeLabel, rootPC: rootPC, bassPC: bassPC,
      charPCS: charPCS, omittedPCS: omittedPCS, guide3PCS: guide3PCS, guide7PCS: guide7PCS,
      tensionPCS: tensionPCS, qualityPCS: qualityPCS, avoidPCS: avoidPCS };
  } else if (mode === 'scale') {
    var scale = SCALES[scaleIdx];
    activePCS = new Set(scale.pcs.map(function(pc) { return (pc + key) % 12; }));
    rootPC = key;
    activeLabel = padPcName(key, scaleIdx, key) + ' ' + scale.name;
    if (scale.cn && scale.cn.length > 0) {
      charPCS = new Set(scale.cn.map(function(pc) { return (pc + key) % 12; }));
    }
  } else {
    rootPC = builderRoot !== null ? builderRoot : 0;
    qualityPCS = qualityPCS;
    if (builderPCS) {
      activePCS = new Set(builderPCS.map(function(pc) { return (pc + rootPC) % 12; }));
      builderPCS.filter(function(pc) { return pc >= 12; }).forEach(function(pc) {
        tensionPCS.add((pc + rootPC) % 12);
      });
      if (qualityPCS) {
        var qualityIvSet = new Set(qualityPCS.map(function(pc) { return pc % 12; }));
        builderPCS.forEach(function(pc) {
          var iv = pc % 12;
          if (iv !== 0 && !qualityIvSet.has(iv)) tensionPCS.add((pc + rootPC) % 12);
        });
      }
      activeLabel = chordName;
      if (builderBass !== null) bassPC = builderBass;
      // Voicing modifications
      var p5 = (rootPC + 7) % 12;
      var p3maj = (rootPC + 4) % 12;
      var p3min = (rootPC + 3) % 12;
      if (voicing.omit5 && activePCS.has(p5)) {
        activePCS.delete(p5); omittedPCS.add(p5);
      }
      if (voicing.rootless && activePCS.has(rootPC)) {
        activePCS.delete(rootPC); omittedPCS.add(rootPC);
      }
      if (voicing.omit3) {
        if (activePCS.has(p3maj)) { activePCS.delete(p3maj); omittedPCS.add(p3maj); }
        if (activePCS.has(p3min)) { activePCS.delete(p3min); omittedPCS.add(p3min); }
      }
      // Shell voicing
      if (voicing.shell) {
        var shellIntervals = new Set([0]);
        [3, 4].forEach(function(iv) { shellIntervals.add(iv); });
        [10, 11].forEach(function(iv) { shellIntervals.add(iv); });
        if (qualityPCS && qualityPCS.includes(9) && !qualityPCS.includes(10) && !qualityPCS.includes(11)) {
          shellIntervals.add(9);
        }
        Array.from(activePCS).forEach(function(pc) {
          var iv = ((pc - rootPC) + 12) % 12;
          if (!shellIntervals.has(iv) && !tensionPCS.has(pc)) {
            activePCS.delete(pc); omittedPCS.add(pc);
          }
        });
      }
      // Guide tones
      [3, 4].forEach(function(iv) { var pc = (rootPC + iv) % 12; if (activePCS.has(pc) && !tensionPCS.has(pc)) guide3PCS.add(pc); });
      [10, 11].forEach(function(iv) { var pc = (rootPC + iv) % 12; if (activePCS.has(pc) && !tensionPCS.has(pc)) guide7PCS.add(pc); });
      if (qualityPCS && qualityPCS.includes(9) && !qualityPCS.includes(10) && !qualityPCS.includes(11)) {
        var pc6 = (rootPC + 9) % 12; if (activePCS.has(pc6) && !tensionPCS.has(pc6)) guide7PCS.add(pc6);
      }
    } else {
      activePCS = new Set();
      activeLabel = builderRoot !== null ? padPcName(builderRoot, scaleIdx, key) + '...' : noRootLabel;
    }
  }

  // Tasty voicing override
  var tastyMidiSet = null;
  var tastyDegreeMap = null;
  var tastyTopMidi = null;
  if (mode === 'chord' && tasty.enabled && tasty.midiNotes && tasty.midiNotes.length > 0) {
    tastyDegreeMap = tasty.degreeMap || {};
    tastyMidiSet = new Set(tasty.midiNotes);
    tastyTopMidi = tasty.topNote;
    activePCS = new Set(tasty.midiNotes.map(function(m) { return m % 12; }));
    guide3PCS = new Set(); guide7PCS = new Set(); tensionPCS = new Set();
    omittedPCS = new Set();
    for (var ti = 0; ti < tasty.midiNotes.length; ti++) {
      var tm = tasty.midiNotes[ti];
      var td = tastyDegreeMap[tm];
      var tpc = tm % 12;
      if (!td) continue;
      if (td === '3' || td === 'b3') guide3PCS.add(tpc);
      else if (td === '7' || td === 'b7' || td === '6') guide7PCS.add(tpc);
      else if (td !== '1' && td !== '5' && td !== 'b5' && td !== '#5') tensionPCS.add(tpc);
    }
  }

  // Stock voicing override (same rendering as TASTY — mutually exclusive)
  var stock = opts.stock || {};
  if (mode === 'chord' && !tastyMidiSet && stock.enabled && stock.midiNotes && stock.midiNotes.length > 0) {
    tastyDegreeMap = stock.degreeMap || {};
    tastyMidiSet = new Set(stock.midiNotes);
    tastyTopMidi = stock.topNote;
    activePCS = new Set(stock.midiNotes.map(function(m) { return m % 12; }));
    guide3PCS = new Set(); guide7PCS = new Set(); tensionPCS = new Set();
    omittedPCS = new Set();
    for (var si = 0; si < stock.midiNotes.length; si++) {
      var sm = stock.midiNotes[si];
      var sd = tastyDegreeMap[sm];
      var spc = sm % 12;
      if (!sd) continue;
      if (sd === '3' || sd === 'b3') guide3PCS.add(spc);
      else if (sd === '7' || sd === 'b7' || sd === '6') guide7PCS.add(spc);
      else if (sd !== '1' && sd !== '5' && sd !== 'b5' && sd !== '#5') tensionPCS.add(spc);
    }
  }

  // Compact pad positions (TASTY or Stock)
  var tastyPadPositions = null;
  if (tastyMidiSet && tasty.padPositions && tasty.padPositions.length > 0) {
    tastyPadPositions = tasty.padPositions;
  } else if (tastyMidiSet && stock.padPositions && stock.padPositions.length > 0) {
    tastyPadPositions = stock.padPositions;
  }

  // ExtNotes override
  if (mode === 'chord' && !tastyMidiSet && extNotes.length > 0) {
    activePCS = new Set(extNotes.map(function(n) { return n % 12; }));
    if (detectChordFn) {
      var detected = detectChordFn(extNotes);
      if (detected.length > 0) {
        rootPC = detected[0].rootPC;
        activeLabel = detected[0].name;
      } else if (extNotes.length > 0) {
        rootPC = extNotes[0] % 12;
        activeLabel = Array.from(activePCS).map(function(pc) { return NOTE_NAMES_SHARP[pc]; }).join(' ');
      }
    }
    guide3PCS = new Set(); guide7PCS = new Set(); tensionPCS = new Set();
    omittedPCS = new Set(); charPCS = new Set();
    [3, 4].forEach(function(iv) { var pc = (rootPC + iv) % 12; if (activePCS.has(pc)) guide3PCS.add(pc); });
    [10, 11].forEach(function(iv) { var pc = (rootPC + iv) % 12; if (activePCS.has(pc)) guide7PCS.add(pc); });
  }

  // Avoid notes
  avoidPCS = new Set();
  if (mode === 'chord' && tensionPCS.size > 0) {
    var baseTones = new Set(Array.from(activePCS).filter(function(pc) { return !tensionPCS.has(pc); }));
    omittedPCS.forEach(function(pc) { baseTones.add(pc); });
    tensionPCS.forEach(function(tpc) {
      var below = (tpc - 1 + 12) % 12;
      if (baseTones.has(below)) avoidPCS.add(tpc);
    });
  }

  // Interval-based PCS
  var activeIvPCS = (mode === 'chord' && activePCS && activePCS.size > 0)
    ? new Set(Array.from(activePCS).map(function(pc) { return ((pc - rootPC) % 12 + 12) % 12; }))
    : null;

  // Scale overlay
  var overlayPCS = null, overlayCharPCS = new Set();
  if (mode === 'chord' && selectedPS) {
    var ovlScale = SCALES[selectedPS.scaleIdx];
    overlayPCS = new Set(ovlScale.pcs.map(function(iv) { return (iv + rootPC) % 12; }));
    if (ovlScale.cn && ovlScale.cn.length > 0) {
      overlayCharPCS = new Set(ovlScale.cn.map(function(iv) { return (iv + rootPC) % 12; }));
    }
  }

  return {
    activePCS: activePCS, activeIvPCS: activeIvPCS, activeLabel: activeLabel,
    rootPC: rootPC, bassPC: bassPC, charPCS: charPCS, omittedPCS: omittedPCS,
    guide3PCS: guide3PCS, guide7PCS: guide7PCS, tensionPCS: tensionPCS,
    qualityPCS: qualityPCS, avoidPCS: avoidPCS,
    overlayPCS: overlayPCS, overlayCharPCS: overlayCharPCS,
    tastyMidiSet: tastyMidiSet, tastyDegreeMap: tastyDegreeMap, tastyTopMidi: tastyTopMidi,
    tastyPadPositions: tastyPadPositions,
    padOverride: _padOverride  // C-fixed mode: applied only on pad + LED, not on staff/guitar/etc
  };
}

// Scale-only state for PUSH/Launchpad LED (urinami 2026-04-14):
// PUSH is an instrument surface; it should always display only the current
// scale, never chord/tasty/stock/builder overlays. Callers pass the full
// state and the current key/scaleIdx; a C-Major state is returned when
// padCFixed is on, otherwise the key-linked scale.
function padApplyScaleOnlyOverride(state, key, scaleIdx, cFixed) {
  var effKey = cFixed ? 0 : (typeof key === 'number' ? key : 0);
  var effIdx = cFixed ? 0 : (typeof scaleIdx === 'number' ? scaleIdx : 0);
  var scale = SCALES[effIdx];
  if (!scale || scale.pcs.length !== 7) return state;
  return Object.assign({}, state || {}, {
    activePCS: new Set(scale.pcs.map(function(pc) { return (pc + effKey) % 12; })),
    rootPC: effKey,
    bassPC: null,
    omittedPCS: new Set(),
    guide3PCS: new Set(),
    guide7PCS: new Set(),
    tensionPCS: new Set(),
    qualityPCS: null,
    charPCS: scale.cn ? new Set(scale.cn.map(function(pc) { return (pc + effKey) % 12; })) : new Set(),
    activeIvPCS: null,
    overlayPCS: null,
    overlayCharPCS: null,
    tastyMidiSet: null,
    tastyDegreeMap: null,
    tastyTopMidi: null,
    tastyPadPositions: null,
    avoidPCS: new Set()
  });
}

// Helper for pad consumers (SVG pad surface): return a state where
// activePCS/rootPC etc are swapped to C Major if padOverride is set.
// Staff/guitar/piano/info use the raw state instead.
function padApplyPadOverride(state) {
  if (!state || !state.padOverride) return state;
  var o = state.padOverride;
  return Object.assign({}, state, {
    activePCS: o.activePCS,
    rootPC: o.rootPC,
    bassPC: o.bassPC,
    omittedPCS: o.omittedPCS,
    guide3PCS: o.guide3PCS,
    guide7PCS: o.guide7PCS,
    tensionPCS: o.tensionPCS,
    qualityPCS: o.qualityPCS,
    charPCS: o.charPCS,
    // Clear chord-specific overlays so Pad shows only the C Major scale surface
    activeIvPCS: null,
    overlayPCS: null,
    overlayCharPCS: null,
    tastyMidiSet: null,
    tastyDegreeMap: null,
    tastyTopMidi: null,
    tastyPadPositions: null,
    avoidPCS: new Set()
  });
}

// Conditional exports for Node.js (Vitest) — ignored in browser
if (typeof module !== 'undefined') module.exports = {
  padBaseMidi, padMidiNote, padNoteName,
  padDegreeName, padGridViewBox, padComputeBoxes,
  padRenderGrid, padDrawBoxes, padRenderFretboard, padRenderPiano,
  padMidiToStaffPos, padDegreeAwareStaffPos, padRenderStaff,
  padComputeRenderState,
  padApplyScaleOnlyOverride, padApplyPadOverride,
};
