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
import websockets
import json

# -------------------------
# CONFIG
# -------------------------
NUM_CLASSES = 8
MODEL_PATH = "mobilenetv3_final.pth"
CLASS_NAMES = ["Apple A", "Kiwi B", "banana", "orange", "peach", "persimmon", "plum", "tomatoes"]

SERIAL_PORT = '/dev/ttyUSB0'
BAUD_RATE = 9600

WS_HOST = "0.0.0.0"
WS_PORT = 5000

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
# MODEL
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
        top3_probs, top3_idxs = torch.topk(probs, k=min(3, NUM_CLASSES), dim=1)

    predictions = []
    for i in range(top3_idxs.shape[1]):
        idx = int(top3_idxs[0, i].item())
        conf = float(top3_probs[0, i].item()) * 100
        predictions.append({
            "label": CLASS_NAMES[idx],
            "confidence": round(conf, 1),
        })

    return {"predictions": predictions}
# -------------------------
# WEBSOCKET SERVER
# -------------------------
async def handler(websocket, path):
    if path != "/communication":
        print(f"Rejected connection on path: {path}")
        await websocket.close(code=1008, reason="Invalid path")
        return

    print("Client connected on /communication")

    try:
        while True:
            # Try to receive message (non-blocking)
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=0.01)
                data = json.loads(message)
            except asyncio.TimeoutError:
                data = None

            # Handle incoming
            if data:
                print(f"data type: {data.get('type')}")
                if data.get("type") == "classify":
                    if latest_frame is not None:
                        print("Starting classifying...")
                        result = classify_image(latest_frame)

                        print(f"Sending result: {result}")
                        await websocket.send(json.dumps({
                            "type": "classify",
                            "body": result
                        }))

            # Always send weight
            await websocket.send(json.dumps({
                "type": "weigh",
                "body": {
                    "weight": current_weight
                }
            }))

            await asyncio.sleep(0.1)

    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")

# -------------------------
# START THREADS
# -------------------------
threading.Thread(target=weight_worker, daemon=True).start()
threading.Thread(target=camera_worker, daemon=True).start()

# -------------------------
# RUN SERVER (Python 3.6 SAFE)
# -------------------------
loop = asyncio.get_event_loop()
server = websockets.serve(handler, WS_HOST, WS_PORT)

loop.run_until_complete(server)
print(f"WebSocket server running on ws://{WS_HOST}:{WS_PORT}")
loop.run_forever()
