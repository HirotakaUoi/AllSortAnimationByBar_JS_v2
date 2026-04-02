/**
 * app.js  –  パネル管理・メインアプリケーション
 *
 * 各パネルは独立した WebSocket 接続を持ち、
 * 複数パネルを同時に実行できる。
 */

"use strict";

// ===== グローバル状態 ==============================================
let algorithms  = [];    // [{ id, name }, ...]
let dataSizes   = [];    // [16, 32, ...]
let conditions  = [];    // [{ id, name }, ...]
let panelSeq    = 0;     // パネル ID 採番

// ===== 起動 ========================================================
window.addEventListener("DOMContentLoaded", async () => {
  await loadMeta();
  _setupGlobalControls();
  document.getElementById("btn-add-panel") .addEventListener("click", addPanel);
  document.getElementById("btn-start-all") .addEventListener("click", startAll);
  document.getElementById("btn-stop-all")  .addEventListener("click", stopAll);
  document.getElementById("btn-sync-size") .addEventListener("click", syncSize);
  document.getElementById("btn-apply-global").addEventListener("click", applyGlobalToAll);
  addPanel(); // 初期パネルを1つ表示
});

async function loadMeta() {
  const [alRes, dsRes, cRes] = await Promise.all([
    fetch("/api/algorithms"),
    fetch("/api/datasizes"),
    fetch("/api/conditions"),
  ]);
  algorithms = await alRes.json();
  dataSizes  = await dsRes.json();
  conditions = await cRes.json();
}

// ===== 全パネル一括設定 ============================================

function _setupGlobalControls() {
  // セレクトを動的生成
  const gSize = document.getElementById("global-size");
  dataSizes.forEach(s => gSize.appendChild(new Option(String(s), s)));
  gSize.value = 32;

  const gCond = document.getElementById("global-cond");
  conditions.forEach(c => gCond.appendChild(new Option(c.name, c.id)));

  // 速度スライダーのラベル更新
  const gSpeed    = document.getElementById("global-speed");
  const gSpeedVal = document.getElementById("global-speed-val");
  gSpeed.addEventListener("input", () => {
    const v    = Number(gSpeed.value);
    const mult = Math.round(v / 80 * 10) / 10;
    gSpeedVal.textContent = `×${mult.toFixed(1)}`;
  });
}

/** 全パネルへグローバル設定を適用（ボタン押下時） */
function applyGlobalToAll() {
  const size      = document.getElementById("global-size").value;
  const cond      = document.getElementById("global-cond").value;
  const speedSlider = Number(document.getElementById("global-speed").value);

  document.querySelectorAll(".panel").forEach(el => {
    const panel = el._panel;
    if (!panel) return;

    // 速度は実行中でも変更可
    el.querySelector(".rng-speed").value = speedSlider;
    panel._applySpeed(speedSlider);

    // データ数・初期状態は非実行中のみ
    if (!panel.isRunning) {
      el.querySelector(".sel-size").value = size;
      el.querySelector(".sel-cond").value = cond;
      panel._drawPreview();
    }
  });
}

// ===== サイズ統一 ==================================================

/** 左上のパネルサイズに全パネルを揃える */
function syncSize() {
  const panels = [...document.querySelectorAll(".panel")];
  if (panels.length < 2) return;
  const first = panels[0];
  const w = first.offsetWidth;
  const h = first.offsetHeight;
  panels.slice(1).forEach(el => {
    el.style.width  = w + "px";
    el.style.height = h + "px";
  });
}

// ===== パネル追加 ==================================================
function addPanel() {
  const id    = ++panelSeq;
  const panel = new SortPanel(id);
  panel.mount(document.getElementById("panels-container"));
}

// ===== 全開始 / 全停止 =============================================
function startAll() {
  document.querySelectorAll(".panel").forEach((el) => {
    const panel = el._panel;
    if (panel && !panel.isRunning) panel.start();
  });
}
function stopAll() {
  document.querySelectorAll(".panel").forEach((el) => {
    const p = el._panel;
    if (p && p.isRunning) p.stop();
  });
}

// ===================================================================
// SortPanel クラス
// ===================================================================
class SortPanel {
  constructor(id) {
    this.id        = id;
    this.sessionId = null;
    this.client    = null;
    this.sortCanvas= null;
    this.el        = null;
    this.isRunning = false;
    this.isPaused  = false;
    this.numItems  = 0;
    this.dataMax   = 0;
  }

