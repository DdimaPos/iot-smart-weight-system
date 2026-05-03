import { useState, useEffect, useRef, useCallback } from 'react'

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const SCREEN = {
  IDLE:       'IDLE',
  WEIGHING:   'WEIGHING',
  CANDIDATES: 'CANDIDATES',
  CONFIRMED:  'CONFIRMED',
}

const WS_URL           = 'ws://localhost:5000/communication'
const WEIGHT_THRESHOLD = 0.05   // kg  — below this = nothing on scale
const STABLE_WINDOW_MS = 1000   // ms  — how long weight must be stable
const STABLE_TOLERANCE = 0.005  // kg  — max variance to be "stable"

// All 8 classes the backend CNN can output
const PRODUCTS = [
  { id: 'apple',     name: 'Măr',       variety: 'Red Delicious', emoji: '🍎', color: '#c0392b', bg: '#fdf0ef', border: '#f5c6c3', pricePerKg: 2.80 },
  { id: 'kiwi',      name: 'Kiwi',      variety: 'Green Kiwi',   emoji: '🥝', color: '#5d8a1c', bg: '#f2f8e8', border: '#c8e09a', pricePerKg: 5.50 },
  { id: 'banana',    name: 'Banană',    variety: 'Cavendish',    emoji: '🍌', color: '#d68910', bg: '#fef9ec', border: '#fde8a5', pricePerKg: 3.50 },
  { id: 'orange',    name: 'Portocală', variety: 'Navel',        emoji: '🍊', color: '#d35400', bg: '#fef3ec', border: '#fcd9b5', pricePerKg: 3.20 },
  { id: 'peach',     name: 'Piersică',  variety: 'Galbenă',      emoji: '🍑', color: '#e08010', bg: '#fef7ec', border: '#fde3b0', pricePerKg: 4.80 },
  { id: 'persimmon', name: 'Kaki',      variety: 'Japonez',      emoji: '🟠', color: '#c05000', bg: '#fef2e8', border: '#f9c8a0', pricePerKg: 7.00 },
  { id: 'plum',      name: 'Prună',     variety: 'Stanley',      emoji: '🫐', color: '#6c3483', bg: '#f4eef9', border: '#d2b4de', pricePerKg: 3.80 },
  { id: 'tomato',    name: 'Roșie',     variety: 'Rotundă',      emoji: '🍅', color: '#a93226', bg: '#fdf0ef', border: '#f5c6c3', pricePerKg: 4.20 },
]

// Maps backend CNN label (lowercase) → product id
const BACKEND_LABEL_MAP = {
  'apple a':   'apple',
  'kiwi b':    'kiwi',
  'banana':    'banana',
  'orange':    'orange',
  'peach':     'peach',
  'persimmon': 'persimmon',
  'plum':      'plum',
  'tomatoes':  'tomato',
}

function findProductByLabel(label) {
  const id = BACKEND_LABEL_MAP[label?.toLowerCase()] ?? 'apple'
  return PRODUCTS.find(p => p.id === id) ?? PRODUCTS[0]
}

// Top product from backend + 3 random alternatives with fake confidence scores
function generateCandidatesFrom(topProduct) {
  const rest = PRODUCTS
    .filter(p => p.id !== topProduct.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)

  const topConf = 85 + Math.floor(Math.random() * 12)
  const rem = 100 - topConf
  const scores = [
    Math.floor(rem * 0.50),
    Math.floor(rem * 0.30),
    Math.floor(rem * 0.20),
  ].sort((a, b) => b - a)

  return [
    { ...topProduct, confidence: topConf  },
    { ...rest[0],    confidence: scores[0] },
    { ...rest[1],    confidence: scores[1] },
    { ...rest[2],    confidence: scores[2] },
  ]
}

// ─── BACKEND WEBSOCKET HOOK ──────────────────────────────────────────────────

