/**
 * ws_client.js  –  WebSocket クライアント（送受信ラッパー）
 */

"use strict";

class AnimationClient {
  /**
   * @param {string}   sessionId
   * @param {Function} onFrame   - (frame: object) => void
   * @param {Function} onClose   - () => void
   * @param {Function} onError   - (event) => void
   */
  constructor(sessionId, onFrame, onClose, onError) {
    this.sessionId = sessionId;
    this.onFrame   = onFrame;
    this.onClose   = onClose;
    this.onError   = onError ?? (() => {});
    this.ws        = null;
  }

  connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url   = `${proto}://${location.host}/ws/${this.sessionId}`;
    this.ws     = new WebSocket(url);

    this.ws.onmessage = (ev) => {
      try {
        const frame = JSON.parse(ev.data);
        this.onFrame(frame);
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    this.ws.onclose = () => this.onClose();
    this.ws.onerror = (ev) => this.onError(ev);
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }

  setSpeed(speed)  { this._send({ action: "set_speed", speed }); }
  pause()          { this._send({ action: "pause" }); }
  resume()         { this._send({ action: "resume" }); }
  stop()           { this._send({ action: "stop" }); }

  disconnect() {
    if (this.ws) {
      this.ws.onclose = null;   // クローズイベントを無効化
      this.ws.close();
      this.ws = null;
    }
  }
}
