import { describe, it, expect } from 'vitest';

const B = pairs => pairs.map(([pitch, serial]) => ({ pitch, serial }));
const serials = step => step.bindings.map(b => b.serial);
const pairs = step => step.bindings.map(b => [b.pitch, b.serial]);
const chord = root => ({ root, quality: 'm7', pitches: [0, 3, 7, 10].map(d => 48 + root + d) });
const SEED = { ...chord(0), explicit: B([[48, 54], [51, 57], [55, 64], [58, 67]]) };
const HPS = { root: 0, quality: 'm7', pitches: [60, 63, 67, 70],
  explicit: B([[60, 72], [63, 78], [67, 85], [70, 88]]) };
const FM = { root: 5, quality: 'm7', pitches: [60, 63, 65, 68] };
const DM = { ...chord(2), explicit: B([[50, 56], [53, 62], [57, 66], [60, 72]]) };
const movement = result => result.results.slice(1).reduce((n, s) => n + s.metrics.transition.movement, 0);

// 公開候補だけから全組合せを独立評価。DPの内部helperは使わない。
const distance = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
function handMovement(a, b) {
  // このoracleは既定の2音ずつの手本だけを扱う。
  expect(a).toHaveLength(2); expect(b).toHaveLength(2);
  return Math.min(distance(a[0], b[0]) + distance(a[1], b[1]), distance(a[0], b[1]) + distance(a[1], b[0]));
}
function edgeCost(a, b, bpm = 120) {
  const handsA = a.internal.hands, handsB = b.internal.hands;
  const move = handMovement(handsA.left, handsB.left) + handMovement(handsA.right, handsB.right);
  const old = new Map(a.bindings.map(b => [b.pitch, b.serial]));
  const moved = b.bindings.filter(b => old.has(b.pitch) && old.get(b.pitch) !== b.serial).length;
  const deltas = ['left', 'right'].flatMap(h => handsA[h].map((p, i) => {
    const q = handsB[h][i];
    return `${q.degree - p.degree}:${q.row - p.row}:${q.col - p.col}`;
  }));
  const sameForm = a.formId === b.formId;
  const parallel = sameForm && new Set(deltas).size === 1 && deltas[0].startsWith('0:');
  return move * (bpm / 120) ** 2 + moved * 4 + (sameForm ? (parallel ? 0 : 1) : 2);
}
function bruteThree(steps, bpm = 120) {
  const pools = steps.map(s => padEnumPerformancePositions(s, { bpm }).candidates);
  let minimum = Infinity;
  for (const a of pools[0]) for (const b of pools[1]) for (const c of pools[2]) {
    const cost = b.metrics.intrinsicCost + c.metrics.intrinsicCost + edgeCost(a, b, bpm) + edgeCost(b, c, bpm);
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
  it('(b) 指間距離が増えるDm7→Em7では第2フォームへ切り替える', () => {
    // 指示のDm7実音高/serialは未指定。本fixtureの入力を明記し、原演奏一致とは区別。
    const r = padResolvePerformanceSequence([DM, chord(4)]);
    expect(r.ok).toBe(true);
    expect(r.results[0].formId).toBe('paired-fifths');
    expect(r.results[0].metrics.leftSpan).toBe(3);
    expect(r.results[1].formId).toBe('right-root-seventh');
    expect(r.results[1].internal.hands.right.map(b => b.degree)).toEqual([0, 10]);
    expect(r.results[1].internal.hands.left.map(b => b.degree)).toEqual([3, 7]);
    expect(r.results[1].metrics.transition.parallel).toBe(false);
    expect(r.results[1].metrics.leftSpan).toBe(2);
    expect(r.results[1].metrics.rightSpan).toBe(2);
    // 上限のみを緩めると、片手内距離5の近い第1フォームが勝つ。
    const relaxed = padResolvePerformanceSequence([DM, chord(4)], { model: { limits: { maxHandDistance: 5 } } });
    expect(relaxed.results[1].formId).toBe('paired-fifths');
    expect(relaxed.results[1].metrics.leftSpan).toBe(5);
    expect(relaxed.totalCost).toBeLessThan(r.totalCost);
  });
  it('(c) BPMを上げると移動の大きい並びを避ける', () => {
    const steps = [SEED, chord(0), chord(3)];
    const slow = padResolvePerformanceSequence(steps, { bpm: 60 });
    const fast = padResolvePerformanceSequence(steps, { bpm: 240 });
    expect(slow.ok && fast.ok).toBe(true);
    expect(movement(slow)).toBe(12); expect(movement(fast)).toBe(6);
    expect(serials(slow.results[2])).toEqual([57, 63, 67, 73]);
    expect(serials(fast.results[2])).toEqual([57, 63, 70, 73]);
    expect(fast.totalCost).toBe(bruteThree(steps, 240));
  });
  it('(d) 指定区間では同じフォームの厳密な平行移動を選ぶ', () => {
    const steps = [SEED, chord(0), chord(3)];
    const normal = padResolvePerformanceSequence(steps);
    const style = padResolvePerformanceSequence(steps, { constantStructure: [{ from: 0, to: 2 }] });
    expect(normal.results[2].metrics.transition.parallel).toBe(false);
    expect(style.ok).toBe(true);
    expect(style.results.slice(1).every(r => r.metrics.transition.parallel)).toBe(true);
    expect(serials(style.results[2])).toEqual([60, 63, 70, 73]);
    expect(style.results.every(r => r.formId === 'paired-fifths')).toBe(true);
  });
  it('先読みは貪欲な選択を変え、全組合せの最小費用に一致する', () => {
    const steps = [SEED, chord(1), chord(8)];
    const full = padResolvePerformanceSequence(steps);
    const pair = padResolvePerformanceSequence(steps.slice(0, 2));
    const greedy = padResolvePerformanceSequence([SEED,
      { ...chord(1), explicit: pair.results[1].bindings, formId: pair.results[1].formId }, chord(8)]);
    const greedyTotal = pair.totalCost + greedy.results[2].metrics.intrinsicCost + greedy.results[2].metrics.transition.cost;
    expect(full.totalCost).toBe(36); expect(greedyTotal).toBe(37);
    expect(serials(full.results[1])).not.toEqual(serials(pair.results[1]));
    expect(full.totalCost).toBe(bruteThree(steps));
  });
});

