# machikane26-mindar-poc

MindAR.js と Three.js を使った、ブラウザ上で動作する画像マーカー認識の検証プログラムです。

複数の画像ターゲットを認識し、各ターゲットの検出状態、カメラとの相対位置・姿勢、距離の概算値を画面上に表示できます。また、認識結果をCSVとして保存できます。

## 主な機能

- 複数画像ターゲットの個別認識
- `onTargetFound` / `onTargetLost` による検出・消失の記録
- カメラに対する相対位置 `x / y / z` の取得
- 相対回転角 `Y / X / Z` の取得
- ターゲット幅を基準とした相対距離の取得
- 実際のマーカー幅を入力した場合の概算距離表示
- 複数ターゲット同時追跡
- 認識・姿勢データのCSV保存
- 画像ターゲットごとの簡易状態マッピング

## 技術構成

- Vite
- Vanilla TypeScript
- MindAR.js
- Three.js

MindAR.js の画像ターゲットを `addAnchor(index)` でThree.jsのアンカーへ対応付け、アンカーとカメラの変換行列から相対位置・回転を算出しています。

距離は画像ターゲット幅を基準とした正規化値です。マーカーの実幅を入力すると、その値を使って概算mmへ変換します。

## 起動

```bash
npm install
npm run dev
```

ブラウザで表示されたURLを開き、カメラアクセスを許可して `AR開始` を押します。

## CSV出力

`CSV保存` を押すと、認識ログをCSVとして保存します。主な列は以下です。

- timestamp
- event
- target
- current_filter
- x / y / z
- distance_target_width
- estimated_mm
- rotation_y_deg / rotation_x_deg / rotation_z_deg

## ビルド

```bash
npm run build
```

`dist/` に静的ファイルが生成されます。
