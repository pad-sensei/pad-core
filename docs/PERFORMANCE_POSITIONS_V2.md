# 押さえ方の計算 第2版

うりなみさんの手本を使って、前後のコードを見ながら押す位置を選ぶ純粋関数。実音高、オクターブ、盤面は変更しない。教材側が指定したseed・overrideは固定する。手と度数の割当は計算用の内部データで、学習者に表示する指の指定ではない。

PR #27 の `padChooseNearestPositions` / `padResolveNearestSequence` は変更しない。第2版は呼び出し側が明示して使う。semantic-apiへの追加、DOJO・64PE・Authoringへの接続は含めない。

## API

```js
const steps = [
  { root: 0, quality: 'm7', pitches: [60, 63, 67, 70],
    explicit: [
      { pitch: 60, serial: 72 }, { pitch: 63, serial: 78 },
      { pitch: 67, serial: 85 }, { pitch: 70, serial: 88 },
    ], formId: 'paired-fifths' },
  { root: 5, quality: 'm7', pitches: [60, 63, 65, 68] },
];
const result = padResolvePerformanceSequence(steps, { bpm: 120 });
// 次: {60→72, 63→78, 65→80, 68→86}
const alternatives = padEnumPerformancePositions(steps[1]);
```

`root`はpitch class 0〜11。コード名を推測しない。`quality`の既定は `m7` と `dom7`。各度数に実MIDIが1つずつ必要。同じ度数の重複オクターブ、shell、ダブルストップ、未登録の質は失敗する。重複する同じ実pitchはPR27と同じく1音に畳む。音を減らして成功とはしない。

`padEnumPerformancePositions(step, options)`は全候補、距離で除外した数を返す。候補は `{bindings, formId, internal:{hands,reason,fixed}, metrics}`。`bindings`に手や指を混ぜない。候補の順はpitch順serialの辞書式、次にformIdで決定的。費用順の第1候補ではない。

`padResolvePerformanceSequence(steps, options)`は `{ok, results, totalCost, modelVersion, bpm}`。resultsはindex、source（seed / override / performance）、bindings、内部フォーム、費用の内訳・累積を持つ。有限状態の動的計画法で全区間の費用最小を求める。進行の最後まで列挙された候補を使い、近い数候補へ切り捨てない。同費用は候補の固定順で解決する。

先頭はexplicit必須。途中explicitはoverride。音高集合を完全に覆い、serialがその実pitchを鳴らす必要がある。explicitの位置・formIdを変更しない。explicitでformIdを省略した時は、その質の最初の対応フォームを使う（実演の左右が分かる時はformIdも渡す）。距離上限を超えるexplicitも固定し `exceedsReach:true` を返す。その位置を動かすのではなく、既定モデルと手本の差として扱う。固定点のintrinsicCostは0、固定点へ入る移動費用は通常どおり加算する。

## 費用と原文

