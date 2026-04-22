# ソートアルゴリズム アニメーション v2

v1 の比較フレーム省略バグを修正したバージョン。全サイズで比較フレームを出力し、
アニメーション完了時間が計算量のオーダーを正しく反映する。

## 起動

```bash
uvicorn main:app --reload --port 8002
```

ブラウザ: http://localhost:8002

## デモ

https://allsortanimationbybar-js-v2.onrender.com/

## v1 との違い

v1 では `n > 100` のとき比較ステップのフレームを省略していた。
v2 ではすべてのサイズで比較フレームを出力するため、アニメーション完了時間が
計算量のオーダーを正しく反映する。

## 対応アルゴリズム（12種）

バブル / 選択 / 挿入 / シェル /
クイック(通常・3点中央値・ランダム) /
バイトニック / 並列バイトニック / コム / ノーム / パンケーキ

## ファイル構成

```
main.py              # FastAPI + WebSocket エンドポイント
sort_algorithms.py   # 12種のソートアルゴリズム（ジェネレータ形式）
requirements.txt
render.yaml          # Render 自動デプロイ設定
static/
  index.html
  css/style.css
  js/
    canvas.js        # SortCanvas クラス（Canvas 2D 描画）
    ws_client.js     # AnimationClient（WebSocket ラッパー）
    app.js           # SortPanel クラス + パネル管理
```

## アーキテクチャ

```
[Browser] ←─ WebSocket ─→ [FastAPI / main.py] ←─ import ─→ [sort_algorithms.py]
  app.js                    /api/start                         generator関数群
  canvas.js                 /ws/{session_id}
```

## WebSocket フレーム形式（v1 と同じ）

```json
{
  "data":     [42, 17, 95, ...],
  "color":    ["b", "r", "g", ...],
  "arrows":   [[i, j], ...],
  "texts":    ["pivot=42", ...],
  "lines":    [{"x": 3, "color": "gray"}, ...],
  "bars":     [2, 5],
  "finished": false
}
```

## アルゴリズム追加手順

1. `sort_algorithms.py` にジェネレータ関数を実装
2. `main.py` の `ALGORITHMS` リストに登録
