import { useState, useEffect, useRef, useCallback } from 'react'

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const SCREEN = {
  IDLE:       'IDLE',
  WEIGHING:   'WEIGHING',
  CANDIDATES: 'CANDIDATES',
  CONFIRMED:  'CONFIRMED',
}

const PRODUCTS = [
  {
    id: 'apple',
    name: 'Măr',
    variety: 'Red Delicious',
    emoji: '🍎',
    color: '#c0392b',
    bg: '#fdf0ef',
    border: '#f5c6c3',
    pricePerKg: 2.80,
  },
  {
    id: 'banana',
    name: 'Banană',
    variety: 'Cavendish',
    emoji: '🍌',
    color: '#d68910',
    bg: '#fef9ec',
    border: '#fde8a5',
    pricePerKg: 3.50,
  },
  {
    id: 'tomato',
    name: 'Roșie',
    variety: 'Rotundă',
    emoji: '🍅',
    color: '#a93226',
    bg: '#fdf0ef',
    border: '#f5c6c3',
    pricePerKg: 4.20,
  },
  {
    id: 'carrot',
    name: 'Morcov',
    variety: 'Portocaliu',
    emoji: '🥕',
    color: '#ca6f1e',
    bg: '#fef6ec',
    border: '#fddba5',
    pricePerKg: 1.90,
  },
  {
    id: 'grape',
    name: 'Strugure',
    variety: 'Muscat Alb',
    emoji: '🍇',
    color: '#7d3c98',
    bg: '#f5f0fb',
    border: '#d7bef0',
    pricePerKg: 6.00,
  },
]

// Generate 4 AI candidates for a given top product
function generateCandidates(topProductId) {
  const top = PRODUCTS.find(p => p.id === topProductId)
  const rest = PRODUCTS.filter(p => p.id !== topProductId)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)

  const topConf = 85 + Math.floor(Math.random() * 12)   // 85–96
  const rem = 100 - topConf
  const scores = [
    Math.floor(rem * 0.5),
    Math.floor(rem * 0.3),
    Math.floor(rem * 0.2),
  ].sort((a, b) => b - a)

  return [
    { ...top,    confidence: topConf     },
    { ...rest[0], confidence: scores[0]  },
    { ...rest[1], confidence: scores[1]  },
    { ...rest[2], confidence: scores[2]  },
  ]
}

