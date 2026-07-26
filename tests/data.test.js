import { describe, it, expect } from 'vitest';

describe('SCALES', () => {
  it('contains 31 scales', () => {
    expect(SCALES).toHaveLength(31);
  });

  it('each scale has valid pcs (0-11, sorted, no duplicates)', () => {
    SCALES.forEach((scale) => {
      scale.pcs.forEach(pc => {
        expect(pc).toBeGreaterThanOrEqual(0);
        expect(pc).toBeLessThan(12);
      });
      for (let i = 1; i < scale.pcs.length; i++) {
        expect(scale.pcs[i]).toBeGreaterThan(scale.pcs[i - 1]);
      }
      expect(new Set(scale.pcs).size).toBe(scale.pcs.length);
    });
  });

  it('each scale has required properties', () => {
    SCALES.forEach(scale => {
      expect(scale).toHaveProperty('id');
      expect(scale).toHaveProperty('name');
      expect(scale).toHaveProperty('pcs');
      expect(scale).toHaveProperty('cn');
    });
  });

  it('all scales start with 0 (root)', () => {
    SCALES.forEach(scale => {
      expect(scale.pcs[0]).toBe(0);
    });
  });

  it('diatonic modes have 7 notes', () => {
    SCALES.filter(s => s.cat === '○').forEach(scale => {
      expect(scale.pcs).toHaveLength(7);
    });
  });
});

describe('BUILDER_QUALITIES', () => {
  it('is a 5x3 grid', () => {
    expect(BUILDER_QUALITIES).toHaveLength(5);
    BUILDER_QUALITIES.forEach(row => {
      expect(row).toHaveLength(3);
    });
  });

  it('each quality has name, label, and valid pcs', () => {
    BUILDER_QUALITIES.flat().filter(Boolean).forEach(q => {
      expect(q).toHaveProperty('name');
      expect(q).toHaveProperty('label');
      expect(q).toHaveProperty('pcs');
      q.pcs.forEach(pc => {
        expect(pc).toBeGreaterThanOrEqual(0);
        expect(pc).toBeLessThan(12);
      });
    });
  });

  it('all qualities start with root (0)', () => {
    BUILDER_QUALITIES.flat().filter(Boolean).forEach(q => {
      expect(q.pcs[0]).toBe(0);
    });
  });
});

describe('TENSION_ROWS', () => {
  it('non-null entries have label and mods', () => {
    TENSION_ROWS.flat().forEach(t => {
      if (t === null) return;
      expect(t).toHaveProperty('label');
      expect(t).toHaveProperty('mods');
    });
  });

  it('mods.add values are valid pitch classes', () => {
    TENSION_ROWS.flat().forEach(t => {
      if (!t || !t.mods.add) return;
      t.mods.add.forEach(pc => {
        expect(pc).toBeGreaterThanOrEqual(0);
        expect(pc).toBeLessThan(12);
      });
    });
  });
});

describe('SCALE_AVAIL_TENSIONS', () => {
  it('covers all diatonic/HM/MM scales (indices 0-20)', () => {
    for (let i = 0; i <= 20; i++) {
      expect(SCALE_AVAIL_TENSIONS).toHaveProperty(String(i));
    }
  });

  it('avail and avoid contain valid tension names', () => {
    const validNames = new Set(Object.keys(TENSION_NAME_TO_PC));
    Object.values(SCALE_AVAIL_TENSIONS).forEach(sat => {
      if (sat.avail) sat.avail.forEach(name => expect(validNames.has(name)).toBe(true));
      if (sat.avoid) sat.avoid.forEach(name => expect(validNames.has(name)).toBe(true));
    });
  });
});

describe('GRID', () => {
  it('has standard 8x8 pad layout', () => {
    expect(GRID.ROWS).toBe(8);
    expect(GRID.COLS).toBe(8);
    expect(GRID.BASE_MIDI).toBe(36);
    expect(GRID.ROW_INTERVAL).toBe(5);
  });
});

// ======== SCALE_FULL_NAMES (スケールの本名) ========
// 2026-07-26 追加。テンションを全部含めたコードネームは、そのスケールの別名。
// 値の出典は data.js のコメント参照 (うりなみさん提供資料 + 判定)。
describe('SCALE_FULL_NAMES', () => {
  // 本名が指す音の集合を pcs へ戻すための対応表。
  const DEGREE_TO_PC = {
    'b9': 1, '9': 2, '#9': 3, '11': 5, '#11': 6, 'b13': 8, '13': 9,
  };
  const BASE_TO_PCS = {
    '△7': [0, 4, 7, 11],
    '7': [0, 4, 7, 10],
    'm7': [0, 3, 7, 10],
    'mMaj7': [0, 3, 7, 11],
    'm7(b5)': [0, 3, 6, 10],
    '7(b5)': [0, 4, 6, 10],
    '6/9': [0, 2, 4, 7, 9],
  };

  it('every id points at a real scale', () => {
    const ids = new Set(SCALES.map((s) => s.id));
    Object.keys(SCALE_FULL_NAMES).forEach((id) => {
      expect(ids.has(Number(id))).toBe(true);
    });
  });

  // 本名から音を復元して、そのスケールの構成音とちょうど一致すること。
  // 片方だけ書き換えた事故 (本名だけ直して pcs と食い違う) をここで落とす。
  it('each full name rebuilds exactly the scale it names', () => {
    Object.entries(SCALE_FULL_NAMES).forEach(([id, fullName]) => {
      const scale = SCALES.find((s) => s.id === Number(id));
      const match = fullName.match(/^([^(]+(?:\((?:b5)\))?)(?:\((.+)\))?$/);
      expect(match, `${fullName} の形が読めない`).toBeTruthy();

      const base = match[1];
      const basePcs = BASE_TO_PCS[base];
      expect(basePcs, `${fullName}: 土台 "${base}" が未対応`).toBeTruthy();

      const tensions = (match[2] ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const rebuilt = new Set(basePcs);
      tensions.forEach((t) => {
        expect(DEGREE_TO_PC[t], `${fullName}: テンション "${t}" が未対応`).toBeDefined();
        rebuilt.add(DEGREE_TO_PC[t]);
      });

      // 完全5度を持たないスケール (ホールトーン等) では、土台の 5度は省略された
      // ものとして扱う。名前は実践的な呼び方であって音の仕様書ではない
      // (うりなみさん: ホールトーンは「#11のほうがみんなわかる。対称スケールと
      // 知ってるから」)。省略を許すのは 5度だけで、他の音は一致を要求する。
      if (!scale.pcs.includes(7)) rebuilt.delete(7);

      expect([...rebuilt].sort((a, b) => a - b))
        .toEqual([...scale.pcs].sort((a, b) => a - b));
    });
  });
});
