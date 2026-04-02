"""
main.py  –  FastAPI + WebSocket バックエンド
起動: uvicorn main:app --reload --port 8000
"""

import asyncio
import uuid
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).parent

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from sort_algorithms import (
    AlgorithmList, DataSizeList, DataConditionList,
    make_data,
)

app = FastAPI(title="SortAnimation API")

# セッション管理: { session_id: { generator, speed, paused, stopped, ... } }
sessions: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# REST API
# ---------------------------------------------------------------------------

@app.get("/api/algorithms")
def get_algorithms():
    return [{"id": i, "name": name} for i, (name, _) in enumerate(AlgorithmList)]


@app.get("/api/datasizes")
def get_datasizes():
    return DataSizeList


@app.get("/api/conditions")
def get_conditions():
    return [{"id": i, "name": name} for i, name in enumerate(DataConditionList)]


class StartParams(BaseModel):
    algorithm_id: int
    num_items: int
    data_condition: int = 0   # 0=ランダム … 4=ステップ値
    speed: float = 0.08       # 秒/フレーム


@app.post("/api/start")
def start_session(params: StartParams):
    if params.algorithm_id not in range(len(AlgorithmList)):
        return JSONResponse({"error": "invalid algorithm_id"}, status_code=400)

    num_items = params.num_items
    data_max  = 300 if num_items > 150 else 100

    data, color = make_data(num_items, data_max, params.data_condition)

    algo_name, algo_fn = AlgorithmList[params.algorithm_id]
    generator = algo_fn(data, color)

    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "generator":    generator,
        "speed":        params.speed,
        "paused":       False,
        "stopped":      False,
        "algo_name":    algo_name,
        "num_items":    num_items,
        "data_max":     data_max,
    }
    return {
        "session_id":  session_id,
        "algo_name":   algo_name,
        "num_items":   num_items,
        "data_max":    data_max,
    }


# ---------------------------------------------------------------------------
# WebSocket  /ws/{session_id}
# クライアントからの制御メッセージ:
#   {"action": "set_speed", "speed": 0.05}
#   {"action": "pause"}
#   {"action": "resume"}
#   {"action": "stop"}
# ---------------------------------------------------------------------------

@app.websocket("/ws/{session_id}")
async def ws_endpoint(ws: WebSocket, session_id: str):
    await ws.accept()

    if session_id not in sessions:
        await ws.send_json({"error": "session not found"})
        await ws.close()
        return

    session = sessions[session_id]

    async def send_frames():
        """アルゴリズム generator を順にクライアントへ送信する"""
        try:
            for frame in session["generator"]:
                if session["stopped"]:
                    break
                # ポーズ中は待機
                while session["paused"] and not session["stopped"]:
                    await asyncio.sleep(0.05)
                if session["stopped"]:
                    break
                await ws.send_json(frame)
                await asyncio.sleep(session["speed"])
        except Exception:
            pass

    async def recv_controls():
        """クライアントからの制御コマンドを受け取る"""
        try:
            while True:
                msg = await ws.receive_json()
                action = msg.get("action", "")
                if action == "set_speed":
                    session["speed"] = float(msg.get("speed", 0.08))
                elif action == "pause":
                    session["paused"] = True
                elif action == "resume":
                    session["paused"] = False
                elif action == "stop":
                    session["stopped"] = True
                    break
        except WebSocketDisconnect:
            session["stopped"] = True
        except Exception:
            session["stopped"] = True

    sender   = asyncio.create_task(send_frames())
    receiver = asyncio.create_task(recv_controls())

    done, pending = await asyncio.wait(
        [sender, receiver],
        return_when=asyncio.FIRST_COMPLETED,
    )
    for t in pending:
        t.cancel()

    sessions.pop(session_id, None)
    try:
        await ws.close()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# 静的ファイルサーブ (最後に登録)
# ---------------------------------------------------------------------------
# NOTE: "/" への Mount は Render などのプロキシ環境で WebSocket を横取りする
#       ため、静的アセットは "/static" に置き、ルートは明示的に返す。

from fastapi.responses import FileResponse

@app.get("/")
async def root():
    return FileResponse(BASE_DIR / "static" / "index.html")

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
