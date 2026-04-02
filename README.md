# ソートアルゴリズム アニメーション (Sort Algorithm Animator)

ブラウザ上でソートアルゴリズムの動作をリアルタイムにアニメーション表示する Web アプリケーションです。
複数のアルゴリズムを同時に並べて比較できます。

**デモ (Live Demo):** https://allsortanimationbybar-js.onrender.com/

---

## 特徴

- **12 種類のアルゴリズム**をリアルタイムでアニメーション
- **複数パネル同時表示** — アルゴリズムを横並びで比較
- **パネルサイズをドラッグで自由変更** (CSS `resize`)
- **全パネル一括設定** — データ数・初期状態・速度を一発で統一
- **サイズ統一ボタン** — 左上のパネルに全パネルのサイズを揃える
- FastAPI + WebSocket によるサーバープッシュ型フレーム配信
- Canvas 2D API による描画（矢印・補助線・ハイライトなど）

---

## 対応アルゴリズム

| # | アルゴリズム |
|---|---|
| 1 | バブルソート |
| 2 | 選択ソート |
| 3 | 挿入ソート |
| 4 | シェルソート |
| 5 | クイックソート |
| 6 | クイックソート（3 点中央値） |
| 7 | クイックソート（ランダム選択） |
| 8 | バイトニックソート |
| 9 | 並列バイトニックソート |
| 10 | コムソート |
| 11 | ノームソート |
| 12 | パンケーキソート |

---

## 使い方

### 基本操作

1. ページを開くと初期パネルが 1 つ表示されます。
2. **アルゴリズム / データ数 / 初期状態** をセレクトで選択します。
3. **速度スライダー** で再生速度を調整します（右ほど速い）。
4. **▶ 開始** ボタンでアニメーションを開始します。
5. アニメーション中は **⏸ 一時停止 / ⏹ 停止 / ↺ リセット** が使えます。

### 複数パネルの活用

| 操作 | 説明 |
|---|---|
| **＋ パネル追加** | パネルを追加してアルゴリズムを増やす |
| **▶▶ 全開始** | 全パネルのアニメーションを一斉に開始 |
| **⏹ 全停止** | 全パネルを一斉に停止 |
| **⊞ サイズ統一** | 左上のパネルサイズに全パネルを揃える |
| **↕ 全パネルへ適用** | 「全パネル一括」欄の設定を全パネルへ反映 |
| パネル角をドラッグ | 個別パネルのサイズを自由に変更 |

### 初期状態の種類

| 設定値 | 意味 |
|---|---|
| ランダム | 値がバラバラに並んだ配列 |
| 昇順 | あらかじめ整列済み |
| 降順 | 逆順に整列済み |
| ほぼ昇順 | 昇順にわずかなランダム交換を加えた配列 |
| ステップ値 | 離散的な値で構成された配列 |

---

## ローカルで動かす

### 必要環境

- Python 3.10 以上
- pip

### インストール & 起動

```bash
git clone https://github.com/HirotakaUoi/AllSortAnimationByBar_JS.git
cd AllSortAnimationByBar_JS
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

ブラウザで http://localhost:8000 を開いてください。

---

## ファイル構成

```
AllSortAnimationByBar_JS/
├── main.py                  # FastAPI アプリ (REST API + WebSocket)
├── sort_algorithms.py       # 12 種のソートアルゴリズム (ジェネレータ形式)
├── requirements.txt         # Python 依存パッケージ
├── render.yaml              # Render デプロイ設定
└── static/
    ├── index.html           # メイン HTML
    ├── css/
    │   └── style.css        # ダークテーマ UI スタイル
    └── js/
        ├── canvas.js        # SortCanvas クラス (Canvas 2D 描画)
        ├── ws_client.js     # AnimationClient クラス (WebSocket ラッパー)
        └── app.js           # SortPanel クラス + パネル管理ロジック
```

---

## 技術構成

| レイヤー | 技術 |
|---|---|
| バックエンド | Python / FastAPI / uvicorn |
| リアルタイム通信 | WebSocket (JSON フレーム) |
| フロントエンド | Vanilla JS (ES2022) |
| 描画 | Canvas 2D API |
| レスポンシブ対応 | ResizeObserver / CSS `resize: both` |
| デプロイ | Render (GitHub 連携による自動デプロイ) |

### WebSocket フレーム形式

各ソートステップは以下の JSON として送信されます。

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

| フィールド | 内容 |
|---|---|
| `data` | 現在の配列値 |
| `color` | 各バーの色 (`b`=青 / `r`=赤 / `y`=黄 / `g`=緑 / `gray` / `m`=マゼンタ / `c`=シアン) |
| `arrows` | 比較・交換を示す矢印のインデックスペア |
| `texts` | オーバーレイ表示テキスト |
| `lines` | 水平補助線 |
| `bars` | ハイライト対象のバーインデックス |
| `finished` | ソート完了フラグ |

---

## Render へのデプロイ

`render.yaml` が含まれているため、Render と GitHub リポジトリを連携するだけで自動デプロイが有効になります。

1. [Render](https://render.com) にサインイン
2. **New > Web Service** でこのリポジトリを選択
3. `render.yaml` の設定が自動適用されます
4. 以後は `main` ブランチへの `git push` で自動再デプロイ

---

## ライセンス

MIT License
