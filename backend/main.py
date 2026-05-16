import asyncio
import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from robot_dynamics import RobotDynamics

app = FastAPI(title="Robot Control API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def control_ws(websocket: WebSocket):
    await websocket.accept()

    robot = RobotDynamics()
    gains = {"Kr": 10.0, "alpha": 5.0}
    dt = 1.0 / 60.0

    # Receive Kr / alpha from frontend — runs concurrently with the send loop
    async def recv_loop():
        try:
            async for raw in websocket.iter_text():
                params = json.loads(raw)
                if "Kr" in params:
                    gains["Kr"] = float(params["Kr"])
                if "alpha" in params:
                    gains["alpha"] = float(params["alpha"])
        except Exception:
            pass

    # Advance simulation and push state to frontend at 60 fps
    async def send_loop():
        loop = asyncio.get_event_loop()
        while True:
            t0 = loop.time()

            q, e, qd = robot.step(dt, gains["Kr"], gains["alpha"])

            payload = {
                "t":    round(robot.t, 4),
                "q1":   round(float(q[0]),  6),
                "q2":   round(float(q[1]),  6),
                "qd1":  round(float(qd[0]), 6),
                "qd2":  round(float(qd[1]), 6),
                "e1":   round(float(e[0]),  6),
                "e2":   round(float(e[1]),  6),
                "Kr":   gains["Kr"],
                "alpha": gains["alpha"],
            }

            try:
                await websocket.send_text(json.dumps(payload))
            except Exception:
                return

            elapsed = loop.time() - t0
            await asyncio.sleep(max(0.0, dt - elapsed))

    recv_task = asyncio.create_task(recv_loop())
    send_task = asyncio.create_task(send_loop())

    done, pending = await asyncio.wait(
        [recv_task, send_task], return_when=asyncio.FIRST_COMPLETED
    )
    for task in pending:
        task.cancel()
