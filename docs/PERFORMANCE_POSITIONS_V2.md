# 押さえ方の計算 第2版

うりなみさんの手本を使って、前後のコードを見ながら押す位置を選ぶ純粋関数。実音高、オクターブ、盤面は変更しない。教材側が指定したseed・overrideは固定する。度数のまとまりと、原文で確定した手の割当は計算用の内部データ。フォーム1の左右の手はunknownで、指の指定は行わない。

PR #27 の `padChooseNearestPositions` / `padResolveNearestSequence` は変更しない。第2版は呼び出し側が明示して使う。semantic-apiへの追加、DOJO・64PE・Authoringへの接続は含めない。

## API

```js
const steps = [
  { root: 0, quality: 'm7', pitches: [60, 63, 67, 70],
    explicit: [
      { pitch: 60, serial: 72 }, { pitch: 63, serial: 78 },
      { pitch: 67, serial: 85 }, { pitch: 70, serial: 88 },
    ], formId: 'right-root-seventh' },
  { root: 5, quality: 'm7', pitches: [60, 63, 65, 68] },
];
const result = padResolvePerformanceSequence(steps, { bpm: 120 });
// 次: {60→72, 63→78, 65→80, 68→86}
const alternatives = padEnumPerformancePositions(steps[1]);
```

`root`はpitch class 0〜11。コード名を推測しない。`quality`の既定は `m7` と `dom7`。各度数に実MIDIが1つずつ必要。同じ度数の重複オクターブ、shell、ダブルストップ、未登録の質は失敗する。重複する同じ実pitchはPR27と同じく1音に畳む。音を減らして成功とはしない。

`padEnumPerformancePositions(step, options)`は全候補、距離・幾何で除外した数（`rejectedByReach` / `rejectedByGeometry`、両理由での重複あり）を返す。候補は `{bindings, formId, internal:{groups,hands,reason,fixed}, metrics}`。`bindings`に手や指を混ぜない。候補の順はpitch順serialの辞書式、次にformIdで決定的。費用順の第1候補ではない。

`padResolvePerformanceSequence(steps, options)`は `{ok, results, totalCost, modelVersion, bpm}`。resultsはindex、source（seed / override / performance）、bindings、内部フォーム、費用の内訳・累積を持つ。有限状態の動的計画法で全区間の費用最小を求める。進行の最後まで列挙された候補を使い、近い数候補へ切り捨てない。同費用は候補の固定順で解決する。

先頭はexplicit必須。途中explicitはoverride。音高集合を完全に覆い、serialがその実pitchを鳴らす必要がある。explicitの位置・formIdを変更しない。explicitでformIdを省略した時は、盤面の幾何に合う最初のフォームを使う（合うものがなければ最初の手本を固定）。明示したformIdは維持し、幾何と矛盾した時は `metrics.matchesGeometry:false`。距離上限を超えるexplicitも固定し `exceedsReach:true` を返す。その位置を動かすのではなく、既定モデルと手本の差として扱う。固定点のintrinsicCostは0、固定点へ入る移動費用は通常どおり加算する。

## 費用と原文

