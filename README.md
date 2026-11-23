# PhysioLingo — Anatomia Funkcjonalna i Kliniczna 3D (PWA)

Interaktywna, grywalizowana aplikacja edukacyjna 3D dla studentów fizjoterapii do nauki anatomii funkcjonalnej, klinicznej, biomechaniki, kinezyterapii oraz diagnostyki różnicowej — w 100% po polsku, w pełni zgodna ze standardami egzaminacyjnymi (`ISOM` / `SFTR` / `Lovett 0–5` / `fizjoterapeuty.pl`) i przystosowana do pracy **offline (PWA)**.

---

## Kluczowe moduły (v6)

- **Ścieżka nauki (11 działów / 37 lekcji / 111 przypadków klinicznych)** — pełny kurs z 5 typami zadań (`matching`, `model3d`, `multiple_choice`, `typing`, `clinical_case`), systemem XP, serc, powtórek błędów i trybem swobodnym. Równa głębokość banku (3 przypadki kliniczne w każdej lekcji) i zbalansowana sesja: dokładnie 1 przypadek w lekcjach anatomicznych i dokładnie 2 w lekcjach klinicznych/kinezyterapii.
- **Eksplorator 3D (`Three.js` + 45 modeli `.glb` z kompresją Draco)** — pełne ciało i 6 modeli regionalnych z 6 warstwami anatomicznymi (kości, mięśnie, tętnice, żyły, nerwy, więzadła, narządy, skóra), strefy przyczepów **PP / PK** na kościach, dwukierunkowa mapa **Nerw ↔ Mięsień**, **Mapa Dermatomów i Miotomów 3D (C4–S2)**, wizualizator **Testów Klinicznych 3D** oraz **Biomechanika 3D** (7 kompleksów stawowych, 24 ruchy, trójkolorowe łańcuchy Agoniści / Synergiści / Antagoniści, płaszczyzny i osie obrotu 3D, reguły wklęsło-wypukłe Kaltenborna).
- **Egzamin Praktyczny „Szpilki 3D” + Fiszki SRS (351 kart SM-2)** — 5 trybów egzaminu (Wskaż na 3D, Rozpoznaj szpilkę, Dermatomy 3D, Biomechanika 3D, Fiszki powtórkowe SM-2 obejmujące anatomię, testy kliniczne, dermatomy i biomechanikę/SFTR).
- **Symulator Pacjenta 3D (12 przypadków × 5 etapów, tryb Nauki i OSCE `2.0–5.0`)** — pełna ścieżka badania fizjoterapeutycznego: wywiad i czerwone flagi → neuro/dermatomy → dobór testu ortopedycznego → lokalizacja struktury na modelu 3D → plan kinezyterapii.
- **Atlas i Encyklopedia Kliniczna** — 160 struktur anatomicznych oraz 54 protokoły testów ortopedycznych, skali Lovetta 0–5 (`0%–100%`), UGUL, PNF, SFTR i przeciwwskazań z podglądem 1-klik na modelu 3D.
- **Pełny tryb Offline PWA** — `Service Worker` (`public/sw.js`) z buforowaniem App Shell, dekoderów Draco i wszystkich 45 modeli 3D (`22,8 MB`) zarządzanych w zakładce **Offline / PWA** (pakiety regionalne + instalacja jako aplikacja na telefon/iPad/desktop).
- **Konta użytkowników (Hybrydowe API Express + tryb lokalny)** — rejestracja, logowanie z hashowaniem `scrypt`, automatyczna synchronizacja postępów, eksport/import JSON i pełny fallback `localStorage` bez serwera.

---

## Stos technologiczny

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Three.js (`GLTFLoader` + `DRACOLoader`), Lucide Icons, Vite 8
- **Backend kont:** Express 4 (`tsx`), natywne `crypto.scrypt` + sesje HTTP-only cookie
- **PWA / Offline:** Vanilla Service Worker (`Cache Storage API`: `physiolingo-app-v6`, `physiolingo-models-v6`)
- **Testy:** `node:test` (`tsx --test`) — 21 testów jednostkowych/API + 163 4-poziomowe testy E2E

---

## Uruchomienie lokalne

**Wymagania:** Node.js `>= 20` (zalecane Node 22 LTS)

```bash
# 1. Instalacja zależności
npm install

# 2. Uruchomienie pełnego środowiska dev (Vite :3000 + Express API :3001)
npm run dev
```

Aplikacja uruchomi się pod adresem `http://localhost:3000/`.

### Pozostałe polecenia

```bash
npm run dev:web     # Sam frontend Vite (z lokalnym fallbackiem kont w przeglądarce)
npm run dev:api     # Sam serwer API Express (:3001)
npm run build       # Build produkcyjny (dist/)
npm start           # Serwer produkcyjny (serwuje dist/ + API)
npm run lint        # Kontrola typów TypeScript (tsc --noEmit)
npm test            # Testy jednostkowe i API (21/21)
npm run test:e2e    # Zestaw 163 testów E2E
```

---

## Struktura projektu

```text
├── public/
│   ├── sw.js                   # Service Worker PWA (Cache-First 3D + offline fallback)
│   ├── manifest.webmanifest    # Manifest aplikacji PWA
│   ├── draco/                  # Dekodery Draco WASM/JS
│   └── models/                 # 45 modeli 3D .glb (całe ciało, regiony, 6 warstw)
├── server/                     # Backend Express API kont i sesji użytkowników
├── src/
│   ├── components/             # Widoki UI (SkillTree, Explorer3D, PinExam, PatientSimulator, Atlas, AccountModal)
│   ├── data/                   # Bazy: anatomyDb, curriculum (111 przypadków), clinicalTestsDb, dermatomesMyotomes, biomechanicsDb, patientCasesDb
│   ├── services/               # Auth API + localAuthAdapter + pwaOfflineService
│   ├── three/                  # Silnik 3D, translator nazw, warstwy, strefy PP/PK kości
│   └── utils/                  # Logika gry, SRS SM-2, testy jednostkowe
├── scripts/                    # Skrypty pomocnicze (dev runner, ekstrakcja modeli, eksport GitHub)
└── tests/e2e/                  # 4-poziomowa platforma testów E2E (163 testy)
```

---

## Źródła i licencje zasobów

- Modele 3D anatomii oparte na otwartym projekcie **Z-Anatomy** (licencja **CC BY-SA 4.0**).
- Standardy kliniczne, goniometria SFTR, skala Lovetta oraz testy ortopedyczne zweryfikowane pod kątem polskiej praktyki fizjoterapeutycznej (`ISOM`, prof. Zembaty, `fizjoterapeuty.pl`).