// Animate weight 0 → target with overshoot settle
function useAnimatedWeight(target, active) {
  const [display, setDisplay] = useState(0)
  const frame = useRef(null)
  const t0 = useRef(null)

  useEffect(() => {
    if (!active || target === 0) { setDisplay(0); return }

    t0.current = null
    const DURATION = 1100
    const OVER = target * 0.04

    function step(ts) {
      if (!t0.current) t0.current = ts
      const t = Math.min((ts - t0.current) / DURATION, 1)

      let v
      if (t < 0.85) {
        const ease = 1 - Math.pow(1 - t / 0.85, 3)
        v = (target + OVER) * ease
      } else {
        const settle = (t - 0.85) / 0.15
        v = target + OVER * (1 - settle)
      }

      setDisplay(Math.max(0, v))
      if (t < 1) frame.current = requestAnimationFrame(step)
      else setDisplay(target)
    }

    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [target, active])

  return display
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
  const r = 20
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="animate-spin" style={{ animationDuration: '1.1s' }}>
      <circle cx="24" cy="24" r={r} fill="none" stroke="#c9d9c9" strokeWidth="4" />
      <circle cx="24" cy="24" r={r} fill="none" stroke="#568056" strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${circ * 0.28} ${circ * 0.72}`}
      />
    </svg>
  )
}

// ─── SCREEN 1: WAITING ───────────────────────────────────────────────────────

function WaitingScreen() {
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
      </div>

      {/* Step guide */}
      <div className="flex items-start justify-center gap-4 w-full max-w-2xl">
        {steps.map((step, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-3">
            {/* Icon bubble */}
            <div className={`${step.anim} w-20 h-20 rounded-3xl bg-white card-shadow border border-sage-100
              flex items-center justify-center text-4xl`}>
              {step.icon}
            </div>
            {/* Connector arrow */}
            {i < steps.length - 1 && (
              <div className="hidden" />
            )}
            {/* Step badge */}
            <div className="w-7 h-7 rounded-full bg-sage-400 flex items-center justify-center text-white text-sm font-bold shadow">
              {i + 1}
            </div>
            {/* Label */}
            <p className="text-center text-sage-600 font-medium text-base leading-snug whitespace-pre-line">
              {step.label}
            </p>
          </div>
        ))}
      </div>

      {/* Arrows between icons — overlaid on top of step row */}
      <div className="flex justify-center gap-4 w-full max-w-2xl -mt-40 mb-24 pointer-events-none" aria-hidden="true">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex-1 flex justify-end items-start pt-8 pr-0">
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

      {/* Scale icon */}
      <div className="w-32 h-32 rounded-full bg-white card-shadow border border-sage-100
        flex items-center justify-center text-7xl animate-bounce-soft">
        ⚖️
      </div>

      {/* Live weight display */}
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

      {/* Processing */}
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
  const ringOffset = RING_CIRC * (timeLeft / IDLE_TIMEOUT)  // drains to 0

  return (
    <div className="screen-enter h-full flex flex-col bg-warm-50">

      {/* ── Top bar ── */}
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
                <circle
                  cx="28" cy="28" r={RING_R} fill="none" stroke="#e67e22" strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={RING_CIRC - ringOffset}
                  style={{
                    transform: 'rotate(-90deg)',
                    transformOrigin: '28px 28px',
                    transition: 'stroke-dashoffset 0.95s linear',
                  }}
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

      {/* ── Candidate cards ── */}
      <div className="flex-1 flex items-center px-6 py-5 overflow-hidden">
        <div className="w-full grid gap-5"
          style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
                      : 'bg-white border-sage-100 card-shadow active:scale-95 active:card-shadow-hover'
                  }
                `}
                style={isSelected ? { background: candidate.bg } : {}}
              >
                {/* Emoji illustration */}
                <div
                  className="w-24 h-24 rounded-2xl flex items-center justify-center text-6xl"
                  style={{ background: candidate.bg, border: `2px solid ${candidate.border}` }}
                >
                  {candidate.emoji}
                </div>

                {/* Name */}
                <div>
                  <div className="text-2xl font-bold text-sage-800 leading-tight">{candidate.name}</div>
                  <div className="text-sm text-sage-400 font-medium mt-0.5">{candidate.variety}</div>
                </div>

                {/* Confidence badge */}
                <div
                  className="px-4 py-1.5 rounded-full text-sm font-bold"
                  style={{ background: candidate.bg, color: candidate.color, border: `1.5px solid ${candidate.border}` }}
                >
                  {candidate.confidence}% potrivire
                </div>

                {/* Price */}
                <div className="text-base text-sage-400 font-medium">
                  {candidate.pricePerKg.toFixed(2)} MDL/kg
                </div>

                {/* Selected checkmark */}
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

      {/* ── Bottom hint ── */}
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
    const analytics = {
      product:          product.name,
      variety:          product.variety,
      weight:           parseFloat(weight.toFixed(3)),
      unitPriceMDL:     product.pricePerKg,
      totalPriceMDL:    parseFloat(total),
      timestamp:        new Date().toISOString(),
      sessionDurationMs: Date.now() - sessionStart,
    }
    console.log('[SmartScale] Session complete:', analytics)
  }, [])

  const now     = new Date()
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

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

      {/* Receipt card */}
      <div className="w-full max-w-md receipt-bg rounded-3xl border border-warm-200 overflow-hidden card-shadow animate-slide-up">

        {/* Header strip */}
        <div className="px-8 py-6 flex items-center gap-5"
          style={{ background: `linear-gradient(135deg, ${product.color}22 0%, ${product.color}11 100%)`,
                   borderBottom: `2px solid ${product.border}` }}>
          <span className="text-6xl">{product.emoji}</span>
          <div>
            <div className="text-3xl font-bold text-sage-800">{product.name}</div>
            <div className="text-base text-sage-500 font-medium">{product.variety}</div>
          </div>
        </div>

        {/* Line items */}
        <div className="px-8 py-6 flex flex-col gap-4">
          <ReceiptRow label="Greutate"      value={`${weight.toFixed(3)} kg`} />
          <ReceiptRow label="Preț unitar"  value={`${product.pricePerKg.toFixed(2)} MDL / kg`} />
          <div className="border-t-2 border-dashed border-warm-200" />
          <ReceiptRow label="Total" value={`${total} MDL`} bold />
        </div>

        {/* Receipt footer */}
        <div className="border-t-2 border-dashed border-warm-200 mx-6" />
        <div className="px-8 py-4 text-center text-warm-400 text-sm font-medium">
          {dateStr} · {timeStr} · Cântar Inteligent v1.0
        </div>
      </div>

      {/* New item button */}
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
      <span className={`${bold ? 'text-xl font-bold text-warm-700' : 'text-lg font-medium text-warm-500'}`}>
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
  const [open, setOpen] = useState(false)
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
  const [targetWeight, setTargetWeight]   = useState(0)
  const [stableWeight, setStableWeight]   = useState(0)
  const [candidates, setCandidates]       = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [sessionStart, setSessionStart]   = useState(null)

  const animWeight = useAnimatedWeight(targetWeight, screen === SCREEN.WEIGHING)

  // ── Start a demo session ──────────────────────────────────────────────
  const handleDemoTrigger = useCallback((productId) => {
    if (screen !== SCREEN.IDLE) return

    const weight = parseFloat((0.1 + Math.random() * 1.1).toFixed(3))

    setSessionStart(Date.now())
    setTargetWeight(weight)
    setStableWeight(weight)
    setCandidates(generateCandidates(productId))
    setScreen(SCREEN.WEIGHING)

    // weight settles ~1.1s + AI inference 600ms
    setTimeout(() => setScreen(SCREEN.CANDIDATES), 1750)
  }, [screen])

  // ── User tapped a candidate ───────────────────────────────────────────
  const handleSelect = useCallback((product) => {
    setSelectedProduct(product)
    setScreen(SCREEN.CONFIRMED)
  }, [])

  // ── Reset everything ──────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setScreen(SCREEN.IDLE)
    setTargetWeight(0)
    setStableWeight(0)
    setCandidates([])
    setSelectedProduct(null)
    setSessionStart(null)
  }, [])

  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ touchAction: 'none' }}
      onContextMenu={e => e.preventDefault()}
    >
      {screen === SCREEN.IDLE && (
        <WaitingScreen key="idle" />
      )}
      {screen === SCREEN.WEIGHING && (
        <WeighingScreen key="weighing" liveWeight={animWeight} />
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
