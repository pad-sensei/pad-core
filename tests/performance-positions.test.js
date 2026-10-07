import { describe, it, expect } from 'vitest';

const B = pairs => pairs.map(([pitch, serial]) => ({ pitch, serial }));
const serials = step => step.bindings.map(b => b.serial);
const pairs = step => step.bindings.map(b => [b.pitch, b.serial]);
const chord = root => ({ root, quality: 'm7', pitches: [0, 3, 7, 10].map(d => 48 + root + d) });
const FORM1 = 'root-seventh-third-fifth-right';
const FORM2 = 'right-root-seventh';
const SEED = { ...chord(0), formId: FORM1, explicit: B([[48, 54], [51, 57], [55, 64], [58, 70]]) };
const HPS = { root: 0, quality: 'm7', pitches: [60, 63, 67, 70],
  explicit: B([[60, 72], [63, 78], [67, 85], [70, 88]]) };
const FM = { root: 5, quality: 'm7', pitches: [60, 63, 65, 68] };
// Cm7フォーム1 [72,75,82,88] を2行下へ平行移動したDm7。
const DM = { ...chord(2), formId: 'root-seventh-third-fifth-right',
  explicit: B([[50, 56], [53, 59], [57, 66], [60, 72]]) };
const movement = result => result.results.slice(1).reduce((n, s) => n + s.metrics.transition.movement, 0);

// 性質の確認: 公開候補の全組合せを独立評価しDPを検証する。
// 候補集合は実装由来であり、演奏正解・候補生成の完全性のoracleではない。
const distance = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
function handMovement(a, b) {
  // このoracleは既定の2音ずつの手本だけを扱う。
  expect(a).toHaveLength(2); expect(b).toHaveLength(2);
  return Math.min(distance(a[0], b[0]) + distance(a[1], b[1]), distance(a[0], b[1]) + distance(a[1], b[0]));
}
function edgeCost(a, b, bpm = 120) {
  const known = a.internal.hands.left && b.internal.hands.left;
  const poolsA = known ? a.internal.hands : Object.fromEntries(Object.entries(a.internal.groups).map(([id, g]) => [id, g.notes]));
  const poolsB = known ? b.internal.hands : Object.fromEntries(Object.entries(b.internal.groups).map(([id, g]) => [id, g.notes]));
  // 大きな移動の負担を各手/まとまりで別計算。1音平均1以下は従来の線形。
  const effort = Object.keys(poolsA).reduce((n, id) => {
    const d = handMovement(poolsA[id], poolsB[id]);
    return n + d * Math.max(1, d / 2);
  }, 0);
  const old = new Map(a.bindings.map(b => [b.pitch, b.serial]));
  const moved = b.bindings.filter(b => old.has(b.pitch) && old.get(b.pitch) !== b.serial).length;
  const notesA = Object.values(a.internal.groups).flatMap(g => g.notes);
  const notesB = Object.values(b.internal.groups).flatMap(g => g.notes);
  const deltas = notesA.map(p => {
    const q = notesB.find(n => n.degree === p.degree);
    return `${q.row - p.row}:${q.col - p.col}`;
  });
  const sameForm = a.formId === b.formId;
  const parallel = sameForm && new Set(deltas).size === 1;
  return effort * (bpm / 120) ** 2 + moved * 4 + (sameForm ? (parallel ? 0 : 1) : 2);
}
// intrinsicCostの出力は使わず、公開まとまりの座標と既定重みから費用を再計算。
function intrinsicCost(candidate) {
  const groups = Object.values(candidate.internal.groups).map(g => g.notes);
  const span = group => Math.max(...group.flatMap(a => group.map(b => distance(a, b))));
  return groups.reduce((n, g) => n + span(g), 0) + Math.abs(groups[0].length - groups[1].length) * 2 +
    (candidate.formId === FORM2 ? 2 : 0);
}
function bruteThree(steps, bpm = 120) {
  const pools = steps.map(s => padEnumPerformancePositions(s, { bpm }).candidates);
  let minimum = Infinity;
  for (const a of pools[0]) for (const b of pools[1]) for (const c of pools[2]) {
    const cost = intrinsicCost(b) + intrinsicCost(c) + edgeCost(a, b, bpm) + edgeCost(b, c, bpm);
    minimum = Math.min(minimum, cost);
  }
  return minimum;
}

