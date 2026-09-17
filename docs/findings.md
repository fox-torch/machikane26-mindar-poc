# MindAR.js 担当 調査・検証結果

## 担当タスク
AR班ミーティングの担当事項は、MindAR.jsについて **マーカー認識精度** と **マーカーと端末の位置関係を取得できるか** の確認。

## 現時点で確認できたこと
- MindAR.js 1.2.5 は複数画像を1つの `.mind` に含め、target indexで識別できる。
- Three.js版では `addAnchor(index)` で各画像ターゲットの `THREE.Group` を取得できる。
- `onTargetFound` / `onTargetLost` で認識開始・消失を記録できる。
- AnchorとCameraの変換行列から、カメラに対する相対xyz・回転を計算できる。
- 座標スケールは実測mではなく画像ターゲット基準なので、実距離利用には既知印刷幅を使った校正と誤差測定が必要。

## フィルターカード案
BLUE / RED / GREEN等のカードも画像ターゲットとして `.mind` に登録する。target indexをFilter名へマップし、`onTargetFound` 時にARローカルの `currentFilter` を更新、その後 `FILTER_CHANGED` としてServerへ同期する。本番カードは高コントラスト・特徴点が多い・左右非対称なデザインにする。

## PoCで既に実装済み
- 4ターゲット定義とtarget index識別
- found/lost回数、連続ロック時間
- カメラ相対xyz・回転
- target-width単位の距離と既知マーカー幅からの概算mm
- CSVログ保存
- Tailscale Serveによるスマホ用HTTPS公開

## 実機で残る検証
1. 正面20/40/60/100cm、左右30°/45°を各3回
2. 通常照明・暗所・逆光、25%程度の部分遮蔽
3. iPhone / Android比較
4. 本番想定のターゲット数（床8 + Filter + Poster4）での速度
5. 窓ポスターの逆光環境

## 採用判断
認識率だけでなく、再認識時間、誤認、連続ロック中のfound/lost回数、相対姿勢値の揺れを比較する。最終カード・床孔・ポスター画像確定前は精度を確定値として扱わない。