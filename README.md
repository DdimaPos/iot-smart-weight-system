# Cântar Inteligent — Casă de Plată

Interfață kiosk touchscreen pentru cântare inteligente IoT la casele de plată self-service din supermarket. Rulează în browser pe un NVIDIA Jetson Nano conectat la un ecran tactil de 13 inch.

Fluxul de funcționare:
1. Clientul plasează un fruct sau legumă pe cântar
2. Greutatea se stabilizează → camera capturează imaginea → rețeaua CNN MobileNet clasifică produsul
3. Interfața afișează primele 3–5 produse candidat cu scoruri de încredere
4. Clientul apasă pe produsul său → se tipărește chitanța

---

## Tehnologii folosite

- **React 18** + **Vite 5**
- **Tailwind CSS 3**
- State machine cu `useState` + `useEffect` (IDLE → WEIGHING → CANDIDATES → CONFIRMED)
- Backend simulat în browser (fără hardware real)

---

## Cum lansezi proiectul

### Cerințe prealabile

- [Node.js](https://nodejs.org/) versiunea 18 sau mai nouă
- npm (inclus cu Node.js)

### 1. Clonează sau descarcă proiectul

```bash
git clone <url-repository>
cd iot-smart-weight-system
```

### 2. Instalează dependențele

```bash
npm install
```

### 3. Pornește serverul de dezvoltare

```bash
npm run dev
```

Vite va afișa adresa locală, de obicei:

```
VITE v5.x  ready in ~500ms
➜  Local:   http://localhost:5173/
```

Deschide acea adresă în browser.

### 4. Folosește panoul Demo

- Apasă butonul **🔧 Demo** din colțul stânga-jos
- Selectează un produs (Măr, Banană, Roșie, Morcov, Strugure)
- Apasă **▶ Puneți Produsul pe Cântar**
- Urmărește fluxul complet: Cântărire → Candidați → Chitanță

---

## Build pentru producție (Jetson Nano)

Generează fișierele statice optimizate:

```bash
npm run build
```

Previzualizează build-ul local înainte de deploy:

```bash
npm run preview
```

Servește folderul `dist/` pe Jetson Nano:

```bash
npx serve dist
```

Sau cu orice server HTTP static (nginx, Apache, etc.).

---

## Structura proiectului

```
iot-smart-weight-system/
├── index.html          # Shell HTML (kiosk: fără selecție text, fără meniu contextual)
├── vite.config.js
├── tailwind.config.js  # Paletă personalizată: sage (verde) + warm (crem)
├── postcss.config.js
└── src/
    ├── main.jsx        # Entry point React
    ├── index.css       # Animații CSS (spinner, dots, float, check-draw)
    └── App.jsx         # Toate componentele și state machine-ul
```

### Componente principale (`App.jsx`)

| Componentă | Rol |
|------------|-----|
| `<App />` | Controlorul state machine (IDLE / WEIGHING / CANDIDATES / CONFIRMED) |
| `<WaitingScreen />` | Ecran inițial cu ghid vizual pas-cu-pas |
| `<WeighingScreen />` | Afișează greutatea animată + spinner procesare |
| `<CandidatesScreen />` | Grid cu 4 candidați, timeout 30s, numărătoare inversă |
| `<ConfirmationScreen />` | Chitanță stilizată + log analytics în consolă |
| `<DemoPanel />` | Panou dezvoltator pentru simularea fluxului |

---

## Produse simulate

| Produs | Preț (MDL/kg) |
|--------|--------------|
| 🍎 Măr — Red Delicious | 2.80 |
| 🍌 Banană — Cavendish | 3.50 |
| 🍅 Roșie — Rotundă | 4.20 |
| 🥕 Morcov — Portocaliu | 1.90 |
| 🍇 Strugure — Muscat Alb | 6.00 |