describe('演奏ロジックv2・受け入れ', () => {
  it('(a) HPS4 Cm7→Fm7は実音高と指定位置を保つ', () => {
    const r = padResolvePerformanceSequence([HPS, FM]);
    expect(r.ok).toBe(true);
    expect(pairs(r.results[1])).toEqual([[60, 72], [63, 78], [65, 80], [68, 86]]);
    expect(r.results[1].metrics.transition.movedCommon).toBe(0);
    expect(r.results[0].source).toBe('seed');
  });
  it('(b) 原文の期待: フォーム1のDm7からEm7でフォーム2へ切り替える', () => {
    // 期待は6035035879「そう。同じ弾き方だと左に移動する必要があるからね。」
    // 大きな左移動より近くでの切替。Em7のserialを演奏正解とはしない。
    const expectedForm = FORM2;
    const r = padResolvePerformanceSequence([DM, chord(4)]);
    expect(r.ok).toBe(true);
    expect(r.results[0].formId).toBe(FORM1);
    const cmShape = [[60, 72], [63, 75], [67, 82], [70, 88]];
    for (let i = 0; i < cmShape.length; i++) {
      const cm = padSerialToRowCol(cmShape[i][1]);
      const dm = padSerialToRowCol(DM.explicit[i].serial);
      expect([dm.row - cm.row, dm.col - cm.col]).toEqual([-2, 0]);
      expect(DM.explicit[i].pitch - cmShape[i][0]).toBe(-10);
    }
    expect(r.results[0].metrics.groupSpans).toEqual({ 'root-seventh': 2, 'third-fifth': 2 });
    expect(r.results[1].formId).toBe(expectedForm);
    expect(r.results[1].internal.hands.right.map(b => b.degree)).toEqual([0, 10]);
    expect(r.results[1].internal.hands.left.map(b => b.degree)).toEqual([3, 7]);
    expect(r.results[1].metrics.transition.switched).toBe(true);
    // フォーム1も弾け、対内距離は等しい。切替は費用差で選ぶ。
    const stay = padResolvePerformanceSequence([DM, { ...chord(4), formId: FORM1 }]);
    expect(stay.ok).toBe(true);
    expect(stay.results[1].metrics.transition.parallel).toBe(true);
    expect(stay.results[1].metrics.groupSpans).toEqual(r.results[1].metrics.groupSpans);
    expect(r.results[1].metrics.transition.movement).toBeLessThan(stay.results[1].metrics.transition.movement);
    expect(r.totalCost).toBeLessThan(stay.totalCost);
    const switched = r.results[1];
    const retained = stay.results[1];
    expect(switched.metrics.costs.fingerDistance).toBe(retained.metrics.costs.fingerDistance);
    expect(switched.metrics.transition.costs.formSwitch).toBe(2);
    expect(switched.metrics.costs.usage).toBe(2);
    expect(retained.metrics.transition.costs.formSwitch).toBe(0);
    expect(retained.metrics.costs.usage).toBe(0);
    expect(retained.metrics.transition.costs.movement - switched.metrics.transition.costs.movement)
      .toBeGreaterThan(switched.metrics.transition.costs.formSwitch + switched.metrics.costs.usage);
    // 座標の独立計算: 維持は各対(Δrow,Δcol)=(1,-3)、平均4×2音×2対=64。
    // 切替はR+b7が(0,2)、m3+5が(1,-3)、2^2×2+4^2×2=40。
    expect(retained.metrics.transition.costs.movement).toBe(64);
    expect(switched.metrics.transition.costs.movement).toBe(40);
    expect(stay.totalCost).toBe(68); // 移動64 + 指間距離4
    expect(r.totalCost).toBe(48); // 移動40 + 指間距離4 + 切替2 + 使用傾向2
    // 非線形の移動負担だけを外すと旧20対20。重みの調整で通さない。
    const linearOptions = { model: { movementExponent: 1 } };
    const linear = padResolvePerformanceSequence([DM, chord(4)], linearOptions);
    const linearStay = padResolvePerformanceSequence([DM, { ...chord(4), formId: FORM1 }], linearOptions);
    expect(linear.totalCost).toBe(20);
    expect(linearStay.totalCost).toBe(20);
    // 各候補をoverrideにして同じ遷移を個別評価。固定点のintrinsicは別加算。
    const candidates = padEnumPerformancePositions(chord(4)).candidates;
    const evaluated = candidates.map(c => {
      const forced = padResolvePerformanceSequence([DM, { ...chord(4), explicit: c.bindings, formId: c.formId }]);
      return { formId: c.formId, cost: forced.totalCost + intrinsicCost(c) };
    });
    expect(r.totalCost).toBe(Math.min(...evaluated.map(c => c.cost)));
    expect(evaluated.filter(c => c.formId === FORM1).every(c => c.cost > r.totalCost)).toBe(true);
    const noReachLimit = padResolvePerformanceSequence([DM, chord(4)], { model: { limits: { maxHandDistance: 14 } } });
    expect(noReachLimit.results[1].formId).toBe(expectedForm);
  });
  it('(c) 性質の確認: BPMを上げると移動の大きい並びを避ける', () => {
    const steps = [SEED, chord(0), chord(3)];
    const slow = padResolvePerformanceSequence(steps, { bpm: 60 });
    const fast = padResolvePerformanceSequence(steps, { bpm: 240 });
    expect(slow.ok && fast.ok).toBe(true);
    expect(movement(fast)).toBeLessThan(movement(slow));
    expect(serials(slow.results[2])).not.toEqual(serials(fast.results[2]));
    expect(slow.totalCost).toBe(bruteThree(steps, 60));
    expect(fast.totalCost).toBe(bruteThree(steps, 240));
  });
  it('(d) 指定区間では同じフォームの厳密な平行移動を選ぶ', () => {
    const steps = [SEED, chord(0), chord(3)];
    const normal = padResolvePerformanceSequence(steps);
    const style = padResolvePerformanceSequence(steps, { constantStructure: [{ from: 0, to: 2 }] });
    expect(normal.results[2].metrics.transition.parallel).toBe(false);
    expect(style.ok).toBe(true);
    expect(style.results.slice(1).every(r => r.metrics.transition.parallel)).toBe(true);
    // Cm7→Ebm7は(row+1,col-2)で+3半音の同形。実装から逆算しない。
    expect(serials(style.results[2])).toEqual(SEED.explicit.map(b => b.serial + 6));
    expect(style.results.every(r => r.formId === FORM1)).toBe(true);
  });
  it('性質の確認: 先読みは貪欲な選択を変え、全組合せの最小費用に一致する', () => {
    const steps = [SEED, chord(2), chord(4)];
    const full = padResolvePerformanceSequence(steps);
    const pair = padResolvePerformanceSequence(steps.slice(0, 2));
    const greedy = padResolvePerformanceSequence([SEED,
      { ...chord(2), explicit: pair.results[1].bindings, formId: pair.results[1].formId }, chord(4)]);
    const greedyTotal = pair.totalCost + greedy.results[2].metrics.intrinsicCost + greedy.results[2].metrics.transition.cost;
    expect(full.totalCost).toBeLessThan(greedyTotal);
    expect(serials(full.results[1])).not.toEqual(serials(pair.results[1]));
    expect(full.totalCost).toBe(bruteThree(steps));
  });
});