  // ── DOM 構築 ────────────────────────────────────────────────────
  mount(container) {
    const el = document.createElement("div");
    el.className  = "panel";
    el._panel     = this;
    el.id         = `panel-${this.id}`;
    el.innerHTML  = this._template();
    container.appendChild(el);
    this.el = el;
    this._bind();
    this._populateSelects();
    // DOM レイアウト確定後にプレビュー描画
    requestAnimationFrame(() => this._drawPreview());
    return el;
  }

  _template() {
    return `
      <div class="panel-header">
        <span class="panel-title">パネル ${this.id}</span>
        <button class="panel-close" title="削除">✕</button>
      </div>

      <!-- パラメタ行 -->
      <div class="params-row">
        <label>アルゴリズム
          <select class="sel-algo"></select>
        </label>
      </div>
      <div class="params-row">
        <label>データ数
          <select class="sel-size"></select>
        </label>
        <label>初期状態
          <select class="sel-cond"></select>
        </label>
        <div class="speed-group">
          <label>速度</label>
          <input type="range" class="rng-speed" min="1" max="200" value="80"
                 title="大きいほど速い">
          <span class="speed-value">×1.0</span>
        </div>
      </div>

      <!-- コントロールボタン -->
      <div class="controls-row">
        <button class="btn btn-primary  btn-start">▶ 開始</button>
        <button class="btn btn-warning  btn-pause" disabled>⏸ 一時停止</button>
        <button class="btn btn-danger   btn-stop"  disabled>⏹ 停止</button>
        <button class="btn btn-secondary btn-reset" disabled>↺ リセット</button>
      </div>

      <!-- キャンバス -->
      <div class="canvas-wrapper">
        <canvas class="sort-canvas"></canvas>
      </div>

      <!-- テキストオーバーレイ -->
      <div class="text-overlay">（開始ボタンを押してください）</div>

      <!-- ステータス -->
      <div class="status-bar">
        <span class="status-algo">-</span>
        <span class="status-state">待機中</span>
        <span class="status-frames">フレーム: 0</span>
      </div>
    `;
  }

  // ── セレクトを動的に生成 ─────────────────────────────────────
  _populateSelects() {
    const selAlgo = this.el.querySelector(".sel-algo");
    algorithms.forEach(a => {
      const opt = new Option(a.name, a.id);
      selAlgo.appendChild(opt);
    });
    // デフォルト: パネルIDに応じてアルゴリズムを分散
    selAlgo.value = (this.id - 1) % algorithms.length;

    const selSize = this.el.querySelector(".sel-size");
    dataSizes.forEach(s => {
      const opt = new Option(String(s), s);
      selSize.appendChild(opt);
    });
    // グローバル設定の現在値を引き継ぐ
    const globalSize = document.getElementById("global-size")?.value;
    selSize.value = globalSize || 32;

    const selCond = this.el.querySelector(".sel-cond");
    conditions.forEach(c => {
      const opt = new Option(c.name, c.id);
      selCond.appendChild(opt);
    });
    const globalCond = document.getElementById("global-cond")?.value;
    if (globalCond) selCond.value = globalCond;

    // 速度もグローバルと同期
    const globalSpeed = document.getElementById("global-speed")?.value;
    if (globalSpeed) {
      this.el.querySelector(".rng-speed").value = globalSpeed;
      this._applySpeed(Number(globalSpeed));
    }
  }

  // ── イベントバインド ─────────────────────────────────────────
  _bind() {
    const q = (sel) => this.el.querySelector(sel);

    q(".panel-close").addEventListener("click", () => this.destroy());
    q(".btn-start")  .addEventListener("click", () => this.start());
    q(".btn-pause")  .addEventListener("click", () => this.togglePause());
    q(".btn-stop")   .addEventListener("click", () => this.stop());
    q(".btn-reset")  .addEventListener("click", () => this.reset());

    q(".rng-speed").addEventListener("input", (ev) => {
      this._applySpeed(Number(ev.target.value));
    });

    // パラメタ変更時にプレビューを更新（実行中は無視）
    q(".sel-algo").addEventListener("change", () => { if (!this.isRunning) this._drawPreview(); });
    q(".sel-size").addEventListener("change", () => { if (!this.isRunning) this._drawPreview(); });
    q(".sel-cond").addEventListener("change", () => { if (!this.isRunning) this._drawPreview(); });

    // パネル全体 & キャンバスラッパー両方を監視（resize: both に対応）
    const ro = new ResizeObserver(() => this._onResize());
    ro.observe(this.el);
    ro.observe(q(".canvas-wrapper"));
  }

