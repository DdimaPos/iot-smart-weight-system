import cv2
import torch
import torch.nn as nn
import torchvision.transforms as transforms
from torchvision import models
import threading
import numpy as np
import serial
import time
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn

# -------------------------
# CONFIG
# -------------------------
NUM_CLASSES = 8
MODEL_PATH = "mobilenetv3_final.pth"
CLASS_NAMES = ["Apple A", "Kiwi B", "banana", "orange", "peach", "persimmon", "plum", "tomatoes"]

SERIAL_PORT = '/dev/ttyUSB0'
BAUD_RATE = 9600

GST_PIPELINE = (
    "nvarguscamerasrc ! "
    "video/x-raw(memory:NVMM), width=640, height=480, format=(string)NV12, framerate=(fraction)20/1 ! "
    "nvvidconv ! video/x-raw, format=(string)BGRx ! "
    "videoconvert ! video/x-raw, format=(string)BGR ! appsink"
)

# -------------------------
# GLOBAL STATE
# -------------------------
current_weight = 0.0
latest_frame = None
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

# -------------------------
# MODEL SETUP
# -------------------------
print("Loading model...")
model = models.mobilenet_v3_large(weights=None)

in_features = model.classifier[0].in_features
model.classifier = nn.Sequential(
    nn.Linear(in_features, 512),
    nn.BatchNorm1d(512),
    nn.ReLU(inplace=True),
    nn.Dropout(0.2),
    nn.Linear(512, 256),
    nn.BatchNorm1d(256),
    nn.ReLU(inplace=True),
    nn.Dropout(0.2),
    nn.Linear(256, NUM_CLASSES)
)

model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
model.to(device)
model.eval()

transform = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

# -------------------------
# THREADS
# -------------------------
def weight_worker():
    global current_weight
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        ser.flush()
        while True:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                try:
                    current_weight = float(line)
                except:
                    pass
            time.sleep(0.01)
    except Exception as e:
        print("Serial error:", e)


def camera_worker():
    global latest_frame
    cap = cv2.VideoCapture(GST_PIPELINE, cv2.CAP_GSTREAMER)

    while True:
        ret, frame = cap.read()
        if ret:
            latest_frame = frame
        else:
            time.sleep(0.01)

# -------------------------
# INFERENCE
# -------------------------
def classify_image(frame):
    img = transform(frame)
    img = img.unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = model(img)
        probs = torch.softmax(outputs, dim=1)
        top_prob, top_idx = torch.max(probs, dim=1)

    idx = int(top_idx.item())
    return {
        "id": idx,
        "label": CLASS_NAMES[idx]
    }

# -------------------------
# FASTAPI SETUP
# -------------------------
app = FastAPI()

clients = set()

@app.websocket("/communication")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)

    print("Client connected")

    try:
        while True:
            # Non-blocking receive
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=0.01)
            except asyncio.TimeoutError:
                data = None

            # Handle incoming messages
            if data:
                if data.get("type") == "classify":
                    if latest_frame is not None:
                        result = classify_image(latest_frame)

                        await websocket.send_json({
                            "type": "classify",
                            "body": result
                        })

            # Always stream weight
            await websocket.send_json({
                "type": "weigh",
                "body": {
                    "weight": current_weight
                }
            })

            await asyncio.sleep(0.1)

    except WebSocketDisconnect:
        print("Client disconnected")
        clients.remove(websocket)

# -------------------------
# START THREADS
# -------------------------
threading.Thread(target=weight_worker, daemon=True).start()
threading.Thread(target=camera_worker, daemon=True).start()

# -------------------------
# RUN SERVER
# -------------------------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)