describe('手本・手のまとまり・入力の主体性', () => {
  it('m7の2フォームとdom7の使用傾向、理由を内部で持つ', () => {
    const minor = padEnumPerformancePositions(chord(0));
    expect(new Set(minor.candidates.map(c => c.formId))).toEqual(new Set(['paired-fifths', 'right-root-seventh']));
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
    expect(r.candidates.every(c => Math.max(c.metrics.leftSpan, c.metrics.rightSpan) <= 4)).toBe(true);
    const bad = r.candidates.find(c => c.formId === 'paired-fifths' && serials(c).join() === '58,64,71,74');
    expect(bad).toBeUndefined();
  });
  it('seed/overrideは距離上限が低くても勝手に書き換えない', () => {
    const override = { ...FM, explicit: B([[60, 72], [63, 78], [65, 80], [68, 83]]) };
    const r = padResolvePerformanceSequence([HPS, override]);
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
    expect(r.results[1].metrics.leftSpan).toBe(r.results[0].metrics.leftSpan);
    expect(r.results[1].metrics.rightSpan).toBe(r.results[0].metrics.rightSpan);
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
    expect(Object.isFrozen(PAD_POSITION_MODEL_V2.forms.m7[0].left)).toBe(true);
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
    { model: { limits: { maxSteps: 0 } } },
    { model: { forms: { m7: [{ id: 'bad', left: [0, 7], right: [7, 10], usageCost: 0 }] } } },
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