根拠は [authoring #14](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14)。下の引用は原文、数式と数値は調整可能な実装仮説。

| 要素 | 原文・根拠 | 実装 |
|---|---|---|
| 指間距離 | [6031949062](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031949062)「指の距離だね。」 | 各手のパッド対の最大マンハッタン距離。既定4を超える生成候補は除外。左右の最大距離の合計×1を費用に |
| 両手の均等さ | [6031946064](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031946064)「両手で出来るだけ均等に使えるもののほうが刻むのは速い。」 | 左右の音数差×2。既定2対2は0、3対1は4 |
| 手の移動・テンポ | [6031922816](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031922816)「次のコードと移動量を考えて選んでる。」／[6031957946](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031957946)「手を動かすのは速いBPMに対応するのが難しい。」 | 左手→左手・右手→右手の最適1対1対応距離の合計×(BPM/120)^2。左右を交換して安く見積もらない |
| フォームの切替・形の保持 | [6031940436](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031940436)「そのフォームのままで弾けない」 | 手と度数の割当を変えた時+2。同じ割当でも厳密な平行移動でない形の変化+1 |
| 修飾・使用傾向 | [6031973162](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031973162)、[6031982826](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031982826) | 右R+b7のm7はusageCost=1×2（5度へのクロマチックアプローチがしにくい）。dom7は0（3度へのアプローチがしやすい）。実際の装飾音の幾何を推測せず、理由付きの使用傾向として持つ |
| 共通音 | PR27・HPS4 | 同pitchのserial移動数×4。v2では有限の費用。他の費用・先読みと交換可能。PR27の辞書式優先は元APIに残る |
| 先読み | [6031946064](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031946064)「常にコード進行を先読みしてるのよ。」 | 各コードの費用＋隣接移動費用の全進行最小。次のoverrideも前の選択に効く |
| 様式 | [6031957946](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031957946)「あえて、コンスタント・ストラクチャーで弾くのがいい場合もある」 | 指定区間に限り同じformId・度数ごとの位置差が全て同じという制約。勝手に区間を推測しない |

m7第1フォームはHPS4の手写真S08を確認した左R+5／右m3+b7。第2は原文で指定された左m3+5／右R+b7。手のまとまりと盤面の幾何は別で、同じ割当でも複数の実配置を持てる。厳密な形の保持は平行移動判定で区別する。指番号、指の自動割当は含まない。

## 手本での調整・様式

`PAD_POSITION_MODEL_V2`（data.js）の1オブジェクトへ、既定フォーム・理由・費用・距離上限・探索上限をまとめた。既定オブジェクトはdeep freeze。`options.model`にversion、weights、limits、referenceBpmを部分的に渡せる。formsを渡す場合は質ごとの辞書全体を置き換える。音数配分の違うフォームや別の質を手本として追加できる。

```js
const options = {
  bpm: 180,
  model: {
    version: 'reference-2026-10-07',
    limits: { maxHandDistance: 5 },
    weights: { formSwitch: 3 },
    // forms: { m7: [{id, left:[0,7], right:[3,10], usageCost:0, reason:'...'}, ...] }
  },
  constantStructure: [{ from: 2, to: 5 }], // 両端を含むstep index
};
```

様式の指定は既に渡された実音高の同形平行移動を選ぶだけ。コードを勝手にdom7化せず、音高も動かさない。フォーム・盤外・距離・overrideの条件が両立しなければ `style_conflict` 等で止まる。

既定の探索上限は512step・各step128候補。optionsから減らせるが増やせない。フォームのdegreeは各pitch classを1つずつ、0〜11、ルートを含む、左右に最低1音。音数はPR27と同じ10。無限・負の重み、不正BPM・window・styleは拒否する。上限で候補を間引かず `too_many_candidates` / `too_many_steps` を返す。

最初の失敗で止め、前の成功prefixの最小解と失敗stepだけを返す。失敗より後を解決済みとはしない。音数が変わる手本間の移動はPR27同様、少ない側を全対応・余りの費用0。この費用の採否は未決。

## 受け入れと限界

- (a) HPS4 Cm7→Fm7: `{60→72,63→78,65→80,68→86}`、共通音移動0。
- (b) Dm7 fixture: `{50→56,53→62,57→66,60→72}`（第1）→Em7 `[52,55,59,62]`は第2 `{52→61,55→64,59→71,62→77}`。生成候補の上限4で左距離5の近い第1形を除外。上限5に緩めると第1 `{52→58,55→64,59→71,62→74}`が勝つ（費用18→17）。
- **(b)の位置・音域は指示にないため、このfixtureは実装上の具体例。原演奏一致の証拠ではない。** 完全な平行移動は指間距離が不変。このfixtureで全音を近い同音異所へ置き直すと、指間距離が3→5になる。純粋な平行移動の不成立と、再配置後の届かなさを同一視しない。原演奏のDm7絶対位置・音域・手情報で後から照合する。
- (c) Cm7→Cm7→Ebm7 fixture: BPM60では移動12、BPM240では6（右R+b7形へ切替、positionも変わる）。
- (d) 同fixtureにfrom0/to2を指定すると同じ第1フォームの平行移動を選ぶ。
- 先読みfixture Cm7→Dbm7→Abm7: 貪欲37、全進行36。公開候補の全組合せを別計算した最小費用とも一致。
- PR27既存テストは変更なし。新APIは新しい費用の意味を持つ。

距離上限4とHPS4固定seedの片手距離5に差がある。固定seedは手本を優先しexceedsReachとして明示。上限がうりなみさんの届く距離を確定した値ではないことが分かる。別の手本で調整するまで、全キーでの実演精度・正解率は主張しない。

他の質のフォーム、ダブルストップ、実際の装飾音へのアプローチ評価、手本からの重み学習、音数変化の費用、他の演奏者への適合は未決。画像pilotの20レコードは未acceptedの観測資料で、この実装で採用済みに変更しない。独立sessionレビュー・consumer接続・音楽的採用・mergeは管理担当へ。