function useBackend({ onWeight, onClassify, onConnectionChange }) {
  const wsRef     = useRef(null)
  // Store callbacks in refs so the single WS setup effect never re-runs
  const onWeightRef     = useRef(onWeight)
  const onClassifyRef   = useRef(onClassify)
  const onConnRef       = useRef(onConnectionChange)

  useEffect(() => { onWeightRef.current   = onWeight         }, [onWeight])
  useEffect(() => { onClassifyRef.current = onClassify       }, [onClassify])
  useEffect(() => { onConnRef.current     = onConnectionChange }, [onConnectionChange])

  const sendClassify = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'classify' }))
    }
  }, [])

  useEffect(() => {
    let ws
    let retryTimer

    function connect() {
      ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen  = () => onConnRef.current?.(true)
      ws.onclose = () => {
        onConnRef.current?.(false)
        retryTimer = setTimeout(connect, 3000)
      }
      ws.onerror = () => {}
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'weigh')    onWeightRef.current?.(msg.body.weight)
          if (msg.type === 'classify') onClassifyRef.current?.(msg.body)
        } catch { /* malformed frame — ignore */ }
      }
    }

    connect()
    return () => {
      clearTimeout(retryTimer)
      ws?.close()
    }
  }, []) // intentionally empty — connect once, use refs for callbacks

  return { sendClassify }
}

// ─── SHARED WIDGETS ──────────────────────────────────────────────────────────

function ScaleIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-sage-500">
      <path d="M12 3v2M5 6h14M5 6l-2 8h5a4 4 0 008 0h5L19 6" />
      <path d="M9 14a3 3 0 006 0" />
    </svg>
  )
}

function WeightBadge({ weight, large = false }) {
  return (
    <div className={`flex items-center gap-2 bg-white rounded-2xl border border-sage-200 card-shadow
      ${large ? 'px-6 py-3' : 'px-4 py-2'}`}>
      <ScaleIcon size={large ? 22 : 18} />
      <span className={`font-bold tabular-nums text-sage-700 ${large ? 'text-2xl' : 'text-lg'}`}>
        {weight.toFixed(3)} kg
      </span>
    </div>
  )
}

function Spinner({ size = 48 }) {
  const r    = 20
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox="0 0 48 48"
      className="animate-spin" style={{ animationDuration: '1.1s' }}>
      <circle cx="24" cy="24" r={r} fill="none" stroke="#c9d9c9" strokeWidth="4" />
      <circle cx="24" cy="24" r={r} fill="none" stroke="#568056" strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${circ * 0.28} ${circ * 0.72}`} />
    </svg>
  )
}

// ─── SCREEN 1: WAITING ───────────────────────────────────────────────────────

function WaitingScreen({ wsConnected }) {
  const steps = [
    { icon: '🛒', label: 'Puneți produsul\npe cântar',   anim: 'float-1' },
    { icon: '⚖️', label: 'Greutatea\nse stabilizează',   anim: 'float-2' },
    { icon: '🤖', label: 'AI identifică\nprodusul',      anim: 'float-3' },
    { icon: '✅', label: 'Apăsați pentru\nconfirmare',   anim: 'float-4' },
  ]

  return (
    <div className="screen-enter h-full flex flex-col items-center justify-around bg-warm-50 px-8 py-10 gap-6">

      {/* Header */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-5xl mb-1">🌿</div>
        <h1 className="text-4xl font-bold text-sage-800 tracking-tight">Casă de Plată Inteligentă</h1>
        <p className="text-xl text-sage-500 font-medium">Puneți produsul pe cântar pentru a începe</p>

        {/* Backend connection status */}
        <div className={`mt-2 flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold
          ${wsConnected
            ? 'bg-sage-100 text-sage-600 border border-sage-200'
            : 'bg-warm-100 text-warm-500 border border-warm-200'}`}>
          <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-sage-400 animate-pulse-soft' : 'bg-warm-300'}`} />
          {wsConnected ? 'Cântar conectat' : 'Cântar deconectat — folosiți modul Demo'}
        </div>
      </div>

      {/* Step guide */}
      <div className="flex items-start justify-center gap-4 w-full max-w-2xl">
        {steps.map((step, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-3">
            <div className={`${step.anim} w-20 h-20 rounded-3xl bg-white card-shadow border border-sage-100
              flex items-center justify-center text-4xl`}>
              {step.icon}
            </div>
            <div className="w-7 h-7 rounded-full bg-sage-400 flex items-center justify-center text-white text-sm font-bold shadow">
              {i + 1}
            </div>
            <p className="text-center text-sage-600 font-medium text-base leading-snug whitespace-pre-line">
              {step.label}
            </p>
          </div>
        ))}
      </div>

      {/* Arrows between icons */}
      <div className="flex justify-center gap-4 w-full max-w-2xl -mt-40 mb-24 pointer-events-none" aria-hidden="true">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex-1 flex justify-end items-start pt-8">
            <svg width="28" height="18" viewBox="0 0 28 18" fill="none">
              <path d="M2 9h22M18 3l6 6-6 6" stroke="#a3bfa3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ))}
        <div className="flex-1" />
      </div>

      {/* Scale readout */}
      <div className="flex flex-col items-center gap-3">
        <div className="animate-pulse-soft">
          <WeightBadge weight={0} large />
        </div>
        <p className="text-base text-warm-400 font-medium">Se așteaptă produsul…</p>
      </div>
    </div>
  )
}