  // ── リサイズハンドラ ─────────────────────────────────────────
  _onResize() {
    const wrapper = this.el.querySelector(".canvas-wrapper");
    const canvas  = this.el.querySelector(".sort-canvas");
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    if (w <= 0 || h <= 0) return;

    // ★ バグ修正: 同値でも canvas.width = x は必ずキャンバスをクリアするため
    //    実際にサイズが変わった時だけ代入する
    const sizeChanged = (canvas.width !== w || canvas.height !== h);
    if (sizeChanged) {
      canvas.width  = w;
      canvas.height = h;
    } else {
      // サイズ未変更 → 何も消えていないので再描画不要
      return;
    }

    // サイズ変更後に再描画
    if (this.isRunning && this.sortCanvas && this._lastFrame) {
      // アニメーション中: 最後のフレームを再描画
      this.sortCanvas.canvas   = canvas;
      this.sortCanvas.ctx      = canvas.getContext("2d");
      this.sortCanvas.numItems = this.numItems;
      this.sortCanvas.dataMax  = this.dataMax;
      this.sortCanvas.draw(this._lastFrame);
    } else if (!this.isRunning) {
      // 待機中・リセット後: プレビューを再描画
      this._drawPreviewOnCanvas(canvas, w, h);
    }
  }

  // ── プレビューデータ生成（クライアントサイド） ──────────────
  _generatePreviewData() {
    const numItems  = Number(this.el.querySelector(".sel-size").value);
    const condition = Number(this.el.querySelector(".sel-cond").value);
    const dataMax   = numItems > 150 ? 300 : 100;

    let data = Array.from({ length: numItems },
                          () => Math.floor(Math.random() * dataMax) + 1);

    if (condition === 1) {                       // 昇順
      data.sort((a, b) => a - b);
    } else if (condition === 2) {                // 降順
      data.sort((a, b) => b - a);
    } else if (condition === 3) {                // ほぼ昇順
      data.sort((a, b) => a - b);
      const swaps = Math.max(1, Math.floor(numItems / 10));
      for (let k = 0; k < swaps; k++) {
        const i = Math.floor(Math.random() * numItems);
        const j = Math.floor(Math.random() * numItems);
        [data[i], data[j]] = [data[j], data[i]];
      }
    } else if (condition === 4) {                // ステップ値
      const steps = Math.max(2, Math.floor(Math.sqrt(numItems)));
      const pool  = Array.from({ length: steps }, (_, i) =>
        Math.floor(Math.random() * (dataMax / steps)) + i * Math.floor(dataMax / steps) + 1
      );
      data = Array.from({ length: numItems },
                        () => pool[Math.floor(Math.random() * pool.length)]);
    }

    return { data, color: new Array(numItems).fill("b"), dataMax, numItems };
  }