describe('大きな移動の費用規則（特定のコードや盤端に限定しない）', () => {
  const knownSeed = { ...chord(0), formId: FORM2,
    // HPS4を(row-3,col+3)で−12半音。colが盤外に出ない平行移動。
    explicit: B([[48, 51], [51, 57], [55, 64], [58, 67]]) };
  const translate = (seed, rows) => ({ ...seed,
    root: ((seed.root + rows * 5) % 12 + 12) % 12,
    pitches: seed.pitches.map(p => p + rows * 5),
    explicit: seed.explicit.map(b => ({ pitch: b.pitch + rows * 5, serial: b.serial + rows * 8 })),
  });
  it.each([
    ['unknownの役割のまとまり', SEED, 'role-groups'],
    ['確定した左右の手', knownSeed, 'known-hands'],
  ])('%s: 平行移動は方向によらず大きさの二乗、1で旧線形に戻る', (_, seed, basis) => {
    // 期待は各音が同じ列でrow差k、各対が2音という座標から計算。
    // 0/±1/+2/+3行の異なるコードで検証し、Dm7→Em7に数値を寄せない。
    for (const rows of [0, 1, -1, 2, 3]) {
      const steps = [seed, translate(seed, rows)];
      const result = padResolvePerformanceSequence(steps);
      expect(result.ok).toBe(true);
      const transition = result.results[1].metrics.transition;
      expect(transition.movementBasis).toBe(basis);
      expect(transition.parallel).toBe(true);
      expect(transition.movement).toBe(4 * Math.abs(rows));
      expect(transition.movementEffort).toBe(4 * rows ** 2);
      expect(transition.costs.movement).toBe(4 * rows ** 2);
      for (const group of Object.values(transition.movementGroups)) {
        expect(group).toEqual({ distance: 2 * Math.abs(rows), matched: 2,
          meanDistance: Math.abs(rows), effort: 2 * rows ** 2 });
      }
      const linear = padResolvePerformanceSequence(steps, { model: { movementExponent: 1 } });
      expect(linear.results[1].metrics.transition.costs.movement).toBe(4 * Math.abs(rows));
      const fast = padResolvePerformanceSequence(steps, { bpm: 240 });
      expect(fast.results[1].metrics.transition.costs.movement).toBe(16 * rows ** 2);
    }
  });
  it('一方の大移動を両まとまりの平均で薄めない', () => {
    // 各音平均(2,4)なら40。全体平均3として計算した36より大きい。
    // 座標から指定した遷移で、距離合計だけの非線形化との違いを確認する。
    const uneven = { ...chord(4), formId: FORM2,
      explicit: B([[52, 58], [55, 64], [59, 71], [62, 74]]) };
    const a = padResolvePerformanceSequence([DM, uneven]).results[1].metrics.transition;
    expect(a.movementGroups['root-seventh'].effort).toBe(8);
    expect(a.movementGroups['third-fifth'].effort).toBe(32);
    expect(a.movementEffort).toBe(40);
    expect(a.movement).toBe(12);
    expect(a.movementEffort).toBeGreaterThan(a.movement ** 2 / 4);
  });
});

