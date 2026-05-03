# Smart Scale System — Intelligent Checkout

A touchscreen interface for IoT smart scales at self-service supermarket checkouts. A CNN model (MobileNetV3) running on an NVIDIA
Jetson Nano identifies fruits and vegetables by weight and camera image, and displays the top candidates to the user for confirmation.

## How it works

1. Customer places a fruit or vegetable on the scale
2. Weight stabilizes, the camera captures an image, the AI model classifies the product
3. The interface shows the top 3 candidate products with confidence scores
4. Customer taps their product to confirm and get a receipt

## Architecture

```
Hardware (serial scale + camera)
        |
   backend/backend.py        (FastAPI + WebSocket, port 5000)
        |  WebSocket ws://localhost:5000/communication
        |
   frontend/                  (React + Vite, port 5173)
```

The backend streams weight readings to the frontend over WebSocket at ~10 Hz. When the frontend detects a stable weight, it sends a `classify` request. The backend runs inference on the current camera frame and returns the top 4 predictions with confidence percentages.

## Prerequisites

- **Python 3.8+** with pip
- **Node.js 18+** with npm
- For full hardware mode: NVIDIA Jetson Nano with serial scale (`/dev/ttyUSB0`) and CSI camera
- Model weights file `mobilenetv3_final.pth` placed inside `backend/`

## Project Setup

You need **2 terminal windows** — one for the backend, one for the frontend.

### Terminal 1 — Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Run the backend server
python backend.py
```

The backend starts at `http://localhost:5000` with the WebSocket endpoint at `ws://localhost:5000/communication`.

> **Note:** On the Jetson Nano, `torch` and `torchvision` should be installed via NVIDIA's PyTorch wheels for ARM/CUDA support, not from PyPI directly.

### Terminal 2 — Frontend

```bash
cd frontend

# Install Node dependencies
npm install

# Start the dev server
npm run dev
```

Vite will show:

```
VITE v5.x  ready in ~500ms
  -> Local:   http://localhost:5173/
```

Open that URL in a browser. When both servers are running, the status badge on the idle screen will show "Connected".

## Demo Mode (no hardware needed)

If you don't have the Jetson Nano and physical scale:

1. Start only the frontend (`npm run dev` in `frontend/`)
2. Open the browser — the status badge will show "Disconnected"
3. Click the **Demo** button in the bottom-left corner
4. Select a product and click the trigger button
5. The full flow runs with simulated weight and mock classifications

## Production Build

```bash
cd frontend
npm run build
```

This generates optimized static files in `frontend/dist/`. Serve them with any HTTP server:

```bash
npx serve dist
```

Or use nginx, Apache, etc. on the Jetson Nano.

## Project Structure

```
iot-smart-weight-system/
├── backend/
│   └── backend.py              # FastAPI server: camera, serial, model inference, WebSocket
├── frontend/
│   ├── index.html              # HTML shell (kiosk mode: no text selection, no context menu)
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js      # Custom palette: sage (green) + warm (cream)
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx            # React entry point
│       ├── index.css           # Tailwind imports + custom animations
│       └── App.jsx             # All components and state machine
└── README.md
```

## WebSocket Protocol

**Weight stream** (backend -> frontend, every ~100ms):

```json
{
  "type": "weigh",
  "body": { "weight": 523.5 }
}
```

**Classify request** (frontend -> backend):

```json
{
  "type": "classify"
}
```

**Classify response** (backend -> frontend):

```json
{
  "type": "classify",
  "body": {
    "predictions": [
      { "label": "Apple A", "confidence": 92.3 },
      { "label": "peach", "confidence": 4.1 },
      { "label": "tomatoes", "confidence": 2.0 },
      { "label": "plum", "confidence": 1.2 }
    ]
  }
}
```

## Supported Products

| Product   | Backend Label | Price (MDL/kg) |
| --------- | ------------- | -------------- |
| Apple     | Apple A       | 2.80           |
| Kiwi      | Kiwi B        | 5.50           |
| Banana    | banana        | 3.50           |
| Orange    | orange        | 3.20           |
| Peach     | peach         | 4.80           |
| Persimmon | persimmon     | 7.00           |
| Plum      | plum          | 3.80           |
| Tomato    | tomatoes      | 4.20           |