// ─── SCREEN 2: WEIGHING ──────────────────────────────────────────────────────

function WeighingScreen({ liveWeight }) {
  return (
    <div className="screen-enter h-full flex flex-col items-center justify-center gap-10 bg-warm-50 px-8">

      <div className="w-32 h-32 rounded-full bg-white card-shadow border border-sage-100
        flex items-center justify-center text-7xl animate-bounce-soft">
        ⚖️
      </div>

      <div className="flex flex-col items-center gap-3">
        <p className="text-xl font-semibold text-sage-600">Se măsoară greutatea…</p>
        <div className="bg-white rounded-3xl card-shadow border border-sage-200 px-10 py-6 flex items-center gap-3">
          <ScaleIcon size={28} />
          <span className="text-6xl font-bold tabular-nums text-sage-800">
            {liveWeight.toFixed(3)}
          </span>
          <span className="text-3xl font-semibold text-sage-500 self-end mb-2">kg</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Spinner size={56} />
        <p className="text-xl font-semibold text-sage-700">Se identifică produsul…</p>
        <div className="flex gap-2">
          <span className="dot-1 w-3 h-3 rounded-full bg-sage-400 inline-block" />
          <span className="dot-2 w-3 h-3 rounded-full bg-sage-400 inline-block" />
          <span className="dot-3 w-3 h-3 rounded-full bg-sage-400 inline-block" />
        </div>
      </div>
    </div>
  )
}

// ─── SCREEN 3: CANDIDATES ────────────────────────────────────────────────────

const IDLE_TIMEOUT = 30