describe('手本・手のまとまり・入力の主体性', () => {
  it.each([
    [FORM1, [[60, 72], [63, 75], [67, 82], [70, 88]]],
    [FORM2, [[60, 72], [63, 78], [67, 85], [70, 88]]],
  ])('原文で訂正されたCm7手本を通常候補として再生成: %s', (formId, expected) => {
    // 指示パックの確定手本を直接書く。data.jsから期待値を作らない。
    const enumeration = padEnumPerformancePositions({ root: 0, quality: 'm7', pitches: [60, 63, 67, 70] });
    expect(enumeration.ok).toBe(true);
    const matches = enumeration.candidates.filter(c => JSON.stringify(pairs(c)) === JSON.stringify(expected));
    expect(matches).toHaveLength(1);
    const candidate = matches[0];
    expect(candidate.formId).toBe(formId);
    expect(candidate.internal.fixed).toBe(false);
    expect(candidate.metrics.exceedsReach).toBe(false);
    expect(candidate.metrics.groupSpans).toEqual({ 'root-seventh': 2, 'third-fifth': 2 });
    expect(candidate.internal.groups['root-seventh'].notes.map(n => n.degree)).toEqual([0, 10]);
    expect(candidate.internal.groups['third-fifth'].notes.map(n => n.degree)).toEqual([3, 7]);
    expect(PAD_POSITION_MODEL_V2.forms.m7.find(f => f.id === formId).reference).toEqual(B(expected));
    if (formId === FORM1) {
      expect(candidate.internal.hands).toEqual({ left: null, right: null });
      expect(Object.values(candidate.internal.groups).map(g => g.hand)).toEqual(['unknown', 'unknown']);
      expect(candidate.metrics.leftSpan).toBeNull();
      expect(candidate.metrics.rightSpan).toBeNull();
    } else {
      expect(candidate.internal.hands.right.map(n => n.degree)).toEqual([0, 10]);
      expect(candidate.internal.hands.left.map(n => n.degree)).toEqual([3, 7]);
    }
    // 距離2という手本を上限2でも排除しない。
    const tight = padEnumPerformancePositions({ root: 0, quality: 'm7', pitches: [60, 63, 67, 70], formId },
      { model: { limits: { maxHandDistance: 2 } } });
    expect(tight.candidates.some(c => JSON.stringify(pairs(c)) === JSON.stringify(expected))).toBe(true);
  });
  it('formId未指定のHPS4はフォーム2。明示したformIdと位置は矛盾しても固定する', () => {
    expect(padEnumPerformancePositions(HPS).candidates[0].formId).toBe(FORM2);
    const mismatched = padEnumPerformancePositions({ ...HPS, formId: FORM1 }).candidates[0];
    expect(mismatched.formId).toBe(FORM1);
    expect(pairs(mismatched)).toEqual([[60, 72], [63, 78], [67, 85], [70, 88]]);
    expect(mismatched.metrics.matchesGeometry).toBe(false);
  });
  it('m7の2フォームとdom7の使用傾向、理由を内部で持つ', () => {
    const minor = padEnumPerformancePositions(chord(0));
    expect(new Set(minor.candidates.map(c => c.formId))).toEqual(new Set([FORM1, FORM2]));
    const alt = minor.candidates.find(c => c.formId === 'right-root-seventh');
    expect(alt.metrics.costs.usage).toBe(2);
    expect(alt.internal.reason).toContain('5度へのクロマチック');
    const dominant = padEnumPerformancePositions({ root: 0, quality: 'dom7', pitches: [48, 52, 55, 58] });
    expect(dominant.ok).toBe(true);
    expect(dominant.candidates.every(c => c.formId === 'right-root-seventh' && c.metrics.costs.usage === 0)).toBe(true);
    expect(dominant.candidates[0].internal.reason).toContain('3度へのクロマチック');
    expect(dominant.candidates[0].bindings.every(b => !('hand' in b) && !('finger' in b))).toBe(true);
  });
  it('同じ手のまとまりでも距離上限を超える配置は候補に入れない', () => {
    const r = padEnumPerformancePositions(chord(4));
    expect(r.rejectedByReach).toBeGreaterThan(0);
    expect(r.candidates.every(c => !c.metrics.exceedsReach && c.metrics.matchesGeometry)).toBe(true);
    expect(r.candidates.every(c => Object.values(c.metrics.groupSpans).every(span => span <= 4))).toBe(true);
  });
  it('seed/overrideは距離上限が低くても勝手に書き換えない', () => {
    const override = { ...FM, explicit: B([[60, 72], [63, 78], [65, 80], [68, 83]]) };
    const r = padResolvePerformanceSequence([HPS, override], { model: { limits: { maxHandDistance: 1 } } });
    expect(r.ok).toBe(true);
    expect(pairs(r.results[0])).toEqual(pairs({ bindings: HPS.explicit }));
    expect(pairs(r.results[1])).toEqual(pairs({ bindings: override.explicit }));
    expect(r.results[0].metrics.exceedsReach).toBe(true);
    expect(r.results[1].source).toBe('override');
  });
  it('overrideを固定し、その後も先を含めて解く', () => {
    const override = { ...chord(1), explicit: B([[49, 55], [52, 61], [56, 65], [59, 71]]), formId: 'right-root-seventh' };
    const r = padResolvePerformanceSequence([SEED, chord(0), override, chord(8)]);
    const suffix = padResolvePerformanceSequence([override, chord(8)]);
    expect(r.ok && suffix.ok).toBe(true);
    expect(pairs(r.results[2])).toEqual(pairs({ bindings: override.explicit }));
    expect(r.results[2].formId).toBe(override.formId);
    expect(r.results[3].bindings).toEqual(suffix.results[1].bindings);
  });
  it('平行移動の距離は不変。特定キーの禁止規則を作らない', () => {
    const r = padResolvePerformanceSequence([SEED, chord(3)], { constantStructure: [{ from: 0, to: 1 }] });
    expect(r.ok).toBe(true);
    expect(r.results[1].metrics.groupSpans).toEqual(r.results[0].metrics.groupSpans);
  });
  it('様式とoverrideが衝突したらoverrideを動かさず止まる', () => {
    const overridden = { ...chord(1), explicit: B([[49, 55], [52, 61], [56, 65], [59, 71]]) };
    const r = padResolvePerformanceSequence([SEED, overridden, chord(8)], { constantStructure: [{ from: 0, to: 1 }] });
    expect(r.ok).toBe(false); expect(r.reason).toBe('style_conflict');
    expect(r.failedAt).toBe(1); expect(r.results).toHaveLength(2);
    expect(pairs(r.results[0])).toEqual(pairs({ bindings: SEED.explicit }));
  });
  it('距離上限が低すぎる時は黙って音を落とさない', () => {
    const r = padResolvePerformanceSequence([SEED, chord(1), chord(2)], { model: { limits: { maxHandDistance: 1 } } });
    expect(r.reason).toBe('no_playable_form'); expect(r.failedAt).toBe(1);
    expect(r.results).toHaveLength(2); expect(r.results[1].bindings).toEqual([]);
  });
  it('手本で別の質・3対1の手配分を追加し、均等さを評価できる', () => {
    const options = { model: { forms: { custom: [
      { id: 'even', left: [0, 7], right: [3, 10], usageCost: 0 },
      { id: 'uneven', left: [0], right: [3, 7, 10], usageCost: 0 },
    ] }, limits: { maxHandDistance: 14 }, weights: { fingerDistance: 0, movement: 0, movedCommon: 0, formSwitch: 0, shapeChange: 0 } } };
    const step = { ...chord(0), quality: 'custom' };
    const enumeration = padEnumPerformancePositions(step, options);
    expect(enumeration.candidates.find(c => c.formId === 'uneven').metrics.costs.balance).toBe(4);
    const r = padResolvePerformanceSequence([{ ...step, explicit: SEED.explicit }, step], options);
    expect(r.results[1].formId).toBe('even'); expect(r.totalCost).toBe(0);
  });
  it('純粋・決定的。inputの順番、重複pitchを変えても一致する', () => {
    const steps = structuredClone([SEED, chord(1), chord(8)]);
    const options = { bpm: 180, model: { weights: { formSwitch: 3 } } };
    const before = JSON.stringify({ steps, options });
    const a = padResolvePerformanceSequence(steps, options);
    expect(padResolvePerformanceSequence(steps, options)).toEqual(a);
    expect(JSON.stringify({ steps, options })).toBe(before);
    steps.forEach(s => { s.pitches.reverse(); s.pitches.push(s.pitches[0]); if (s.explicit) s.explicit.reverse(); });
    expect(padResolvePerformanceSequence(steps, options)).toEqual(a);
    expect(Object.isFrozen(PAD_POSITION_MODEL_V2.forms.m7[0].groups[0].degrees)).toBe(true);
  });
  it('octaveShiftはpitchだけを変え、盤面を差し替えない', () => {
    const shifted = [HPS, FM].map(s => ({ ...s, pitches: s.pitches.map(p => p + 12),
      ...(s.explicit ? { explicit: s.explicit.map(b => ({ pitch: b.pitch + 12, serial: b.serial })) } : {}) }));
    const r = padResolvePerformanceSequence(shifted, { octaveShift: 1, layout: { rows: 100, baseMidi: 0 } });
    expect(r.ok).toBe(true); expect(serials(r.results[1])).toEqual([72, 78, 80, 86]);
    r.results.forEach(s => s.bindings.forEach(b => expect(padPitchAtSerial(b.serial, { octaveShift: 1 })).toBe(b.pitch)));
  });
});

