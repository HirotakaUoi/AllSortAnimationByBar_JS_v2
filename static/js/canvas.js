/**
 * canvas.js  –  バーチャート描画ユーティリティ
 */

"use strict";

// ---------------------------------------------------------------------------
// カラーテーマ定義
// ---------------------------------------------------------------------------

const THEMES = [
  {
    key:  "dark",
    name: "ダーク",
    colorMap: {
      b:    "#4472C4",   // 青  : 通常
      r:    "#FF4444",   // 赤  : 注目
      y:    "#FFD700",   // 黄  : 比較対象
      g:    "#44AA44",   // 緑  : 確定済み
      gray: "#666688",   // 灰  : 無効 / 済み
      m:    "#FF69B4",   // マゼンタ : ピボット候補
      c:    "#20B2AA",   // シアン  : ピボット確定
    },
    valueLabelColor: "#ddd",
    indexLabelColor: "#667",
    lineColor:       "rgba(255,100,100,.75)",
    arrowColor:      "#FF4444",
    finishedOverlay: "rgba(0,0,0,.55)",
    finishedText:    "#FFD700",
  },
  {
    key:  "bright",
    name: "明るめ",
    colorMap: {
      b:    "#2a5bb8",
      r:    "#d93025",
      y:    "#c07000",
      g:    "#1a7a2a",
      gray: "#8888a0",
      m:    "#c2185b",
      c:    "#00838f",
    },
    valueLabelColor: "#334",
    indexLabelColor: "#99a",
    lineColor:       "rgba(200,50,50,.7)",
    arrowColor:      "#d93025",
    finishedOverlay: "rgba(255,255,255,.6)",
    finishedText:    "#1a3080",
  },
  {
    key:  "hc",
    name: "コントラスト強め",
    colorMap: {
      b:    "#00aaff",
      r:    "#ff2200",
      y:    "#ffff00",
      g:    "#00ff66",
      gray: "#888888",
      m:    "#ff00ff",
      c:    "#00ffff",
    },
    valueLabelColor: "#ffffff",
    indexLabelColor: "#aaaaaa",
    lineColor:       "rgba(255,60,60,.9)",
    arrowColor:      "#ff2200",
    finishedOverlay: "rgba(0,0,0,.7)",
    finishedText:    "#ffff00",
  },
  {
    key:  "hcbright",
    name: "コントラスト強め (明るめ)",
    colorMap: {
      b:    "#0055ee",   // 鮮やかな青
      r:    "#ee1100",   // 鮮やかな赤
      y:    "#bb7700",   // 濃いアンバー（白背景で黄は視認困難なため）
      g:    "#007700",   // 鮮やかな緑
      gray: "#666688",
      m:    "#cc0077",   // 鮮やかなマゼンタ
      c:    "#007799",   // 鮮やかなティール
    },
    valueLabelColor: "#111111",
    indexLabelColor: "#555566",
    lineColor:       "rgba(180,0,0,.8)",
    arrowColor:      "#ee1100",
    finishedOverlay: "rgba(255,255,255,.65)",
    finishedText:    "#003399",
  },
];

let _currentThemeKey = "dark";

/** 現在のテーマオブジェクトを返す */
function getCanvasTheme() {
  return THEMES.find(t => t.key === _currentThemeKey) ?? THEMES[0];
}

/** テーマを切り替える（app.js から呼ばれる） */
function setCanvasTheme(key) {
  _currentThemeKey = key;
}

// ---------------------------------------------------------------------------
// SortCanvas クラス
// ---------------------------------------------------------------------------

class SortCanvas {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {number} numItems  - バー本数
   * @param {number} dataMax   - 値の最大値
   */
  constructor(canvas, numItems, dataMax) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext("2d");
    this.numItems = numItems;
    this.dataMax  = dataMax;