function CandidatesScreen({ candidates, weight, onSelect, onBack }) {
  const [selected, setSelected] = useState(null)
  const [timeLeft, setTimeLeft] = useState(IDLE_TIMEOUT)

  useEffect(() => {
    if (selected !== null) return
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(id); onBack(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [selected, onBack])

  const handleTap = (candidate) => {
    if (selected !== null) return
    setSelected(candidate.id)
    setTimeout(() => onSelect(candidate), 550)
  }

  const showCountdown = timeLeft <= 8
  const RING_R    = 24
  const RING_CIRC = 2 * Math.PI * RING_R
  const ringOffset = RING_CIRC * (timeLeft / IDLE_TIMEOUT)

  return (
    <div className="screen-enter h-full flex flex-col bg-warm-50">

      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-6 pt-5 pb-4 bg-white border-b border-sage-100">
        <div className="flex items-center gap-3">
          <WeightBadge weight={weight} />
          <span className="text-lg font-semibold text-sage-600">— Selectați produsul dvs.</span>
        </div>

        <div className="flex items-center gap-4">
          {showCountdown && (
            <div className="flex items-center gap-2 bg-warm-50 border border-warm-300 rounded-2xl px-4 py-2 animate-fade-in">
              <svg width={56} height={56} className="-my-1.5">
                <circle cx="28" cy="28" r={RING_R} fill="none" stroke="#fddba5" strokeWidth="3.5" />
                <circle cx="28" cy="28" r={RING_R} fill="none" stroke="#e67e22" strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={RING_CIRC - ringOffset}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '28px 28px', transition: 'stroke-dashoffset 0.95s linear' }}
                />
                <text x="28" y="33" textAnchor="middle" fontSize="14" fontWeight="700" fill="#ca7848">
                  {timeLeft}
                </text>
              </svg>
              <span className="text-warm-600 font-semibold text-base">Revenire…</span>
            </div>
          )}

          <button
            onClick={onBack}
            className="touch-safe flex items-center gap-2 bg-white border border-sage-200 rounded-2xl
              px-5 py-3 text-sage-600 font-semibold text-base card-shadow active:scale-95 transition-transform"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Înapoi
          </button>
        </div>
      </div>

      {/* Candidate cards */}
      <div className="flex-1 flex items-center px-6 py-5 overflow-hidden">
        <div className="w-full grid gap-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {candidates.map(candidate => {
            const isSelected = selected === candidate.id
            const isDimmed   = selected !== null && !isSelected

            return (
              <button
                key={candidate.id}
                onClick={() => handleTap(candidate)}
                disabled={isDimmed}
                className={`
                  relative touch-safe flex flex-col items-center gap-4 p-6 rounded-3xl border-2
                  transition-all duration-300 text-center
                  ${isDimmed
                    ? 'opacity-30 scale-95 pointer-events-none bg-white border-sage-100'
                    : isSelected
                      ? 'border-sage-400 ring-4 ring-sage-200 scale-105'
                      : 'bg-white border-sage-100 card-shadow active:scale-95'
                  }
                `}
                style={isSelected ? { background: candidate.bg } : {}}
              >
                {/* Emoji */}
                <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-6xl"
                  style={{ background: candidate.bg, border: `2px solid ${candidate.border}` }}>
                  {candidate.emoji}
                </div>

                {/* Name */}
                <div>
                  <div className="text-2xl font-bold text-sage-800 leading-tight">{candidate.name}</div>
                  <div className="text-sm text-sage-400 font-medium mt-0.5">{candidate.variety}</div>
                </div>

                {/* Confidence */}
                <div className="px-4 py-1.5 rounded-full text-sm font-bold"
                  style={{ background: candidate.bg, color: candidate.color, border: `1.5px solid ${candidate.border}` }}>
                  {candidate.confidence}% potrivire
                </div>

                {/* Price per kg */}
                <div className="text-base text-sage-400 font-medium">
                  {candidate.pricePerKg.toFixed(2)} MDL/kg
                </div>

                {/* Checkmark when selected */}
                {isSelected && (
                  <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-sage-400
                    flex items-center justify-center animate-scale-in shadow-md">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" className="check-draw" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="shrink-0 pb-5 flex justify-center">
        <p className="text-base text-sage-400 font-medium">
          {selected ? 'Se confirmă selecția…' : 'Apăsați cardul care corespunde produsului dvs.'}
        </p>
      </div>
    </div>
  )
}

// ─── SCREEN 4: CONFIRMATION ──────────────────────────────────────────────────

function ConfirmationScreen({ product, weight, sessionStart, onReset }) {
  const total = (product.pricePerKg * weight).toFixed(2)

  useEffect(() => {
    console.log('[SmartScale] Sesiune finalizată:', {
      produs:           product.name,
      soi:              product.variety,
      greutate_kg:      parseFloat(weight.toFixed(3)),
      pretUnitar_MDL:   product.pricePerKg,
      pretTotal_MDL:    parseFloat(total),
      timestamp:        new Date().toISOString(),
      durata_ms:        Date.now() - sessionStart,
    })
  }, [])

  const now     = new Date()
  const timeStr = now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="screen-enter h-full flex flex-col items-center justify-between bg-warm-50 px-8 py-10 gap-6">

      {/* Success header */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-sage-100 border-2 border-sage-300
          flex items-center justify-center animate-scale-in">
          <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
            <path d="M12 26l8 8L36 16"
              stroke="#568056" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
              className="check-draw" />
          </svg>
        </div>
        <h2 className="text-4xl font-bold text-sage-800">Finalizat!</h2>
        <p className="text-xl text-sage-500">Iată chitanța dumneavoastră</p>
      </div>

      {/* Receipt */}
      <div className="w-full max-w-md receipt-bg rounded-3xl border border-warm-200 overflow-hidden card-shadow animate-slide-up">

        {/* Header strip */}
        <div className="px-8 py-6 flex items-center gap-5"
          style={{
            background: `linear-gradient(135deg, ${product.color}22 0%, ${product.color}11 100%)`,
            borderBottom: `2px solid ${product.border}`,
          }}>
          <span className="text-6xl">{product.emoji}</span>
          <div>
            <div className="text-3xl font-bold text-sage-800">{product.name}</div>
            <div className="text-base text-sage-500 font-medium">{product.variety}</div>
          </div>
        </div>

        {/* Line items */}
        <div className="px-8 py-6 flex flex-col gap-4">
          <ReceiptRow label="Greutate"     value={`${weight.toFixed(3)} kg`} />
          <ReceiptRow label="Preț unitar"  value={`${product.pricePerKg.toFixed(2)} MDL / kg`} />
          <div className="border-t-2 border-dashed border-warm-200" />
          <ReceiptRow label="Total" value={`${total} MDL`} bold />
        </div>

        <div className="border-t-2 border-dashed border-warm-200 mx-6" />
        <div className="px-8 py-4 text-center text-warm-400 text-sm font-medium">
          {dateStr} · {timeStr} · Cântar Inteligent v1.0
        </div>
      </div>

      {/* New item */}
      <button
        onClick={onReset}
        className="touch-safe w-full max-w-md bg-sage-500 text-white text-xl font-bold
          rounded-3xl py-5 card-shadow active:scale-95 active:bg-sage-600 transition-all duration-150"
      >
        + Produs Nou
      </button>
    </div>
  )
}

function ReceiptRow({ label, value, bold = false }) {
  return (
    <div className="flex justify-between items-center">
      <span className={bold ? 'text-xl font-bold text-warm-700' : 'text-lg font-medium text-warm-500'}>
        {label}
      </span>
      <span className={`tabular-nums ${bold ? 'text-2xl font-bold text-sage-700' : 'text-lg font-semibold text-warm-800'}`}>
        {value}
      </span>
    </div>
  )
}

// ─── DEMO PANEL ──────────────────────────────────────────────────────────────

function DemoPanel({ onTrigger, currentScreen }) {
  const [open, setOpen]     = useState(false)
  const [chosen, setChosen] = useState('apple')
  const isIdle = currentScreen === SCREEN.IDLE

  return (
    <div className="fixed bottom-5 left-5 z-50 flex flex-col items-start gap-2">
      {open && (
        <div className="animate-slide-up bg-white border border-sage-200 rounded-2xl card-shadow p-5 flex flex-col gap-4 min-w-60">
          <p className="text-sage-700 font-bold text-sm uppercase tracking-wider border-b border-sage-100 pb-3">
            🔧 Panou Demo
          </p>

          <div className="flex flex-col gap-1.5">
            {PRODUCTS.map(p => (
              <button
                key={p.id}
                onClick={() => setChosen(p.id)}
                className={`touch-safe flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                  transition-colors text-left
                  ${chosen === p.id
                    ? 'bg-sage-100 text-sage-800 border border-sage-300'
                    : 'text-sage-600 hover:bg-sage-50 border border-transparent'}`}
              >
                <span className="text-xl">{p.emoji}</span>
                <span>{p.name}</span>
                <span className="ml-auto text-xs text-sage-400">{p.pricePerKg.toFixed(2)}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => { if (isIdle) { onTrigger(chosen); setOpen(false) } }}
            className={`touch-safe w-full rounded-xl py-3 text-base font-bold transition-colors
              ${isIdle
                ? 'bg-sage-500 text-white active:bg-sage-600'
                : 'bg-sage-100 text-sage-400 cursor-not-allowed'}`}
          >
            {isIdle ? '▶ Puneți Produsul pe Cântar' : '⏳ Sesiune în desfășurare…'}
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="touch-safe bg-sage-700 text-white rounded-2xl px-4 py-2.5 text-sm font-bold
          card-shadow active:scale-95 transition-transform flex items-center gap-2"
      >
        🔧 {open ? 'Închide' : 'Demo'}
      </button>
    </div>
  )
}

// ─── APP — STATE MACHINE ─────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen]               = useState(SCREEN.IDLE)
  const [liveWeight, setLiveWeight]       = useState(0)
  const [stableWeight, setStableWeight]   = useState(0)
  const [candidates, setCandidates]       = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [sessionStart, setSessionStart]   = useState(null)
  const [wsConnected, setWsConnected]     = useState(false)

  // Refs used inside WebSocket callback to avoid stale closures
  const screenRef           = useRef(screen)
  const weightHistoryRef    = useRef([])   // { w, t } rolling window
  const classifySentRef     = useRef(false)
  const demoModeRef         = useRef(false) // true while a demo session is running
  const demoFrameRef        = useRef(null)

  useEffect(() => { screenRef.current = screen }, [screen])

  // ── Weight stability detection & auto-flow ───────────────────────────
  const handleWeightUpdate = useCallback((rawWeight) => {
    // Ignore hardware weight while a demo session is active
    if (demoModeRef.current) return

    setLiveWeight(rawWeight)
    const s = screenRef.current

    if (rawWeight < WEIGHT_THRESHOLD) {
      // Nothing on scale — reset history
      weightHistoryRef.current = []
      classifySentRef.current  = false
      if (s === SCREEN.WEIGHING) setScreen(SCREEN.IDLE)
      return
    }

    // Item placed → start weighing
    if (s === SCREEN.IDLE) {
      setScreen(SCREEN.WEIGHING)
      setSessionStart(Date.now())
      weightHistoryRef.current = []
      classifySentRef.current  = false
    }

    // Track stability only in WEIGHING and only before classify is sent
    if (s === SCREEN.WEIGHING && !classifySentRef.current) {
      const now = Date.now()
      weightHistoryRef.current.push({ w: rawWeight, t: now })

      // Keep only readings within the stability window
      const cutoff = now - STABLE_WINDOW_MS * 1.5
      weightHistoryRef.current = weightHistoryRef.current.filter(r => r.t >= cutoff)

      const history = weightHistoryRef.current
      const span    = history.length > 1 ? history[history.length - 1].t - history[0].t : 0

      if (span >= STABLE_WINDOW_MS) {
        const weights = history.map(r => r.w)
        const range   = Math.max(...weights) - Math.min(...weights)

        if (range <= STABLE_TOLERANCE) {
          // Weight is stable — record it and send classify request
          const stable = parseFloat(rawWeight.toFixed(3))
          setStableWeight(stable)
          classifySentRef.current = true
          sendClassify()
        }
      }
    }
  }, []) // sendClassify injected below via closure after hook call

  // ── Classify result from backend ─────────────────────────────────────
  const handleClassifyResult = useCallback((body) => {
    if (demoModeRef.current) return
    const topProduct  = findProductByLabel(body.label)
    const cands       = generateCandidatesFrom(topProduct)
    setCandidates(cands)
    setScreen(SCREEN.CANDIDATES)
  }, [])

  const { sendClassify } = useBackend({
    onWeight:           handleWeightUpdate,
    onClassify:         handleClassifyResult,
    onConnectionChange: setWsConnected,
  })

  // ── Demo trigger (simulates hardware, no real WS needed) ─────────────
  const handleDemoTrigger = useCallback((productId) => {
    if (screenRef.current !== SCREEN.IDLE) return

    demoModeRef.current = true
    const targetW = parseFloat((0.1 + Math.random() * 1.1).toFixed(3))
    const OVER    = targetW * 0.04
    const DURATION = 1100
    const start   = performance.now()

    setSessionStart(Date.now())
    setStableWeight(targetW)
    setCandidates(generateCandidatesFrom(PRODUCTS.find(p => p.id === productId)))
    setScreen(SCREEN.WEIGHING)

    // Animate weight for visual effect
    function animateDemo(ts) {
      const t = Math.min((ts - start) / DURATION, 1)
      let v
      if (t < 0.85) {
        const ease = 1 - Math.pow(1 - t / 0.85, 3)
        v = (targetW + OVER) * ease
      } else {
        v = targetW + OVER * (1 - (t - 0.85) / 0.15)
      }
      setLiveWeight(Math.max(0, v))
      if (t < 1) {
        demoFrameRef.current = requestAnimationFrame(animateDemo)
      } else {
        setLiveWeight(targetW)
        // Transition to candidates after weight settles + simulated AI delay
        setTimeout(() => setScreen(SCREEN.CANDIDATES), 650)
      }
    }
    demoFrameRef.current = requestAnimationFrame(animateDemo)
  }, [])

  // ── User tapped a candidate ───────────────────────────────────────────
  const handleSelect = useCallback((product) => {
    setSelectedProduct(product)
    setScreen(SCREEN.CONFIRMED)
  }, [])

  // ── Reset everything ──────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    cancelAnimationFrame(demoFrameRef.current)
    demoModeRef.current       = false
    weightHistoryRef.current  = []
    classifySentRef.current   = false

    setScreen(SCREEN.IDLE)
    setLiveWeight(0)
    setStableWeight(0)
    setCandidates([])
    setSelectedProduct(null)
    setSessionStart(null)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ touchAction: 'none' }}
      onContextMenu={e => e.preventDefault()}
    >
      {screen === SCREEN.IDLE && (
        <WaitingScreen key="idle" wsConnected={wsConnected} />
      )}
      {screen === SCREEN.WEIGHING && (
        <WeighingScreen key="weighing" liveWeight={liveWeight} />
      )}
      {screen === SCREEN.CANDIDATES && (
        <CandidatesScreen
          key="candidates"
          candidates={candidates}
          weight={stableWeight}
          onSelect={handleSelect}
          onBack={handleReset}
        />
      )}
      {screen === SCREEN.CONFIRMED && selectedProduct && (
        <ConfirmationScreen
          key="confirmed"
          product={selectedProduct}
          weight={stableWeight}
          sessionStart={sessionStart}
          onReset={handleReset}
        />
      )}

      <DemoPanel onTrigger={handleDemoTrigger} currentScreen={screen} />
    </div>
  )
}
