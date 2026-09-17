# machikane26-mindar-poc

まちかね祭2026 AR班の **MindAR.js 技術検証専用PoC**。既存 `murozono-aiki/ar-demo` とは別リポジトリで、参考マーカーのみ検証用に使用する。

## 今回の担当で確認すること
- 画像マーカーの検出精度・安定性（found/lost回数、連続ロック時間）
- 複数画像ターゲットの識別
- マーカーと端末カメラの相対位置・姿勢を取得できるか
- 床観測孔 / フィルターカード / 窓ポスターへ展開できるか
- iOS/Androidのブラウザ差

## 技術構成
Vite + Vanilla TypeScript + MindAR.js + Three.js。MindAR anchor の `THREE.Group` からカメラ相対の変換行列を計算し、xyz・回転・距離をHUDに表示する。

**注意:** MindARの座標は画像ターゲット幅を1とする正規化空間として扱う。実距離そのものではない。印刷したマーカー幅(mm)を入力すると `distance × markerWidth` の概算値を表示するが、採用前に実測比較して誤差評価する。

## 実機テスト
1. `npm run dev -- --host 127.0.0.1`
2. PC上でTailscale HTTPS公開
3. スマホも同じTailnetへ接続しHTTPS URLを開く
4. カメラ許可 → `AR開始`
5. 参考マーカーを距離・角度・照度を変えて認識させる
6. `CSV保存` でログを回収
### 最低限の試験マトリクス
各マーカーで正面 20/40/60/100cm、左右30°/45°、暗所/通常/逆光、部分遮蔽25%を各3回。found/lostと連続ロック時間を記録する。

## 参考データ
`public/reference/` は `murozono-aiki/ar-demo` の4画像と既生成 `ar-images.mind` を技術比較のために使用。最終マーカーは本企画用に別途生成する。

## 依存導入メモ
彗のPCは Node 24.18.0。`mind-ar@1.2.5` の間接依存 `canvas@2.11.2` はNode 24 Windows向けprebuiltがなく通常installが失敗したため、PoCでは `npm install --ignore-scripts` でブラウザ用依存を導入した。ブラウザ実行に不要なネイティブcanvasのinstall script回避であり、最終採用時はNode LTS固定などを検討する。
## 現在のTailnet検証URL
- AR PoC: `https://pc.tail260870.ts.net/`
- 参考マーカー表示: `https://pc.tail260870.ts.net/markers.html`

参考マーカー0〜2はFilter処理経路の実証用に BLUE / RED / GREEN へ仮マッピングしている。認識すると `currentFilter` を更新し、マーカーを外しても保持する。本番Filterカードの画像が確定したら `.mind` を差し替えて同じ試験を再実施する。