根拠は [authoring #14](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14)。下の引用は原文、数式と数値は調整可能な実装仮説。

| 要素 | 原文・根拠 | 実装 |
|---|---|---|
| 指間距離 | [6031949062](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031949062)「指の距離だね。」 | 同じまとまりの中のパッド対の最大マンハッタン距離。既定4を超える生成候補は除外。2つのまとまりの距離合計×1を費用に。既定4は初期仮説で、Cm7の両手本はそれぞれ2+2で通る |
| 両手の均等さ | [6031946064](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031946064)「両手で出来るだけ均等に使えるもののほうが刻むのは速い。」 | 左右の音数差×2。既定2対2は0、3対1は4 |
| 手の移動・テンポ | [6031922816](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031922816)「次のコードと移動量を考えて選んでる。」／[6031957946](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031957946)「手を動かすのは速いBPMに対応するのが難しい。」／[6035035879](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6035035879)「そう。同じ弾き方だと左に移動する必要があるからね。」 | 両端の左右が確定していれば左→左・右→右。unknownを含む場合は同じ役割のまとまり同士の最適対応を代理費用とする。大きな移動を重くする下記の式×movement重み×(BPM/120)^2。`transition.movementBasis`で区別し、左右を推定しない |
| フォームの切替・形の保持 | [6031940436](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031940436)「そのフォームのままで弾けない」 | formIdを変えた時+2。同じフォームでも厳密な平行移動でない形の変化+1 |
| 修飾・使用傾向 | [6031973162](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031973162)、[6031982826](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031982826) | 右R+b7のm7はusageCost=1×2（5度へのクロマチックアプローチがしにくい）。dom7は0（3度へのアプローチがしやすい）。実際の装飾音の幾何を推測せず、理由付きの使用傾向として持つ |
| 共通音 | PR27・HPS4 | 同pitchのserial移動数×4。v2では有限の費用。他の費用・先読みと交換可能。PR27の辞書式優先は元APIに残る |
| 先読み | [6031946064](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031946064)「常にコード進行を先読みしてるのよ。」 | 各コードの費用＋隣接移動費用の全進行最小。次のoverrideも前の選択に効く |
| 様式 | [6031957946](https://github.com/pad-sensei/64-pad-visualizer-authoring/issues/14#issuecomment-6031957946)「あえて、コンスタント・ストラクチャーで弾くのがいい場合もある」 | 指定区間に限り同じformId・度数ごとの位置差が全て同じという制約。勝手に区間を推測しない |

### 大きな移動より近くでのフォーム切替

最新原文6035035879に従い、同じ形を保つための大きな手の移動より近くでのフォーム切替を選ぶ。線形合計では大移動の負担が切替・使用傾向の費用と相殺され、Dm7→Em7が20対20だったため、移動の大きさに応じて負担を増す。

各手（unknown時は同じ役割のまとまり）の最適対応距離合計を`d`、対応音数を`n`、1音平均を`x=d/n`とし、`effort=d×max(1,x)^(p−1)`。対応音が0なら0。既定の`movementExponent=p=2`では1パッド以下は従来の線形、1パッドを超える移動は二乗で重くする。各まとまりで別計算して合計し、一方の大移動を全体平均で薄めない。音数が異なる時は既存同様、少ない側の対応音数を使い余りは費用0。

距離単位1を基準に、線形より大移動を重くする最小の多項式という**実装前に定めた初期仮説**。原文が指数2を指定したわけではない。キー・方向・盤端・formId・特定のserialで分岐せず、既存の全重み・距離上限・BPM係数は変えない。`p=1`で旧線形へ戻せる。任意の重み設定でも常に切替を強制する制約ではなく、様式指定は従来どおり同形平行移動を優先する。

`transition.movement`は従来の生の距離合計、`movementEffort`は上式の負担合計。`movementGroups`に各手／まとまりの`distance, matched, meanDistance, effort`、`costs.movement`に重み・BPM適用後の移動費用を返す。

## 訂正された2フォーム

管理側の旧指示がHPS4をフォーム1と取り違えたため、旧 `paired-fifths`（左R+5／右m3+b7）は削除した。第2版Draft内の訂正で、PR27のAPIには影響しない。

| フォーム | Cm7の手本（pitch→serial） | 内部のまとまり・手 |
|---|---|---|
| 1 `root-seventh-third-fifth-right` | `{60→72,63→75,67→82,70→88}` | R+b7、右側のm3+5。両まとまりのhandはunknown、hands.left/rightはnull |
| 2 `right-root-seventh`（HPS4） | `{60→72,63→78,67→85,70→88}` | 右手R+b7、左手m3+5 |

`data.js`の`groups`は`root-seventh`（0,10）・`third-fifth`（3,7）で、`reference`に両手本を持つ。距離はこの対の中で測り、別のまとまりの音を混ぜない。`metrics.groupSpans`はunknownでも計算でき、左右未指定の`leftSpan/rightSpan`はnull。

2フォームの区別は度数配分だけではできない。`geometry`でm3+5の平均列がR+b7の平均列より右／左かを判定する。これは手本の向きを一般化した**幾何分類の初期仮説**。平均列が同じ転回配置は両フォームに属し得る。指定手本のそのままの再生成とHPS4→Fm7は検証するが、全転回での演奏正解を確定しない。explicitは距離・幾何の例外として位置とformIdを保つ。

指番号・指の自動割当・フォーム1の左右推定は含まない。

## 手本での調整・様式

`PAD_POSITION_MODEL_V2`（data.js）の1オブジェクトへ、既定フォーム・理由・費用・距離上限・探索上限をまとめた。既定オブジェクトはdeep freeze。`options.model`にversion、weights、limits、referenceBpm、movementExponent（有限の1以上）を部分的に渡せる。formsを渡す場合は質ごとの辞書全体を置き換える。音数配分の違うフォームや別の質を手本として追加できる。

```js
const options = {
  bpm: 180,
  model: {
    version: 'reference-2026-10-07',
    limits: { maxHandDistance: 5 },
    weights: { formSwitch: 3 },
    // forms: { m7: [{id, groups:[{id:'root-seventh', degrees:[0,10], hand:'unknown'},
    //   {id:'third-fifth', degrees:[3,7], hand:'unknown'}], usageCost:0, reason:'...'}, ...] }
  },
  constantStructure: [{ from: 2, to: 5 }], // 両端を含むstep index
};
```

様式の指定は既に渡された実音高の同形平行移動を選ぶだけ。コードを勝手にdom7化せず、音高も動かさない。フォーム・盤外・距離・overrideの条件が両立しなければ `style_conflict` 等で止まる。

既定の探索上限は512step・各step128候補。optionsから減らせるが増やせない。フォームのdegreeは各pitch classを1つずつ、0〜11、ルートを含む、2つのまとまりに最低1音。手本追加用の旧`left/right`形式も受ける。unknownを含む異なる手本間はgroup idが対応しなければ代理移動を推測せず`cost_overflow`で止まる。音数はPR27と同じ10。無限・負の重み、不正BPM・window・styleは拒否する。上限で候補を間引かず `too_many_candidates` / `too_many_steps` を返す。

最初の失敗で止め、前の成功prefixの最小解と失敗stepだけを返す。失敗より後を解決済みとはしない。音数が変わる手本間の移動はPR27同様、少ない側を全対応・余りの費用0。この費用の採否は未決。

## 受け入れと限界

- 両Cm7手本は通常候補として再生成でき、同じまとまりの中の距離は2ずつ。上限2でも通る。既定上限4・全重みは変更していない。
- (a) HPS4 Cm7→Fm7: `{60→72,63→78,65→80,68→86}`、共通音移動0。転回したFm7では平均列が等しく、選択formIdはフォーム1、手はunknown。位置の一致と手の確定は分ける。
- (b) **期待値を先に指定**: Cm7フォーム1を2行下へ平行移動したDm7 `{50→56,53→59,57→66,60→72}` →Em7 `[52,55,59,62]` でフォーム2へ。計算結果は `{52→58,55→64,59→71,62→74}`。
- (b)は切替48、フォーム1維持68という厳密な費用差。維持の平行移動 `{52→61,55→64,59→71,62→77}` は両対が(row+1,col−3)、平均距離4ずつなので移動負担64。切替はR+b7がcol+2、m3+5が(row+1,col−3)、平均距離2と4なので負担40。両候補の指間距離費用4は等しく、切替2・使用傾向2を残しても、移動費用差24がその計4を超える。切替48はフォーム1の全候補より小さく、serial順に依存しない。指数だけを1へ戻すと旧20対20を再現する。
- Dm7の近いcol+2の平行移動はm3がcol9で盤外で、フォーム1を保つにはrow+1/col−3で左へ大きく移動する。最新確認6035035879に従い、その移動より近くでのフォーム切替を選ぶ。対内の指間距離による禁止とは扱わない。Dm7の音域・絶対位置は今回明示したfixtureであり、原演奏の確定値ではない。
- (c) **性質の確認**: Cm7→Cm7→Ebm7でBPM60→240は移動12→10。高BPMで移動を抑え、両結果が公開候補総当たりの最小費用に一致する。出力serialは演奏の独立正解にしていない。
- (d) 指定区間では同じフォームの平行移動。Cm7→Ebm7の期待は盤面の(row+1,col-2)、serial+6から先に計算する。
- **性質の確認**: Cm7→Dm7→Em7の全進行の費用は貪欲より小さい。fixtureの選定は実装探索由来。総当たりは公開候補を用い、費用を座標から別計算するためDPのoracleであり、候補集合・演奏の正解を証明しない。
- PR27既存テストは変更なし。新APIは新しい費用の意味を持つ。

数値上限・重み・平均列分類・unknown時の代理移動は実装仮説。全キーの実演精度・正解率は主張しない。他の質のフォーム、ダブルストップ、装飾音へのアプローチ評価、手本からの重み学習、音数変化の費用、他の演奏者への適合は未決。画像pilotの20レコードは未acceptedの観測資料で、この実装で採用済みに変更しない。独立session再レビュー・consumer接続・音楽的採用・mergeは管理担当へ。