    // 余白
    this.pad = { top: 28, bottom: 32, left: 6, right: 6 };
  }

  // ── レイアウト計算 ──────────────────────────────────────────
  get cw()          { return this.canvas.width; }
  get ch()          { return this.canvas.height; }
  get chartW()      { return this.cw - this.pad.left - this.pad.right; }
  get chartH()      { return this.ch - this.pad.top  - this.pad.bottom; }
  get barW()        { return this.chartW / this.numItems; }

  barLeft(idx)      { return this.pad.left + idx * this.barW; }
  barCenter(idx)    { return this.barLeft(idx) + this.barW / 2; }

  /** データ値 → キャンバス y 座標 (上端) */
  valToY(v) {
    return this.pad.top + this.chartH * (1 - v / this.dataMax);
  }
  /** データ値 → バー高さ (px) */
  valToH(v) {
    return this.chartH * v / this.dataMax;
  }

  // ── メイン描画 ──────────────────────────────────────────────
  /**
   * フレームを描画する
   * @param {object} frame  - sort_algorithms.py の make_frame() 結果
   * @returns {string[]}    - texts (テキストオーバーレイ用)
   */
  draw(frame) {
    const { data, color, arrows, texts, lines, finished } = frame;
    const ctx = this.ctx;
    const th  = getCanvasTheme();   // 現在のテーマ
    ctx.clearRect(0, 0, this.cw, this.ch);

    // ── バー ──
    const bw       = this.barW;
    const showLabel = bw >= 14;
    const showIdx   = bw >= 18;

    for (let i = 0; i < data.length; i++) {
      const x = this.barLeft(i);
      const y = this.valToY(data[i]);
      const h = this.valToH(data[i]);

      ctx.fillStyle = th.colorMap[color[i]] ?? th.colorMap.b;
      ctx.fillRect(x + 0.5, y, bw - 1, h);

      // 値ラベル（バー上）
      if (showLabel) {
        const fs = Math.min(11, bw * 0.65);
        ctx.fillStyle = th.valueLabelColor;
        ctx.font      = `${fs}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(data[i], x + bw / 2, y - 2);
      }
    }

    // インデックスラベル（バー下）
    if (showIdx) {
      ctx.fillStyle = th.indexLabelColor;
      const fs = Math.min(9, bw * 0.55);
      ctx.font      = `${fs}px sans-serif`;
      ctx.textAlign = "center";
      for (let i = 0; i < data.length; i++) {
        ctx.fillText(i, this.barLeft(i) + bw / 2,
                     this.ch - this.pad.bottom + 13);
      }
    }

    // ── 水平線（ピボット基準線など） ──
    for (const [value, start, end] of lines) {
      const y  = this.valToY(value);
      const x1 = this.barLeft(start);
      const x2 = this.barLeft(end + 1);
      ctx.save();
      ctx.strokeStyle = th.lineColor;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
      ctx.restore();
    }

    // ── 矢印 ──
    const baseY = this.ch - this.pad.bottom + 8;
    for (const [s, e] of arrows) {
      this._drawArrow(s, e, baseY, th.arrowColor);
    }

    // ── 完了オーバーレイ ──
    if (finished) {
      ctx.fillStyle = th.finishedOverlay;
      ctx.fillRect(0, 0, this.cw, this.ch);
      ctx.fillStyle = th.finishedText;
      ctx.font      = `bold ${Math.min(48, this.cw / 8)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("完了!", this.cw / 2, this.ch / 2 + 14);
    }

    return texts;
  }

  // ── 矢印描画（二方向） ──────────────────────────────────────
  _drawArrow(s, e, baseY, arrowColor = "#FF4444") {
    if (s === e) return;
    const ctx = this.ctx;
    const x1  = this.barCenter(s);
    const x2  = this.barCenter(e);
    const dx  = x2 - x1;
    const arc = Math.min(28, Math.abs(dx) * 0.45 + 4);
    const cx  = (x1 + x2) / 2;
    const cy  = baseY + arc;

    ctx.save();
    ctx.strokeStyle = arrowColor;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(x1, baseY);
    ctx.quadraticCurveTo(cx, cy, x2, baseY);
    ctx.stroke();

    // 矢印の向き: 両端に三角
    this._arrowHead(x2, baseY, cx, cy, "end",   arrowColor);
    this._arrowHead(x1, baseY, cx, cy, "start", arrowColor);
    ctx.restore();
  }

  /**
   * 2次ベジェ曲線の端点における接線方向を計算し矢じりを描く
   * @param {number} tx - 矢じり先端 x
   * @param {number} ty - 矢じり先端 y
   * @param {number} cx - 制御点 x
   * @param {number} cy - 制御点 y
   * @param {"start"|"end"} which
   * @param {string} arrowColor
   */
  _arrowHead(tx, ty, cx, cy, which, arrowColor = "#FF4444") {
    const ctx = this.ctx;
    // 接線方向: 端点から制御点へのベクトル
    let tangX = which === "end" ? tx - cx : cx - tx;
    let tangY = which === "end" ? ty - cy : cy - ty;
    const len  = Math.hypot(tangX, tangY) || 1;
    tangX /= len; tangY /= len;

    const sz = 7;
    const ang = Math.PI / 6;
    ctx.fillStyle = arrowColor;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(
      tx - sz * (tangX * Math.cos(ang)  - tangY * Math.sin(ang)),
      ty - sz * (tangX * Math.sin(ang)  + tangY * Math.cos(ang))
    );
    ctx.lineTo(
      tx - sz * (tangX * Math.cos(-ang) - tangY * Math.sin(-ang)),
      ty - sz * (tangX * Math.sin(-ang) + tangY * Math.cos(-ang))
    );
    ctx.closePath();
    ctx.fill();
  }
}