  // ── プレビューを描画（canvas サイズも設定） ──────────────────
  _drawPreview() {
    const wrapper = this.el.querySelector(".canvas-wrapper");
    const canvas  = this.el.querySelector(".sort-canvas");
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight || Math.round(w * 0.45);
    if (w <= 0) return;
    // ★ バグ修正: サイズが変わった時だけ代入（同値代入もクリアになるため）
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h || Math.round(w * 0.45);
    }
    this._drawPreviewOnCanvas(canvas, canvas.width, canvas.height);
  }

  _drawPreviewOnCanvas(canvas, w, h) {
    const pd = this._generatePreviewData();
    this._previewCache = pd;
    const sc = new SortCanvas(canvas, pd.numItems, pd.dataMax);
    sc.draw({ data: pd.data, color: pd.color,
              arrows: [], texts: [], lines: [], bars: [], finished: false });
  }

  // ── スピード変換: スライダー(1-200) → 秒/フレーム ──────────
  _applySpeed(sliderVal) {
    // スライダー右 = 速い = 秒数小
    const speed  = Math.round(200 / sliderVal * 10) / 1000; // 0.001 ~ 2.0
    const mult   = Math.round(sliderVal / 80 * 10) / 10;
    this.el.querySelector(".speed-value").textContent = `×${mult.toFixed(1)}`;
    if (this.client) this.client.setSpeed(speed);
    this._speed = speed;
  }

  _currentSpeed() {
    const v = Number(this.el.querySelector(".rng-speed").value);
    return Math.round(200 / v * 10) / 1000;
  }

  // ── 開始 ────────────────────────────────────────────────────────
  async start() {
    if (this.isRunning) return;

    const algoId  = Number(this.el.querySelector(".sel-algo").value);
    const numItems = Number(this.el.querySelector(".sel-size").value);
    const condId  = Number(this.el.querySelector(".sel-cond").value);
    const speed   = this._currentSpeed();

    // サーバーにセッション開始を要求
    let info;
    try {
      const res = await fetch("/api/start", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm_id:   algoId,
          num_items:      numItems,
          data_condition: condId,
          speed:          speed,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      info = await res.json();
    } catch (e) {
      this._setStatus(`エラー: ${e.message}`, "red");
      return;
    }

    this.sessionId = info.session_id;
    this.numItems  = info.num_items;
    this.dataMax   = info.data_max;
    this.isRunning = true;
    this.isPaused  = false;
    this._frameCount = 0;

    // キャンバスを初期化
    const canvas = this.el.querySelector(".sort-canvas");
    this.sortCanvas = new SortCanvas(canvas, this.numItems, this.dataMax);

    // UI 更新
    this.el.querySelector(".panel-title").textContent = info.algo_name;
    this.el.classList.add("running");
    this.el.classList.remove("finished");
    this._setStatus("実行中", "#90caf9");
    this._setBtns({ start: false, pause: true, stop: true, reset: false });
    this.el.querySelector(".status-algo").textContent = info.algo_name;
    this.el.querySelector(".text-overlay").textContent = "アニメーション開始...";

    // WebSocket 接続
    this.client = new AnimationClient(
      this.sessionId,
      (frame) => this._onFrame(frame),
      ()      => this._onClose(),
      (ev)    => this._setStatus("接続エラー", "red"),
    );
    this.client.connect();
  }

  // ── フレーム受信 ─────────────────────────────────────────────
  _onFrame(frame) {
    this._lastFrame  = frame;
    this._frameCount = (this._frameCount ?? 0) + 1;

    const texts = this.sortCanvas.draw(frame);
    this.el.querySelector(".text-overlay").textContent =
      texts.length ? texts.join("\n") : "";
    this.el.querySelector(".status-frames").textContent =
      `フレーム: ${this._frameCount}`;

    if (frame.finished) {
      this.isRunning = false;
      this.el.classList.remove("running");
      this.el.classList.add("finished");
      this._setStatus("完了", "#44aa44");
      this._setBtns({ start: false, pause: false, stop: false, reset: true });
    }
  }

  // ── WebSocket クローズ ────────────────────────────────────────
  _onClose() {
    if (this.isRunning) {
      this.isRunning = false;
      this.el.classList.remove("running");
      this._setStatus("切断", "#888");
      this._setBtns({ start: true, pause: false, stop: false, reset: false });
    }
  }

  // ── 一時停止 / 再開 ────────────────────────────────────────────
  togglePause() {
    if (!this.isRunning) return;
    this.isPaused = !this.isPaused;
    const btn = this.el.querySelector(".btn-pause");
    if (this.isPaused) {
      this.client.pause();
      btn.textContent = "▶ 再開";
      this._setStatus("一時停止", "#FFD700");
    } else {
      this.client.resume();
      btn.textContent = "⏸ 一時停止";
      this._setStatus("実行中", "#90caf9");
    }
  }

  // ── 停止 ─────────────────────────────────────────────────────
  stop() {
    if (!this.isRunning) return;
    this.client?.stop();
    this.client?.disconnect();
    this.client    = null;
    this.isRunning = false;
    this.el.classList.remove("running");
    this._setStatus("停止", "#888");
    this._setBtns({ start: true, pause: false, stop: false, reset: true });
  }

  // ── リセット ─────────────────────────────────────────────────
  reset() {
    if (this.isRunning) this.stop();
    this.el.querySelector(".text-overlay").textContent = "（開始ボタンを押してください）";
    this.el.querySelector(".status-frames").textContent = "フレーム: 0";
    this.el.classList.remove("finished");
    this._setStatus("待機中", "#888");
    this._setBtns({ start: true, pause: false, stop: false, reset: false });
    this.sortCanvas  = null;
    this._lastFrame  = null;
    this._frameCount = 0;
    // リセット後もデータをプレビュー表示
    this._drawPreview();
  }

  // ── パネル削除 ───────────────────────────────────────────────
  destroy() {
    this.stop();
    this.el?.remove();
  }

  // ── ヘルパー ─────────────────────────────────────────────────
  _setBtns({ start, pause, stop, reset }) {
    const q = (s) => this.el.querySelector(s);
    q(".btn-start").disabled = !start;
    q(".btn-pause").disabled = !pause;
    q(".btn-stop") .disabled = !stop;
    q(".btn-reset").disabled = !reset;
    if (!pause) q(".btn-pause").textContent = "⏸ 一時停止";
  }

  _setStatus(text, color = "#aaa") {
    const el = this.el.querySelector(".status-state");
    el.textContent = text;
    el.style.color = color;
  }
}