describe('不正入力・探索上限・失敗の境界', () => {
  it.each([
    [{}, 'harmony_required'], [{ ...chord(0), quality: 'maj7' }, 'unsupported_quality'],
    [{ ...chord(0), pitches: [48, 51, 55] }, 'unsupported_voicing'],
    [{ ...chord(0), pitches: [48, 51, 55, 58, 60] }, 'unsupported_voicing'],
    [{ ...chord(0), formId: 'unknown' }, 'unknown_form'],
    [{ ...chord(0), pitches: [48.5] }, 'invalid_pitch'],
    [{ ...chord(0), pitches: '48' }, 'invalid_pitch'],
    [{ ...chord(0), pitches: [] }, 'empty_pitches'],
    [{ ...chord(0), pitches: [0, 3, 7, 10] }, 'unplaceable'],
    [{ ...chord(0), explicit: B([[48, 100]]) }, 'invalid_explicit'],
    [{ ...chord(0), explicit: B([[48, 54]]) }, 'explicit_pitch_mismatch'],
    [{ ...chord(0), explicit: null }, 'invalid_explicit'],
  ])('入力拒否: %j → %s', (step, reason) => {
    expect(padEnumPerformancePositions(step).reason).toBe(reason);
  });
  it.each([
    { bpm: 0 }, { bpm: NaN }, { bpm: Infinity }, { bpm: -10 },
    { octaveShift: 0.5 }, { model: null }, { model: 5 },
    { model: { weights: { movement: -1 } } }, { model: { weights: { balance: NaN } } },
    { model: { referenceBpm: 0 } }, { model: { limits: { maxCandidates: 129 } } },
    ...[0, -1, 0.5, NaN, Infinity, '2'].map(movementExponent => ({ model: { movementExponent } })),
    { model: { limits: { maxSteps: 0 } } },
    { model: { forms: { m7: [{ id: 'bad', left: [0, 7], right: [7, 10], usageCost: 0 }] } } },
    { model: { forms: { m7: [{ id: 'bad', groups: [
      { id: 'a', degrees: [0, 10], hand: 'left' }, { id: 'b', degrees: [3, 7], hand: 'left' },
    ], usageCost: 0 }] } } },
    { model: { forms: { m7: [{ id: 'bad', groups: [
      { id: 'a', degrees: [0, 10], hand: 'unknown' }, { id: 'a', degrees: [3, 7], hand: 'unknown' },
    ], usageCost: 0 }] } } },
    { model: { forms: { m7: [{ id: 'bad', groups: [
      { id: 'a', degrees: [0, 10], hand: 'unknown' }, { id: 'b', degrees: [3, 7], hand: 'unknown' },
    ], geometry: { group: 'missing', relativeTo: 'a', side: 'right' }, usageCost: 0 }] } } },
  ])('不正モデルを拒否: %j', options => {
    expect(padResolvePerformanceSequence([SEED, chord(1)], options).reason).toBe('invalid_model');
  });
  it.each([[{ from: -1, to: 1 }], [{ from: 0, to: 2 }], [{ from: 1, to: 0 }], [null]])('不正様式を拒否', ranges => {
    expect(padResolvePerformanceSequence([SEED, chord(1)], { constantStructure: ranges }).reason).toBe('invalid_style');
  });
  it('seedなし・steps不正・空の進行', () => {
    expect(padResolvePerformanceSequence([chord(0)]).reason).toBe('seed_required');
    expect(padResolvePerformanceSequence(null).reason).toBe('invalid_steps');
    expect(padResolvePerformanceSequence([])).toEqual({ ok: true, results: [], totalCost: 0 });
  });
  it('候補を切り捨てず、候補数と進行の探索上限を明示する', () => {
    expect(padEnumPerformancePositions(chord(0), { model: { limits: { maxCandidates: 1 } } }).reason).toBe('too_many_candidates');
    expect(padResolvePerformanceSequence([SEED, chord(1)], { model: { limits: { maxSteps: 1 } } }).reason).toBe('too_many_steps');
  });
  it('未登録の質に出会ったらそのstepで止め、後ろを推測しない', () => {
    const r = padResolvePerformanceSequence([SEED, { ...chord(1), quality: 'maj7' }, chord(8)]);
    expect(r.failedAt).toBe(1); expect(r.results).toHaveLength(2);
    expect(r.results[1].reason).toBe('unsupported_quality');
  });
});
